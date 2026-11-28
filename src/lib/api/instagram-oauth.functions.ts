import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { requirePlatformAccess } from "@/integrations/supabase/platform-middleware";

export const startInstagramOAuth = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(
    z.object({
      workspaceId: z.string().uuid(),
      mode: z
        .enum(["instagram_login", "facebook_login", "instagram_unified_login"])
        .default("instagram_unified_login"),
      analytics: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: canManageWorkspace, error } = await context.supabase.rpc("has_workspace_role", {
      target_workspace: data.workspaceId,
      allowed_roles: ["owner", "admin", "editor"],
    });
    if (error || !canManageWorkspace) throw new Error("Workspace access denied.");

    const {
      createInstagramOAuthState,
      facebookAuthorizationUrl,
      getInstagramOAuthBaseConfig,
      getInstagramOAuthConfig,
      instagramAuthorizationUrl,
      instagramOAuthCookieOptions,
      instagramOAuthCookieName,
    } = await import("@/lib/instagram-oauth.server");
    const { canUsePlatformInstagramApp, readWorkspaceApp, platformInstagramAppRevision } =
      await import("@/lib/instagram-workspace-app.server");
    const app = await readWorkspaceApp(data.workspaceId);
    if (
      !app?.app_id &&
      !(await canUsePlatformInstagramApp(context.supabase, data.workspaceId, !!app))
    ) {
      throw new Error("Cadastre o app Meta da operação em Primeiros passos antes de conectar.");
    }
    if (app?.app_id && data.mode !== "instagram_unified_login") {
      throw new Error("Use o Login Unificado para conectar com o app Meta da operação.");
    }
    const { getInstagramUnifiedConfigId, instagramUnifiedAuthorizationUrl } =
      await import("@/lib/instagram-unified-login.server");
    const appId = app?.app_id ?? getInstagramOAuthConfig().appId;
    const configId = app?.login_config_id ?? getInstagramUnifiedConfigId(appId);
    const appRevision = app?.app_id ? app.revision : platformInstagramAppRevision(appId, configId);

    const state = await createInstagramOAuthState({
      workspaceId: data.workspaceId,
      userId: context.userId,
      mode: data.mode,
      analytics: data.analytics,
      appRevision,
    });
    let authorizationUrl: string;
    if (data.mode === "instagram_unified_login") {
      const { callbackUrl } = getInstagramOAuthBaseConfig();
      authorizationUrl = instagramUnifiedAuthorizationUrl(state, { appId, callbackUrl }, configId);
    } else {
      authorizationUrl =
        data.mode === "facebook_login"
          ? facebookAuthorizationUrl(state, data.analytics)
          : instagramAuthorizationUrl(state, data.analytics);
    }
    setCookie(instagramOAuthCookieName(), state, instagramOAuthCookieOptions());
    return {
      authorizationUrl,
      cookie: {
        name: instagramOAuthCookieName(),
        value: state,
        url: getInstagramOAuthBaseConfig().appBaseUrl.origin,
        maxAge: 600,
      },
    };
  });
