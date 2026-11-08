import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostkitDatabase } from "@/lib/postkit-database";

export async function authenticateInstagramWorkerRequest(
  request: Request,
): Promise<Response | null> {
  const token = /^Bearer ([A-Za-z0-9_-]{43,})$/.exec(
    request.headers.get("authorization") ?? "",
  )?.[1];
  if (!token) return new Response("Unauthorized", { status: 401 });

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as SupabaseClient<PostkitDatabase>;
    const { data: valid, error } = await client.rpc("verify_instagram_worker_secret", {
      p_token: token,
    });
    if (error) {
      console.error("[Instagram worker] Authorization check failed.");
      return new Response("Server configuration error", { status: 500 });
    }
    if (valid !== true) return new Response("Unauthorized", { status: 401 });
    return null;
  } catch {
    console.error("[Instagram worker] Authorization check failed.");
    return new Response("Server configuration error", { status: 500 });
  }
}
