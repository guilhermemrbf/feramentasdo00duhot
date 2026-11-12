import { createFileRoute, redirect } from "@tanstack/react-router";
import { LegacyLocalWorkspace } from "@/components/hot-profiles/LegacyLocalWorkspace";
import { CloudWorkspace } from "@/components/hot-profiles/CloudWorkspace";

export const Route = createFileRoute("/hot-profiles")({
  head: () => ({
    meta: [
      { property: "og:title", content: "Hot Profiles — MauseHot" },
      { property: "og:description", content: "Prepare seus perfis profissionais e organize o conteúdo inicial para Instagram." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Hot Profiles — MauseHot" },
      {
        name: "description",
        content: "Prepare seus perfis profissionais e organize o conteúdo inicial para Instagram.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { mode?: "local" | "cloud" } => ({
    mode: search.mode === "cloud" || search.mode === "local" ? search.mode : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (!search.mode)
      throw redirect({ to: "/automacao-instagram", search: { tab: "perfis" }, replace: true });
  },
  component: HotProfiles,
});

function HotProfiles() {
  const { mode } = Route.useSearch();
  return mode === "cloud" ? <CloudWorkspace /> : <LegacyLocalWorkspace />;
}
