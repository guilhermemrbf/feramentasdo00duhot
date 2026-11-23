import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/vendas/ads/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { finishGoogleAds } = await import("@/lib/tracking/google-oauth.server");
        return finishGoogleAds(request);
      },
    },
  },
});
