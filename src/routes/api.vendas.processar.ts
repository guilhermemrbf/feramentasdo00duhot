import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/vendas/processar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { hashSalesKey, processSalesPush, salesKeyMatches, salesPushConfig } =
          await import("@/lib/sales.server");
        const key = process.env.SALES_PUSH_WORKER_SECRET?.trim();
        if (
          !key ||
          key.length < 32 ||
          !salesKeyMatches(request.headers.get("authorization"), hashSalesKey("Bearer " + key))
        )
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        if (!salesPushConfig()) return Response.json({ error: "Not configured" }, { status: 503 });
        try {
          return Response.json({ processed: await processSalesPush() });
        } catch {
          return Response.json({ error: "Unavailable" }, { status: 503 });
        }
      },
    },
  },
});
