import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeasedInstagramPost, PostkitDatabase } from "./postkit-database";
import { createDriveReader } from "./instagram-drive.server.ts";
import { DrivePublishError } from "./instagram-drive.ts";

const stagingBucket = "postkit-drive-staging";

export async function cleanupDriveStaging(db: SupabaseClient<PostkitDatabase>, postId?: string) {
  const rows = db.from("instagram_drive_staging").select("path");
  const { data, error } = await (
    postId
      ? rows.eq("post_id", postId)
      : rows.lt("expires_at", new Date().toISOString()).order("expires_at")
  ).limit(50);
  if (error) return false;
  const paths = (data ?? []).map((row) => row.path);
  if (!paths.length) return true;
  const removed = await db.storage.from(stagingBucket).remove(paths);
  if (removed.error) return false;
  const removedRows = await db.from("instagram_drive_staging").delete().in("path", paths);
  return !removedRows.error;
}

export async function stageDriveReel(
  db: SupabaseClient<PostkitDatabase>,
  post: LeasedInstagramPost,
  mime: "video/mp4" | "video/quicktime",
  reader = createDriveReader(),
) {
  const scope = {
    workspaceId: post.workspace_id,
    accountId: post.instagram_account_id,
  };
  const [file, source] = await Promise.all([
    db
      .from("instagram_drive_files")
      .select("folder_id,file_id,revision,checksum,size_bytes")
      .eq("media_asset_id", post.media_asset_id)
      .eq("workspace_id", scope.workspaceId)
      .eq("account_id", scope.accountId)
      .maybeSingle(),
    db
      .from("instagram_drive_sources")
      .select("folder_id")
      .eq("workspace_id", scope.workspaceId)
      .eq("account_id", scope.accountId)
      .maybeSingle(),
  ]);
  if (file.error || source.error) throw new DrivePublishError("drive_transfer");
  if (!file.data || file.data.folder_id !== source.data?.folder_id)
    throw new DrivePublishError("drive_unavailable");
  if (!post.worker_lease_id) throw new DrivePublishError("drive_transfer");

  const path = `${scope.workspaceId}/${post.id}/${post.worker_lease_id}.${mime === "video/mp4" ? "mp4" : "mov"}`;
  const record = await db.from("instagram_drive_staging").insert({ path, post_id: post.id });
  if (record.error) throw new DrivePublishError("drive_transfer");
  try {
    const body = await reader.download(file.data.folder_id, file.data, AbortSignal.timeout(55_000));
    const storage = db.storage.from(stagingBucket);
    const uploaded = await storage.upload(path, body, { contentType: mime, duplex: "half" });
    if (uploaded.error) {
      // The SDK can wrap a stream error. Only report a specific code from our own validation.
      if (uploaded.error.cause instanceof DrivePublishError) throw uploaded.error.cause;
      throw new DrivePublishError("drive_transfer");
    }
    const signed = await storage.createSignedUrl(path, 3600);
    if (signed.error || !signed.data?.signedUrl) throw new DrivePublishError("drive_transfer");
    return signed.data.signedUrl;
  } catch (error) {
    if (error instanceof DrivePublishError) throw error;
    throw new DrivePublishError("drive_transfer");
  }
}
