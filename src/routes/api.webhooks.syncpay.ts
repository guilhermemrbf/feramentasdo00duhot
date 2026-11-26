import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/syncpay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleSyncpayWebhook } = await import("@/lib/syncpay-webhooks.server");
        return handleSyncpayWebhook(request);
      },
    },
  },
});
