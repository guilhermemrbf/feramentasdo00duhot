import type { Database } from "@/integrations/supabase/types";
import type { PublishPhase } from "./instagram-publish-step";

export type LeasedInstagramPost = Database["public"]["Tables"]["posts"]["Row"] & {
  publish_phase: PublishPhase;
  meta_container_id: string | null;
  worker_lease_id: string | null;
};

/** Additive migration contract; generated Supabase types remain untouched. */
export type PostkitDatabase = Database & {
  public: Database["public"] & {
    Functions: Database["public"]["Functions"] & {
      claim_instagram_publish_step: { Args: Record<string, never>; Returns: LeasedInstagramPost[] };
      checkpoint_instagram_publish: {
        Args: {
          p_post_id: string;
          p_lease_id: string;
          p_outcome: string;
          p_container_id: string | null;
          p_media_id: string | null;
          p_error_code: string | null;
        };
        Returns: boolean;
      };
      cancel_scheduled_instagram_post: { Args: { p_post_id: string }; Returns: boolean };
    };
  };
};
