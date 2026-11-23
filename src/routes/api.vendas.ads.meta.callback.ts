import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/vendas/ads/meta/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { finishMetaAds } = await import("@/lib/tracking/meta-oauth.server");
        return finishMetaAds(request);
      },
    },
  },
});
