import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/meta-process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { processMetaQueue } = await import("@/lib/meta-ads/service.server");
        return processMetaQueue(request);
      },
    },
  },
});
