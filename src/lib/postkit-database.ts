import type { Database } from "@/integrations/supabase/types";
import type { PublishPhase } from "./instagram-publish-step";

export type LeasedInstagramPost = Database["public"]["Tables"]["posts"]["Row"] & {
  publish_phase: PublishPhase;
  meta_container_id: string | null;
  worker_lease_id: string | null;
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
export type PostkitDatabase = Database & {
  public: Database["public"] & {
    Functions: Database["public"]["Functions"] & {
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
