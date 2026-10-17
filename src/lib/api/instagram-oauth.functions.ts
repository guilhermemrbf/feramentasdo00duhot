import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startInstagramOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ workspaceId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: workspace, error } = await context.supabase
      .from("workspaces")
      .select("id")
      .eq("id", data.workspaceId)
      .maybeSingle();
    if (error || !workspace) throw new Error("Workspace access denied.");

    const {
      createInstagramOAuthState,
      instagramAuthorizationUrl,
      instagramOAuthCookieOptions,
      instagramOAuthCookieName,
    } = await import("@/lib/instagram-oauth.server");
    const state = await createInstagramOAuthState({
      workspaceId: workspace.id,
      userId: context.userId,
    });
    setCookie(instagramOAuthCookieName(), state, instagramOAuthCookieOptions());
    return { authorizationUrl: instagramAuthorizationUrl(state) };
  });
