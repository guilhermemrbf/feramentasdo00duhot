import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/meta-checkout/$pixel")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { receiveMetaCheckout } = await import("@/lib/meta-ads/service.server");
        return receiveMetaCheckout(request, params.pixel);
      },
    },
  },
});
