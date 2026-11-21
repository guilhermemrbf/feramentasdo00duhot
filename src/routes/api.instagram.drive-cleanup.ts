import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticateInstagramWorkerRequest } from "@/lib/instagram-worker-auth.server";
import type { PostkitDatabase } from "@/lib/postkit-database";

export const Route = createFileRoute("/api/instagram/drive-cleanup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await authenticateInstagramWorkerRequest(request);
        if (unauthorized) return unauthorized;
        const [{ supabaseAdmin }, { cleanupDriveStaging }] = await Promise.all([
          import("@/integrations/supabase/client.server"),
          import("@/lib/instagram-drive-publishing.server"),
        ]);
        const ok = await cleanupDriveStaging(
          supabaseAdmin as unknown as SupabaseClient<PostkitDatabase>,
        );
        return Response.json({ ok }, { status: ok ? 200 : 503 });
      },
    },
  },
});
