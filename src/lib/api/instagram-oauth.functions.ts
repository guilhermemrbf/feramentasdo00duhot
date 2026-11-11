import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startInstagramOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      workspaceId: z.string().uuid(),
      mode: z
        .enum(["instagram_login", "facebook_login", "instagram_unified_login"])
        .default("instagram_login"),
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
      getInstagramOAuthConfig,
      instagramAuthorizationUrl,
      instagramOAuthCookieOptions,
      instagramOAuthCookieName,
    } = await import("@/lib/instagram-oauth.server");
    const state = await createInstagramOAuthState({
      workspaceId: data.workspaceId,
      userId: context.userId,
      mode: data.mode,
      analytics: data.analytics,
    });
    let authorizationUrl: string;
    if (data.mode === "instagram_unified_login") {
      const { instagramUnifiedAuthorizationUrl } =
        await import("@/lib/instagram-unified-login.server");
      authorizationUrl = instagramUnifiedAuthorizationUrl(state, getInstagramOAuthConfig());
    } else {
      authorizationUrl =
        data.mode === "facebook_login"
          ? facebookAuthorizationUrl(state, data.analytics)
          : instagramAuthorizationUrl(state, data.analytics);
    }
    setCookie(instagramOAuthCookieName(), state, instagramOAuthCookieOptions());
    return { authorizationUrl };
  });
