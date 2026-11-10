import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { authenticateInstagramWorkerRequest } from "@/lib/instagram-worker-auth.server";
import { getInstagramAccountAccessToken } from "@/lib/instagram-oauth.server";
import { runInstagramPublishStep } from "@/lib/instagram-publish-step";
import type { PostkitDatabase } from "@/lib/postkit-database";
import {
  createInstagramFirstComment,
  createInstagramReelContainer,
  getInstagramContainerStatus,
  publishInstagramContainer,
} from "@/lib/social-publishing.server";

export const Route = createFileRoute("/api/instagram/worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await authenticateInstagramWorkerRequest(request);
        if (unauthorized) return unauthorized;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const client = supabaseAdmin as unknown as SupabaseClient<PostkitDatabase>;
        if (new URL(request.url).searchParams.get("job") === "analytics") {
          const { runInstagramAnalytics } = await import("@/lib/instagram-analytics.server");
          return runInstagramAnalytics(client);
        }
        const comment = await client.rpc("claim_instagram_first_comment").then(
          ({ data }) => data?.[0],
          () => undefined,
        );
        if (comment) {
          const account = await authorizedAccount(supabaseAdmin, comment).catch(() => null);
          const result = account
            ? await createInstagramFirstComment({
                ...account,
                mediaId: comment.meta_media_id,
                message: comment.first_comment,
              })
            : "failed";
          const checkpoint = await client.rpc("finish_instagram_first_comment", {
            p_id: comment.id,
            p_result: result,
          });
          if (checkpoint.error || checkpoint.data !== true)
            return Response.json({ error: "Comment checkpoint not confirmed." }, { status: 503 });
          return Response.json({ claimed: 1, comment: result });
        }
        // A loop failure must not block processing already-scheduled posts.
        await client.rpc("enqueue_due_instagram_reel_loops").then(
          ({ error }) => {
            if (error && error.code !== "PGRST202")
              console.error("Could not enqueue Instagram loops", error.code);
          },
          () => console.error("Could not reach the Instagram loops scheduler"),
        );
        const { data, error } = await client.rpc("claim_instagram_publish_step");
        if (error)
          return Response.json(
            { error: "Queue unavailable. Verify the publishing migration." },
            { status: 503 },
          );
        const post = data?.[0];
        if (!post) return Response.json({ claimed: 0 });
        try {
          const outcome = await runInstagramPublishStep(post, {
            checkpoint: async (value) => {
              const result = await client.rpc("checkpoint_instagram_publish", {
                p_post_id: post.id,
                p_lease_id: post.worker_lease_id!,
                p_outcome: value.outcome,
                p_container_id: value.containerId ?? undefined,
                p_media_id: value.mediaId ?? undefined,
                p_error_code: value.errorCode ?? undefined,
              });
              if (result.error || result.data !== true) throw new Error("Checkpoint not confirmed");
            },
            createContainer: async () => {
              const { data: media, error: mediaError } = await supabaseAdmin
                .from("media_assets")
                .select("storage_path,mime_type,status")
                .eq("id", post.media_asset_id)
                .eq("workspace_id", post.workspace_id)
                .maybeSingle();
              if (
                mediaError ||
                !media ||
                !["uploaded", "ready"].includes(media.status) ||
                !["video/mp4", "video/quicktime"].includes(media.mime_type)
              )
                throw new Error("Media unavailable");
              const signed = await supabaseAdmin.storage
                .from("postkit-media")
                .createSignedUrl(media.storage_path, 3600);
              if (signed.error || !signed.data?.signedUrl) throw new Error("Media unavailable");
              const account = await authorizedAccount(supabaseAdmin, post);
              const coverUrl = post.cover_asset_id
                ? await signReelCover(supabaseAdmin, post.workspace_id, post.cover_asset_id)
                : undefined;
              return createInstagramReelContainer({
                ...account,
                publicVideoUrl: signed.data.signedUrl,
                publicCoverUrl: coverUrl,
                caption: post.caption,
              });
            },
            readStatus: async (containerId) => {
              const account = await authorizedAccount(supabaseAdmin, post);
              return getInstagramContainerStatus(
                account.accessToken,
                containerId,
                account.authMode,
              );
            },
            publish: async (containerId) => {
              const account = await authorizedAccount(supabaseAdmin, post);
              return publishInstagramContainer({ ...account, containerId });
            },
          });
          return Response.json({ claimed: 1, outcome });
        } catch {
          // Do not report success, clear the lease or resubmit after a lost DB response.
          return Response.json(
            {
              error: "Progress could not be confirmed. Recovery will inspect the saved checkpoint.",
            },
            { status: 503 },
          );
        }
      },
    },
  },
});

async function signReelCover(
  client: SupabaseClient<Database>,
  workspaceId: string,
  coverId: string,
) {
  const { data, error } = await client
    .from("media_assets")
    .select("storage_path")
    .eq("id", coverId)
    .eq("workspace_id", workspaceId)
    .eq("mime_type", "image/jpeg")
    .in("status", ["uploaded", "ready"])
    .is("archived_at", null)
    .maybeSingle();
  if (error || !data || !data.storage_path.startsWith(`${workspaceId}/`))
    throw new Error("Reel cover unavailable");
  const signed = await client.storage
    .from("postkit-media")
    .createSignedUrl(data.storage_path, 3600);
  if (signed.error || !signed.data?.signedUrl) throw new Error("Reel cover unavailable");
  return signed.data.signedUrl;
}

async function authorizedAccount(
  client: SupabaseClient<Database>,
  post: {
    instagram_account_id: string;
    workspace_id: string;
  },
) {
  const { data, error } = await client
    .from("instagram_accounts")
    .select("instagram_user_id,connection_status,auth_mode")
    .eq("id", post.instagram_account_id)
    .eq("workspace_id", post.workspace_id)
    .maybeSingle();
  if (error || !data || data.connection_status !== "connected")
    throw new Error("Account unavailable");
  const authMode: "instagram_login" | "facebook_login" =
    data.auth_mode === "facebook_login" ? "facebook_login" : "instagram_login";
  return {
    instagramUserId: data.instagram_user_id,
    authMode,
    accessToken: await getInstagramAccountAccessToken(post.instagram_account_id),
  };
}
