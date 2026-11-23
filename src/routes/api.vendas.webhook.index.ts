import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/vendas/webhook/")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { receiveSalesWebhook, salesWebhookToken } = await import("@/lib/sales.server");
        return receiveSalesWebhook(request, salesWebhookToken(request.headers));
      },
    },
  },
});
