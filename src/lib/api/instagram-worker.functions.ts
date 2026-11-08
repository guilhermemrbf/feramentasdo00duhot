import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { PostkitDatabase } from "@/lib/postkit-database";

const workspaceInput = z.object({ workspaceId: z.string().uuid() });

async function requireWorkspaceAdmin(
  context: { supabase: SupabaseClient<Database> },
  workspaceId: string,
) {
  const { data, error } = await context.supabase.rpc("has_workspace_role", {
    target_workspace: workspaceId,
    allowed_roles: ["owner", "admin"],
  });
  if (error || data !== true) throw new Error("Workspace administrator access required.");
}

export const getInstagramWorkerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(workspaceInput)
  .handler(async ({ data, context }) => {
    await requireWorkspaceAdmin(context, data.workspaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as SupabaseClient<PostkitDatabase>;
    const { data: active, error } = await client.rpc("instagram_worker_is_active");
    if (error) throw new Error("Could not read Instagram worker status.");
    return { active };
  });

export const enableInstagramWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(workspaceInput)
  .handler(async ({ data, context }) => {
    await requireWorkspaceAdmin(context, data.workspaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as SupabaseClient<PostkitDatabase>;
    const { data: active, error } = await client.rpc("enable_instagram_worker");
    if (error || active !== true) throw new Error("Could not activate Instagram worker.");
    return { active: true };
  });
