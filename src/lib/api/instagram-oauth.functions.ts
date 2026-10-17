import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startInstagramOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ workspaceId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: canManageWorkspace, error } = await context.supabase.rpc("has_workspace_role", {
      target_workspace: data.workspaceId,
      allowed_roles: ["owner", "admin", "editor"],
    });
    if (error || !canManageWorkspace) throw new Error("Workspace access denied.");

    const {
      createInstagramOAuthState,
      instagramAuthorizationUrl,
      instagramOAuthCookieOptions,
      instagramOAuthCookieName,
    } = await import("@/lib/instagram-oauth.server");
    const state = await createInstagramOAuthState({
      workspaceId: data.workspaceId,
      userId: context.userId,
    });
    setCookie(instagramOAuthCookieName(), state, instagramOAuthCookieOptions());
    return { authorizationUrl: instagramAuthorizationUrl(state) };
  });
