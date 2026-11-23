import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/meta-syncpay/$pixel")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { receiveMetaSyncpay } = await import("@/lib/meta-ads/service.server");
        return receiveMetaSyncpay(request, params.pixel);
      },
    },
  },
});
