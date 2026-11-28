import type { Database, Json } from "@/integrations/supabase/types";
import type { PublishPhase } from "./instagram-publish-step";
import type { StoryAudience, StoryStickers } from "./instagram-story-layout";

export type LeasedInstagramPost = Database["public"]["Tables"]["posts"]["Row"] & {
  publish_phase: PublishPhase;
  meta_container_id: string | null;
  worker_lease_id: string | null;
  cover_asset_id: string | null;
};

type Tables = Database["public"]["Tables"];
type TableWithDetails<T, D> = {
  [K in keyof T]: K extends "Row"
    ? T[K] & D
    : K extends "Insert" | "Update"
      ? T[K] & Partial<D>
      : T[K];
};
type CommentStatus = "sending" | "published" | "failed" | "needs_review";
export type StoryReminderState = "pending" | "done" | "cancelled";
export type InstagramStoryReminder = {
  id: string;
  workspace_id: string;
  instagram_account_id: string;
  storage_path: string;
  filename: string;
  mime_type: "image/jpeg" | "image/png" | "video/mp4" | "video/quicktime" | "video/webm";
  link_url: string | null;
  link_title: string | null;
  stickers: StoryStickers | null;
  audience: StoryAudience;
  sticker_x: number;
  sticker_y: number;
  scheduled_at: string;
  state: StoryReminderState;
  created_at: string;
};
type FirstCommentJob = {
  id: string;
  workspace_id: string;
  instagram_account_id: string;
  meta_media_id: string;
  first_comment: string;
};

export type InstagramWorkspaceAppRow = {
  workspace_id: string;
  revision: string;
  app_id: string | null;
  login_config_id: string | null;
  secret_ciphertext: string | null;
};

export type InstagramReelLoop = {
  id: string;
  name: string;
  account_id: string;
  username: string;
  state: "active" | "paused" | "finished";
  pause_reason: string | null;
  interval_minutes: number;
  next_at: string;
  asset_index: number;
  total: number;
};

