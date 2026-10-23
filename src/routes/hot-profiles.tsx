import { createFileRoute } from "@tanstack/react-router";
import { LegacyLocalWorkspace } from "@/components/hot-profiles/LegacyLocalWorkspace";
import { CloudWorkspace } from "@/components/hot-profiles/CloudWorkspace";

export const Route = createFileRoute("/hot-profiles")({
  head: () => ({
    meta: [
      { title: "Hot Profiles — 00duHot" },
      {
        name: "description",
        content: "Perfis, central de proxies e Android local, com nuvem opcional.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { mode?: "local" | "cloud" } => ({
    mode: search.mode === "cloud" ? "cloud" : "local",
  }),
  component: HotProfiles,
});

function HotProfiles() {
  const { mode } = Route.useSearch();
  return mode === "cloud" ? <CloudWorkspace /> : <LegacyLocalWorkspace />;
}
