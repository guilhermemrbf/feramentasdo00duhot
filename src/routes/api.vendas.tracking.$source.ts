import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/vendas/tracking/$source")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { receiveTrackingRequest } = await import("@/lib/tracking/attribution.server");
        return receiveTrackingRequest(request, params.source);
      },
    },
  },
});
