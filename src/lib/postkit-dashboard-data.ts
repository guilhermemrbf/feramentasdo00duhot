import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { PostkitDatabase } from "@/lib/postkit-database";

const database = supabase as unknown as SupabaseClient<PostkitDatabase>;
export const postkitWorkspaceStorageKey = "postkit.workspace";
export type PostkitDashboardRange = { start: string | null; end: string | null };

export async function readPostkitDashboardWorkspace() {
  let preferred: string | null = null;
  try {
    preferred = localStorage.getItem(postkitWorkspaceStorageKey);
  } catch {
    // The oldest accessible workspace is also the fallback in Automatic Post.
  }
  const { data, error } = await database
    .from("workspaces")
    .select("id,name,timezone")
    .order("created_at")
    .order("id");
  if (error) throw error;
  return data.find(({ id }) => id === preferred) ?? data[0] ?? null;
}

export type UpcomingPostkitPublication = {
  key: string;
  scheduledAt: string | null;
  kind: "Reel" | "Story" | "Lembrete de Story";
  username?: string;
  filename?: string;
  processing: boolean;
  isReminder: boolean;
  accountId?: string;
};

export async function readPostkitQueue(workspaceId: string, limit = 5) {
  const [posts, reminders] = await Promise.all([
    database
      .from("posts")
      .select(
        "id,scheduled_at,status,content_type,instagram_accounts!posts_instagram_account_id_workspace_id_fkey(username),media_assets!posts_media_asset_id_workspace_id_fkey(original_filename)",
        { count: "exact" },
      )
      .eq("workspace_id", workspaceId)
      .in("status", ["scheduled", "processing"])
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .order("id")
      .limit(limit),
    database
      .from("instagram_story_reminders")
      .select("id,scheduled_at,filename,instagram_account_id", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .eq("state", "pending")
      .order("scheduled_at")
      .order("id")
      .limit(limit),
  ]);
  const upcoming: UpcomingPostkitPublication[] = [
    ...(posts.data ?? []).map(
      (post): UpcomingPostkitPublication => ({
        key: "post-" + post.id,
        scheduledAt: post.scheduled_at,
        kind: post.content_type === "story" ? "Story" : "Reel",
        username: post.instagram_accounts?.username,
        filename: post.media_assets?.original_filename,
        processing: post.status === "processing",
        isReminder: false,
      }),
    ),
    ...(reminders.data ?? []).map(
      (reminder): UpcomingPostkitPublication => ({
        key: "reminder-" + reminder.id,
        scheduledAt: reminder.scheduled_at,
        kind: "Lembrete de Story",
        accountId: reminder.instagram_account_id,
        filename: reminder.filename,
        processing: false,
        isReminder: true,
      }),
    ),
  ];
  const sortDate = (value: string | null) => (value ? Date.parse(value) : Infinity);
  upcoming.sort(
    (first, second) =>
      sortDate(first.scheduledAt) - sortDate(second.scheduledAt) ||
      first.key.localeCompare(second.key),
  );
  return {
    upcoming: upcoming.slice(0, limit),
    queued: posts.count,
    reminderCount: reminders.count,
    scheduleUnavailable: Boolean(posts.error || reminders.error),
  };
}

type PostkitPerformance = {
  published: number;
  active: number;
  connected: number;
  views: number | null;
  measured: number;
  reels: number;
  accountNames: Record<string, string>;
  ranking: { id: string; username: string; views: number }[];
};

export async function readPostkitPerformance(workspaceId: string, range: PostkitDashboardRange) {
  const { data, error } = await database.rpc("get_postkit_dashboard_performance", {
    p_workspace: workspaceId,
    p_start: range.start,
    p_end: range.end,
  });
  if (error) throw error;
  return data as PostkitPerformance;
}
