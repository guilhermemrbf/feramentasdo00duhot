import { createFileRoute } from "@tanstack/react-router";
import { CloudWorkspace } from "@/components/hot-profiles/CloudWorkspace";

export const Route = createFileRoute("/hot-profiles")({
  head: () => ({
    meta: [
      { title: "Hot Profiles — 00duHot" },
      {
        name: "description",
        content: "Perfis, proxies e ambientes na nuvem, acessados pelo site.",
      },
    ],
  }),
  component: CloudWorkspace,
});
