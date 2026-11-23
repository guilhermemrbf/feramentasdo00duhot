import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/vendas/webhook/$connection")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { receiveSalesWebhook } = await import("@/lib/sales.server");
        return receiveSalesWebhook(request, params.connection);
      },
    },
  },
});
