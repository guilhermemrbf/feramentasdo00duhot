import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { getInstagramAccountAccessToken } from "@/lib/instagram-oauth.server";
import {
  InstagramPublishAmbiguousError,
  publishInstagramReel,
} from "@/lib/social-publishing.server";

export const Route = createFileRoute("/api/instagram/worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await authenticateCronRequest(request);
        if (unauthorized) return unauthorized;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Local extension reflects the checked-in migration without editing generated types.
        type WorkerDatabase = Database & { public: Database["public"] & {
          Functions: Database["public"]["Functions"] & {
            claim_due_instagram_posts: { Args: { p_limit: number }; Returns: Database["public"]["Tables"]["posts"]["Row"][] };
          };
        } };
        const workerClient = supabaseAdmin as unknown as SupabaseClient<WorkerDatabase>;
        const { data: posts, error: claimError } = await workerClient.rpc(
          "claim_due_instagram_posts",
          { p_limit: 5 },
        );
        if (claimError) return Response.json({ error: "Queue claim failed." }, { status: 500 });

        let published = 0;
        let failed = 0;
        let needsReview = 0;
        for (const post of posts ?? []) {
          try {
            const [{ data: account, error: accountError }, { data: media, error: mediaError }] =
              await Promise.all([
                supabaseAdmin
                  .from("instagram_accounts")
                  .select("instagram_user_id,connection_status")
                  .eq("id", post.instagram_account_id)
                  .eq("workspace_id", post.workspace_id)
                  .maybeSingle(),
                supabaseAdmin
                  .from("media_assets")
                  .select("storage_path,mime_type,status")
                  .eq("id", post.media_asset_id)
                  .eq("workspace_id", post.workspace_id)
                  .maybeSingle(),
              ]);
            if (accountError || !account || account.connection_status !== "connected") {
              throw new Error("Instagram account is unavailable or disconnected.");
            }
            if (mediaError || !media || media.status === "failed" || media.status === "archived") {
              throw new Error("Instagram media is unavailable.");
            }
            const { data: signedMedia, error: signedUrlError } = await supabaseAdmin.storage
              .from("postkit-media")
              .createSignedUrl(media.storage_path, 60 * 60);
            if (signedUrlError || !signedMedia?.signedUrl)
              throw new Error("Media URL could not be prepared.");

            const accessToken = await getInstagramAccountAccessToken(post.instagram_account_id);
            const result = await publishInstagramReel({
              accessToken,
              instagramUserId: account.instagram_user_id,
              publicVideoUrl: signedMedia.signedUrl,
              caption: post.caption,
            });

            await supabaseAdmin
              .from("posts")
              .update({
                status: "published",
                meta_media_id: result.mediaId,
                published_at: new Date().toISOString(),
              })
              .eq("id", post.id)
              .eq("status", "processing");
            await supabaseAdmin
              .from("publish_attempts")
              .update({ status: "succeeded", finished_at: new Date().toISOString() })
              .eq("post_id", post.id)
              .eq("attempt_number", post.attempt_count);
            published += 1;
          } catch (error) {
            const ambiguous = error instanceof InstagramPublishAmbiguousError;
            const message = ambiguous
              ? "Instagram pode ter aceito a publicação; verifique a conta antes de tentar novamente."
              : "A publicação falhou. Corrija o problema e revise a publicação antes de tentar novamente.";
            const errorCode = ambiguous ? "publish_outcome_ambiguous" : "publish_failed";
            await supabaseAdmin
              .from("posts")
              .update({
                status: ambiguous ? "needs_review" : "failed",
                last_error_code: errorCode,
                last_error_message: message,
              })
              .eq("id", post.id)
              .eq("status", "processing");
            await supabaseAdmin
              .from("publish_attempts")
              .update({
                status: ambiguous ? "ambiguous" : "failed",
                error_code: errorCode,
                error_message: message,
                finished_at: new Date().toISOString(),
              })
              .eq("post_id", post.id)
              .eq("attempt_number", post.attempt_count);
            if (ambiguous) needsReview += 1;
            else failed += 1;
          }
        }

        return Response.json({ claimed: posts?.length ?? 0, published, failed, needsReview });
      },
    },
  },
});
