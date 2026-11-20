import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const workspaceInput = z.object({ workspaceId: z.string().uuid() });
const metaId = z
  .string()
  .trim()
  .regex(/^\d{1,32}$/);
const appInput = workspaceInput.extend({
  appId: metaId,
  configId: metaId,
  appSecret: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{32}$/i),
});

export const getInstagramWorkspaceApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(workspaceInput)
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("has_workspace_role", {
      target_workspace: data.workspaceId,
      allowed_roles: ["owner", "admin", "editor", "viewer"],
    });
    if (error || !allowed) throw new Error("Acesso à operação indisponível.");
    const [{ readWorkspaceApp }, oauth] = await Promise.all([
      import("@/lib/instagram-workspace-app.server"),
      import("@/lib/instagram-oauth.server"),
    ]);
    const [app, manage] = await Promise.all([
      readWorkspaceApp(data.workspaceId),
      context.supabase.rpc("has_workspace_role", {
        target_workspace: data.workspaceId,
        allowed_roles: ["owner", "admin"],
      }),
    ]);
    if (manage.error) throw new Error("Não foi possível verificar as permissões da operação.");
    let platformAppConfigured = false;
    if (app?.app_id === null) {
      try {
        const { getInstagramUnifiedConfigId } =
          await import("@/lib/instagram-unified-login.server");
        getInstagramUnifiedConfigId(oauth.getInstagramOAuthConfig().appId);
        platformAppConfigured = true;
      } catch {
        // Keep the dashboard accessible while the operator restores the server configuration.
      }
    }
    return {
      mode: !app ? ("missing" as const) : app.app_id ? ("own" as const) : ("legacy" as const),
      appId: app?.app_id ?? "",
      configId: app?.login_config_id ?? "",
      callbackUrl: oauth.getInstagramOAuthBaseConfig().callbackUrl,
      platformAppConfigured,
      canManage: manage.data === true,
    };
  });

export const registerInstagramWorkspaceApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(appInput)
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("has_workspace_role", {
      target_workspace: data.workspaceId,
      allowed_roles: ["owner", "admin"],
    });
    if (error || !allowed) return { outcome: "access" as const };
    const [{ workspaceAppDatabase, validateWorkspaceMetaApp, workspaceAppSecretBinding }, oauth] =
      await Promise.all([
        import("@/lib/instagram-workspace-app.server"),
        import("@/lib/instagram-oauth.server"),
      ]);
    if (data.appId === process.env.META_APP_ID?.trim()) return { outcome: "reserved" as const };
    const validation = await validateWorkspaceMetaApp(data.appId, data.appSecret);
    if (validation !== "valid") return { outcome: validation };

    const db = await workspaceAppDatabase();
    const result = await db.rpc("save_instagram_workspace_app", {
      p_workspace_id: data.workspaceId,
      p_user_id: context.userId,
      p_app_id: data.appId,
      p_login_config_id: data.configId,
      p_secret_ciphertext: await oauth.encryptInstagramToken(
        data.appSecret,
        workspaceAppSecretBinding(data.workspaceId, data.appId, data.configId),
      ),
    });
    if (result.error?.code === "23505") return { outcome: "reserved" as const };
    if (result.error) return { outcome: "storage" as const };
    return { outcome: result.data ? ("saved" as const) : ("locked" as const) };
  });
