export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      caption_sets: {
        Row: {
          captions: string[]
          created_at: string
          created_by: string | null
          id: string
          name: string
          rotation_enabled: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          captions?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          rotation_enabled?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          captions?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          rotation_enabled?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caption_sets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      hashtag_groups: {
        Row: {
          created_at: string
          created_by: string | null
          hashtags: string[]
          id: string
          name: string
          rotation_enabled: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          hashtags?: string[]
          id?: string
          name: string
          rotation_enabled?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          hashtags?: string[]
          id?: string
          name?: string
          rotation_enabled?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hashtag_groups_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_accounts: {
        Row: {
          account_type: string | null
          auth_mode: string
          connected_by: string | null
          connection_status: Database["public"]["Enums"]["instagram_connection_status"]
          created_at: string
          display_name: string | null
          id: string
          instagram_user_id: string
          last_error_code: string | null
          last_error_message: string | null
          last_verified_at: string | null
          scopes: string[]
          token_expires_at: string | null
          updated_at: string
          username: string
          workspace_id: string
        }
        Insert: {
          account_type?: string | null
          auth_mode?: string
          connected_by?: string | null
          connection_status?: Database["public"]["Enums"]["instagram_connection_status"]
          created_at?: string
          display_name?: string | null
          id?: string
          instagram_user_id: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_verified_at?: string | null
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
          username: string
          workspace_id: string
        }
        Update: {
          account_type?: string | null
          auth_mode?: string
          connected_by?: string | null
          connection_status?: Database["public"]["Enums"]["instagram_connection_status"]
          created_at?: string
          display_name?: string | null
          id?: string
          instagram_user_id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_verified_at?: string | null
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
          username?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_profile_drafts: {
        Row: {
          account_created: boolean
          bio: string
          created_at: string
          display_name: string
          handle: string
          id: string
          instagram_account_id: string | null
          photo_path: string | null
          product_url: string | null
          reels_per_day: number
          registration_email: string | null
          starter_reels: string[]
          workspace_id: string
        }
        Insert: {
          account_created?: boolean
          bio?: string
          created_at?: string
          display_name: string
          handle: string
          id: string
          instagram_account_id?: string | null
          photo_path?: string | null
          product_url?: string | null
          reels_per_day?: number
          registration_email?: string | null
          starter_reels?: string[]
          workspace_id: string
        }
        Update: {
          account_created?: boolean
          bio?: string
          created_at?: string
          display_name?: string
          handle?: string
          id?: string
          instagram_account_id?: string | null
          photo_path?: string | null
          product_url?: string | null
          reels_per_day?: number
          registration_email?: string | null
          starter_reels?: string[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_profile_drafts_instagram_account_id_workspace_id_fkey"
            columns: ["instagram_account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "instagram_profile_drafts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_story_reminders: {
        Row: {
          audience: string
          created_at: string
          filename: string
          id: string
          instagram_account_id: string
          link_title: string | null
          link_url: string | null
          mime_type: string
          scheduled_at: string
          state: string
          sticker_x: number
          sticker_y: number
          stickers: Json | null
          storage_path: string
          workspace_id: string
        }
        Insert: {
          audience?: string
          created_at?: string
          filename: string
          id: string
          instagram_account_id: string
          link_title?: string | null
          link_url?: string | null
          mime_type: string
          scheduled_at: string
          state?: string
          sticker_x: number
          sticker_y: number
          stickers?: Json | null
          storage_path: string
          workspace_id: string
        }
        Update: {
          audience?: string
          created_at?: string
          filename?: string
          id?: string
          instagram_account_id?: string
          link_title?: string | null
          link_url?: string | null
          mime_type?: string
          scheduled_at?: string
          state?: string
          sticker_x?: number
          sticker_y?: number
          stickers?: Json | null
          storage_path?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_story_reminders_instagram_account_id_workspace_i_fkey"
            columns: ["instagram_account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "instagram_story_reminders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_tokens: {
        Row: {
          access_token_ciphertext: string
          account_id: string
          analytics_access_token_ciphertext: string | null
          analytics_token_expires_at: string | null
          encryption_key_version: string | null
          refresh_token_ciphertext: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token_ciphertext: string
          account_id: string
          analytics_access_token_ciphertext?: string | null
          analytics_token_expires_at?: string | null
          encryption_key_version?: string | null
          refresh_token_ciphertext?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token_ciphertext?: string
          account_id?: string
          analytics_access_token_ciphertext?: string | null
          analytics_token_expires_at?: string | null
          encryption_key_version?: string | null
          refresh_token_ciphertext?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_tokens_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          archived_at: string | null
          checksum_sha256: string | null
          created_at: string
          duration_seconds: number | null
          height: number | null
          id: string
          import_batch_id: string | null
          import_folder: string | null
          import_position: number | null
          mime_type: string
          original_filename: string
          processing_error: string | null
          reel_account_id: string | null
          size_bytes: number
          status: Database["public"]["Enums"]["media_status"]
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          width: number | null
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          checksum_sha256?: string | null
          created_at?: string
          duration_seconds?: number | null
          height?: number | null
          id?: string
          import_batch_id?: string | null
          import_folder?: string | null
          import_position?: number | null
          mime_type: string
          original_filename: string
          processing_error?: string | null
          reel_account_id?: string | null
          size_bytes: number
          status?: Database["public"]["Enums"]["media_status"]
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          checksum_sha256?: string | null
          created_at?: string
          duration_seconds?: number | null
          height?: number | null
          id?: string
          import_batch_id?: string | null
          import_folder?: string | null
          import_position?: number | null
          mime_type?: string
          original_filename?: string
          processing_error?: string | null
          reel_account_id?: string | null
          size_bytes?: number
          status?: Database["public"]["Enums"]["media_status"]
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reel_media_account_same_workspace"
            columns: ["reel_account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_post_id_workspace_id_fkey"
            columns: ["post_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      post_metrics_snapshots: {
        Row: {
          captured_at: string
          comments: number | null
          id: string
          likes: number | null
          post_id: string
          raw_metrics: Json
          reach: number | null
          saves: number | null
          shares: number | null
          views: number | null
          workspace_id: string
        }
        Insert: {
          captured_at?: string
          comments?: number | null
          id?: string
          likes?: number | null
          post_id: string
          raw_metrics?: Json
          reach?: number | null
          saves?: number | null
          shares?: number | null
          views?: number | null
          workspace_id: string
        }
        Update: {
          captured_at?: string
          comments?: number | null
          id?: string
          likes?: number | null
          post_id?: string
          raw_metrics?: Json
          reach?: number | null
          saves?: number | null
          shares?: number | null
          views?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_metrics_snapshots_post_id_workspace_id_fkey"
            columns: ["post_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "post_metrics_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      postkit_device_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          revoked_at: string | null
          token_hash: string
          used_at: string | null
          used_by: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          revoked_at?: string | null
          token_hash: string
          used_at?: string | null
          used_by?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          revoked_at?: string | null
          token_hash?: string
          used_at?: string | null
          used_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "postkit_device_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          attempt_count: number
          caption: string
          content_type: string
          cover_asset_id: string | null
          created_at: string
          created_by: string | null
          first_comment: string | null
          first_comment_attempted_at: string | null
          first_comment_status: string | null
          hashtags: string[]
          id: string
          idempotency_key: string
          instagram_account_id: string
          last_error_code: string | null
          last_error_message: string | null
          media_asset_id: string
          meta_container_id: string | null
          meta_media_id: string | null
          next_attempt_at: string | null
          permalink: string | null
          processing_started_at: string | null
          publish_phase: string
          published_at: string | null
          schedule_id: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["post_status"]
          timezone: string
          updated_at: string
          worker_lease_id: string | null
          worker_lease_until: string | null
          workspace_id: string
        }
        Insert: {
          attempt_count?: number
          caption?: string
          content_type?: string
          cover_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          first_comment?: string | null
          first_comment_attempted_at?: string | null
          first_comment_status?: string | null
          hashtags?: string[]
          id?: string
          idempotency_key?: string
          instagram_account_id: string
          last_error_code?: string | null
          last_error_message?: string | null
          media_asset_id: string
          meta_container_id?: string | null
          meta_media_id?: string | null
          next_attempt_at?: string | null
          permalink?: string | null
          processing_started_at?: string | null
          publish_phase?: string
          published_at?: string | null
          schedule_id?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          timezone?: string
          updated_at?: string
          worker_lease_id?: string | null
          worker_lease_until?: string | null
          workspace_id: string
        }
        Update: {
          attempt_count?: number
          caption?: string
          content_type?: string
          cover_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          first_comment?: string | null
          first_comment_attempted_at?: string | null
          first_comment_status?: string | null
          hashtags?: string[]
          id?: string
          idempotency_key?: string
          instagram_account_id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          media_asset_id?: string
          meta_container_id?: string | null
          meta_media_id?: string | null
          next_attempt_at?: string | null
          permalink?: string | null
          processing_started_at?: string | null
          publish_phase?: string
          published_at?: string | null
          schedule_id?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          timezone?: string
          updated_at?: string
          worker_lease_id?: string | null
          worker_lease_until?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_instagram_account_id_workspace_id_fkey"
            columns: ["instagram_account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "posts_media_asset_id_workspace_id_fkey"
            columns: ["media_asset_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "posts_schedule_id_workspace_id_fkey"
            columns: ["schedule_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "publishing_schedules"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "posts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reel_cover_same_workspace"
            columns: ["cover_asset_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      publish_attempts: {
        Row: {
          attempt_number: number
          created_at: string
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          meta_container_id: string | null
          meta_media_id: string | null
          post_id: string
          request_id: string | null
          started_at: string
          status: string
          workspace_id: string
        }
        Insert: {
          attempt_number: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          meta_container_id?: string | null
          meta_media_id?: string | null
          post_id: string
          request_id?: string | null
          started_at?: string
          status: string
          workspace_id: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          meta_container_id?: string | null
          meta_media_id?: string | null
          post_id?: string
          request_id?: string | null
          started_at?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_attempts_post_id_workspace_id_fkey"
            columns: ["post_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "publish_attempts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      publish_logs: {
        Row: {
          created_at: string
          details: Json
          event: string
          id: number
          level: string
          message: string
          post_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          event: string
          id?: never
          level: string
          message: string
          post_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          event?: string
          id?: never
          level?: string
          message?: string
          post_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_logs_post_id_workspace_id_fkey"
            columns: ["post_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "publish_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      publishing_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          daily_limit: number
          enabled: boolean
          id: string
          instagram_account_id: string
          minimum_interval_minutes: number
          name: string
          time_slots: string[]
          timezone: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          daily_limit?: number
          enabled?: boolean
          id?: string
          instagram_account_id: string
          minimum_interval_minutes?: number
          name?: string
          time_slots?: string[]
          timezone?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          daily_limit?: number
          enabled?: boolean
          id?: string
          instagram_account_id?: string
          minimum_interval_minutes?: number
          name?: string
          time_slots?: string[]
          timezone?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publishing_schedules_instagram_account_id_workspace_id_fkey"
            columns: ["instagram_account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "publishing_schedules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_postkit_device_invite: {
        Args: { p_token_hash: string }
        Returns: string
      }
      cancel_scheduled_instagram_post: {
        Args: { p_post_id: string }
        Returns: boolean
      }
      checkpoint_instagram_publish: {
        Args: {
          p_container_id?: string
          p_error_code?: string
          p_lease_id: string
          p_media_id?: string
          p_outcome: string
          p_post_id: string
        }
        Returns: boolean
      }
      claim_due_instagram_posts: {
        Args: { p_limit?: number }
        Returns: {
          attempt_count: number
          caption: string
          content_type: string
          cover_asset_id: string | null
          created_at: string
          created_by: string | null
          first_comment: string | null
          first_comment_attempted_at: string | null
          first_comment_status: string | null
          hashtags: string[]
          id: string
          idempotency_key: string
          instagram_account_id: string
          last_error_code: string | null
          last_error_message: string | null
          media_asset_id: string
          meta_container_id: string | null
          meta_media_id: string | null
          next_attempt_at: string | null
          permalink: string | null
          processing_started_at: string | null
          publish_phase: string
          published_at: string | null
          schedule_id: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["post_status"]
          timezone: string
          updated_at: string
          worker_lease_id: string | null
          worker_lease_until: string | null
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_instagram_analytics: { Args: never; Returns: Json }
      claim_instagram_first_comment: {
        Args: never
        Returns: {
          first_comment: string
          id: string
          instagram_account_id: string
          meta_media_id: string
          workspace_id: string
        }[]
      }
      claim_instagram_publish_step: {
        Args: never
        Returns: {
          attempt_count: number
          caption: string
          content_type: string
          cover_asset_id: string | null
          created_at: string
          created_by: string | null
          first_comment: string | null
          first_comment_attempted_at: string | null
          first_comment_status: string | null
          hashtags: string[]
          id: string
          idempotency_key: string
          instagram_account_id: string
          last_error_code: string | null
          last_error_message: string | null
          media_asset_id: string
          meta_container_id: string | null
          meta_media_id: string | null
          next_attempt_at: string | null
          permalink: string | null
          processing_started_at: string | null
          publish_phase: string
          published_at: string | null
          schedule_id: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["post_status"]
          timezone: string
          updated_at: string
          worker_lease_id: string | null
          worker_lease_until: string | null
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_instagram_reel_loops: {
        Args: {
          p_account_ids: string[]
          p_asset_ids: string[]
          p_caption: string
          p_interval_minutes: number
          p_name: string
          p_start_at: string
          p_workspace_id: string
        }
        Returns: number
      }
      create_postkit_device_invite: {
        Args: { p_token_hash: string; p_workspace_id: string }
        Returns: undefined
      }
      enable_instagram_worker: { Args: never; Returns: boolean }
      enqueue_due_instagram_reel_loops: { Args: never; Returns: number }
      ensure_postkit_workspace: {
        Args: never
        Returns: {
          created_at: string
          id: string
          name: string
          owner_id: string
          timezone: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "workspaces"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      finish_instagram_analytics: {
        Args: { p_account: string; p_lease: string; p_result: Json }
        Returns: boolean
      }
      finish_instagram_first_comment: {
        Args: { p_id: string; p_result: string }
        Returns: boolean
      }
      get_instagram_analytics: {
        Args: {
          p_account: string
          p_end: string
          p_page: number
          p_start: string
          p_workspace: string
        }
        Returns: Json
      }
      get_instagram_top_posts: {
        Args: { p_account: string; p_workspace: string }
        Returns: Json
      }
      has_workspace_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["workspace_role"][]
          target_workspace: string
        }
        Returns: boolean
      }
      instagram_worker_is_active: { Args: never; Returns: boolean }
      is_workspace_member: {
        Args: { target_workspace: string }
        Returns: boolean
      }
      list_instagram_reel_loops: {
        Args: { p_workspace_id: string }
        Returns: {
          account_id: string
          asset_index: number
          id: string
          interval_minutes: number
          name: string
          next_at: string
          pause_reason: string
          state: string
          total: number
          username: string
        }[]
      }
      revoke_postkit_device_invite: {
        Args: { p_token_hash: string }
        Returns: undefined
      }
      save_instagram_unified_accounts: {
        Args: {
          p_accounts: Json
          p_expires_at: string
          p_scopes: string[]
          p_token_ciphertext: string
          p_user_id: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      set_instagram_reel_loop_paused: {
        Args: { p_id: string; p_paused: boolean }
        Returns: boolean
      }
      verify_instagram_worker_secret: {
        Args: { p_token: string }
        Returns: boolean
      }
    }
    Enums: {
      instagram_connection_status:
        | "pending"
        | "connected"
        | "expired"
        | "revoked"
        | "error"
      media_status: "uploaded" | "processing" | "ready" | "failed" | "archived"
      post_status:
        | "draft"
        | "scheduled"
        | "processing"
        | "published"
        | "failed"
        | "paused"
        | "cancelled"
        | "needs_review"
      workspace_role: "owner" | "admin" | "editor" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      instagram_connection_status: [
        "pending",
        "connected",
        "expired",
        "revoked",
        "error",
      ],
      media_status: ["uploaded", "processing", "ready", "failed", "archived"],
      post_status: [
        "draft",
        "scheduled",
        "processing",
        "published",
        "failed",
        "paused",
        "cancelled",
        "needs_review",
      ],
      workspace_role: ["owner", "admin", "editor", "viewer"],
    },
  },
} as const
