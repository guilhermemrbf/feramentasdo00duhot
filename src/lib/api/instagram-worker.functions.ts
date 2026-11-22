import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requirePlatformAccess } from "@/integrations/supabase/platform-middleware";
import type { PostkitDatabase } from "@/lib/postkit-database";

const workspaceInput = z.object({ workspaceId: z.string().uuid() });

export const getInstagramWorkerStatus = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(workspaceInput)
  .handler(async ({ data, context }) => {
    const { data: allowed, error: accessError } = await context.supabase.rpc("has_workspace_role", {
      target_workspace: data.workspaceId,
      allowed_roles: ["owner", "admin", "editor"],
    });
    if (accessError || !allowed) throw new Error("Workspace access required.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as SupabaseClient<PostkitDatabase>;
    const { data: active, error } = await client.rpc("instagram_worker_is_active");
    if (error) throw new Error("Could not read Instagram worker status.");
    return { active };
  });

export const enableInstagramWorker = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(workspaceInput)
  .handler(async ({ data, context }) => {
    const { data: allowed, error: accessError } = await context.supabase.rpc("has_workspace_role", {
      target_workspace: data.workspaceId,
      allowed_roles: ["owner", "admin"],
    });
    if (accessError) {
      console.error("[Instagram worker] Activation access check failed", accessError.code);
      return { active: false, reason: "unavailable" } as const;
    }
    if (allowed !== true) return { active: false, reason: "permission" } as const;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as SupabaseClient<PostkitDatabase>;
    const { data: active, error } = await client.rpc("enable_instagram_worker");
    if (error) {
      console.error("[Instagram worker] Activation RPC failed", error.code);
      return { active: false, reason: "unavailable" } as const;
    }
    if (active !== true) return { active: false, reason: "configuration" } as const;
    return { active: true } as const;
  });
