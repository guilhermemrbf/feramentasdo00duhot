import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/vendas/webhook/")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const value = request.headers.get("authorization") ?? "";
        const token = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(value)?.[1] ?? "";
        const { receiveSalesWebhook } = await import("@/lib/sales.server");
        return receiveSalesWebhook(request, token);
      },
    },
  },
});
