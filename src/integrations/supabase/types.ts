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
      instagram_tokens: {
        Row: {
          access_token_ciphertext: string
          account_id: string
          encryption_key_version: string | null
          refresh_token_ciphertext: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token_ciphertext: string
          account_id: string
          encryption_key_version?: string | null
          refresh_token_ciphertext?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token_ciphertext?: string
          account_id?: string
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
          mime_type: string
          original_filename: string
          processing_error: string | null
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
          mime_type: string
          original_filename: string
          processing_error?: string | null
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
          mime_type?: string
          original_filename?: string
          processing_error?: string | null
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
      posts: {
        Row: {
          attempt_count: number
          caption: string
          content_type: string
          created_at: string
          created_by: string | null
          hashtags: string[]
          id: string
          idempotency_key: string
          instagram_account_id: string
          last_error_code: string | null
          last_error_message: string | null
          media_asset_id: string
          meta_media_id: string | null
          next_attempt_at: string | null
          permalink: string | null
          published_at: string | null
          schedule_id: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["post_status"]
          timezone: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attempt_count?: number
          caption?: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          hashtags?: string[]
          id?: string
          idempotency_key?: string
          instagram_account_id: string
          last_error_code?: string | null
          last_error_message?: string | null
          media_asset_id: string
          meta_media_id?: string | null
          next_attempt_at?: string | null
          permalink?: string | null
          published_at?: string | null
          schedule_id?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          timezone?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attempt_count?: number
          caption?: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          hashtags?: string[]
          id?: string
          idempotency_key?: string
          instagram_account_id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          media_asset_id?: string
          meta_media_id?: string | null
          next_attempt_at?: string | null
          permalink?: string | null
          published_at?: string | null
          schedule_id?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          timezone?: string
          updated_at?: string
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
      claim_due_instagram_posts: {
        Args: { p_limit?: number }
        Returns: Database["public"]["Tables"]["posts"]["Row"][]
      }
      has_workspace_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["workspace_role"][]
          target_workspace: string
        }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { target_workspace: string }
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