/** Additive migration contract; generated Supabase types remain untouched. */
export type PostkitDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Omit<Tables, "posts" | "media_assets" | "instagram_tokens" | "instagram_accounts"> & {
      instagram_story_reminders: {
        Row: InstagramStoryReminder;
        Insert: Omit<InstagramStoryReminder, "state" | "created_at">;
        Update: { state: StoryReminderState };
        Relationships: [];
      };
      instagram_workspace_apps: {
        Row: InstagramWorkspaceAppRow;
        Insert: Omit<InstagramWorkspaceAppRow, "revision">;
        Update: Partial<InstagramWorkspaceAppRow>;
        Relationships: [];
      };
      instagram_drive_sources: {
        Row: {
          account_id: string;
          workspace_id: string;
          folder_id: string;
          folder_name: string;
          library_folder_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      instagram_drive_files: {
        Row: {
          media_asset_id: string;
          workspace_id: string;
          account_id: string;
          folder_id: string;
          file_id: string;
          revision: string;
          checksum: string;
          size_bytes: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      instagram_drive_staging: {
        Row: { path: string; post_id: string; expires_at: string };
        Insert: { path: string; post_id: string };
        Update: never;
        Relationships: [];
      };
      instagram_accounts: TableWithDetails<
        Tables["instagram_accounts"],
        {
          profile_picture_url: string | null;
          client_business_id: string | null;
          login_config_id: string | null;
          connected_at: string | null;
          disconnected_at: string | null;
        }
      >;
      instagram_tokens: TableWithDetails<
        Tables["instagram_tokens"],
        {
          analytics_access_token_ciphertext: string | null;
          analytics_token_expires_at: string | null;
        }
      >;
      posts: TableWithDetails<
        Tables["posts"],
        {
          cover_asset_id: string | null;
          first_comment: string | null;
          first_comment_status: CommentStatus | null;
        }
      >;
      media_assets: TableWithDetails<
        Tables["media_assets"],
        {
          import_batch_id: string | null;
          import_folder: string | null;
          import_position: number | null;
          reel_account_id: string | null;
        }
      >;
    };
    Functions: Omit<
      Database["public"]["Functions"],
      "save_instagram_unified_accounts" | "get_instagram_analytics" | "get_instagram_top_posts"
    > & {
      sync_instagram_drive_library: {
        Args: {
          p_workspace: string;
          p_account: string;
          p_actor: string;
          p_folder: string;
          p_name: string;
          p_files: Json;
          p_connect: boolean;
        };
        Returns: number;
      };
      disconnect_instagram_drive_library: {
        Args: { p_workspace: string; p_account: string; p_actor: string };
        Returns: undefined;
      };
      save_instagram_workspace_app: {
        Args: {
          p_workspace_id: string;
          p_user_id: string;
          p_app_id: string;
          p_login_config_id: string;
          p_secret_ciphertext: string;
        };
        Returns: boolean;
      };
      save_workspace_instagram_grant: {
        Args: {
          p_workspace_id: string;
          p_user_id: string;
          p_revision: string;
          p_accounts: Json;
          p_scopes: string[];
          p_token_ciphertext: string;
          p_expires_at: string | null;
        };
        Returns: boolean;
      };
      save_platform_instagram_grant: {
        Args: Omit<
          PostkitDatabase["public"]["Functions"]["save_workspace_instagram_grant"]["Args"],
          "p_revision"
        >;
        Returns: boolean;
      };
      disconnect_instagram_account: {
        Args: { p_account_id: string };
        Returns: Json;
      };
      schedule_reviewed_instagram_reels: {
        Args: {
          p_workspace_id: string;
          p_account_id: string;
          p_posts: Json;
          p_stories: string;
          p_confirmed: boolean;
        };
        Returns: number;
      };
      save_instagram_unified_accounts: {
        Args: {
          p_workspace_id: string;
          p_user_id: string;
          p_accounts: Json;
          p_scopes: string[];
          p_token_ciphertext: string;
          p_expires_at: string | null;
        };
        Returns: undefined;
      };
      claim_instagram_analytics: { Args: Record<string, never>; Returns: Json };
      finish_instagram_analytics: {
        Args: { p_account: string; p_lease: string; p_result: Json };
        Returns: boolean;
      };
      get_instagram_analytics: {
        Args: {
          p_workspace: string;
          p_account: string | null;
          p_start: string | null;
          p_end: string | null;
          p_page: number;
        };
        Returns: Json;
      };
      get_postkit_dashboard_performance: {
        Args: { p_workspace: string; p_start: string | null; p_end: string | null };
        Returns: Json;
      };
      get_instagram_top_posts: {
        Args: { p_workspace: string; p_account: string | null };
        Returns: Json;
      };
      ensure_postkit_workspace: {
        Args: Record<string, never>;
        Returns: Database["public"]["Tables"]["workspaces"]["Row"][];
      };
      create_postkit_device_invite: {
        Args: { p_workspace_id: string; p_token_hash: string };
        Returns: undefined;
      };
      accept_postkit_device_invite: { Args: { p_token_hash: string }; Returns: string };
      revoke_postkit_device_invite: { Args: { p_token_hash: string }; Returns: undefined };
      claim_instagram_publish_step: { Args: Record<string, never>; Returns: LeasedInstagramPost[] };
      verify_instagram_worker_secret: { Args: { p_token: string }; Returns: boolean };
      enable_instagram_worker: { Args: Record<string, never>; Returns: boolean };
      instagram_worker_is_active: { Args: Record<string, never>; Returns: boolean };
      list_instagram_reel_loops: {
        Args: { p_workspace_id: string };
        Returns: InstagramReelLoop[];
      };
      create_instagram_reel_loops: {
        Args: {
          p_workspace_id: string;
          p_name: string;
          p_account_ids: string[];
          p_asset_ids: string[];
          p_caption: string;
          p_interval_minutes: number;
          p_start_at: string;
        };
        Returns: number;
      };
      set_instagram_reel_loop_paused: {
        Args: { p_id: string; p_paused: boolean };
        Returns: boolean;
      };
      enqueue_due_instagram_reel_loops: { Args: Record<string, never>; Returns: number };
      claim_instagram_first_comment: { Args: Record<string, never>; Returns: FirstCommentJob[] };
      finish_instagram_first_comment: {
        Args: { p_id: string; p_result: Exclude<CommentStatus, "sending"> };
        Returns: boolean;
      };
      checkpoint_instagram_publish: {
        Args: {
          p_post_id: string;
          p_lease_id: string;
          p_outcome: string;
          p_container_id?: string;
          p_media_id?: string;
          p_error_code?: string;
        };
        Returns: boolean;
      };
      cancel_scheduled_instagram_post: { Args: { p_post_id: string }; Returns: boolean };
    };
  };
};
