import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { AppShell, TOOL_ICONS } from "@/components/AppShell";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import { accessForRoute } from "@/lib/platform-access";
import { CATEGORIES, TOOL_CATALOG } from "@/lib/tool-catalog";

export const Route = createFileRoute("/ferramentas")({
  head: () => ({ meta: [{ title: "Ferramentas | Mousefy" }] }),
  component: ToolsPage,
});

function ToolsPage() {
  const { status } = usePlatformAccess();
  const tools = TOOL_CATALOG.filter((tool) => status && accessForRoute(tool.path, status)).sort(
    (first, second) =>
      Number(second.id === "social") - Number(first.id === "social") ||
      CATEGORIES.indexOf(first.category) - CATEGORIES.indexOf(second.category),
  );
  return (
    <AppShell>
      <main className="workspace-overview mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-9">
        <header className="operate-heading">
          <div>
            <h1>{status === "trial" ? "Ferramentas do seu teste" : "Ferramentas"}</h1>
            <p>Escolha a ferramenta que você quer usar.</p>
          </div>
        </header>
        <ul className="workspace-directory-cards">
          {tools.map((tool) => {
            const Icon = TOOL_ICONS[tool.id];
            const headingId = `workspace-tool-${tool.id}`;
            return (
              <li key={tool.id}>
                <article className="workspace-feature" aria-labelledby={headingId}>
                  <div className="workspace-feature-brand">
                    <span className="workspace-feature-icon">
                      <Icon size={19} aria-hidden />
                    </span>
                    <h2 id={headingId}>{tool.name}</h2>
                  </div>
                  <p className="workspace-feature-description">{tool.summary}</p>
                  <Link
                    to={tool.path}
                    className="workspace-feature-open"
                    aria-label={`Abrir ${tool.name}`}
                  >
                    Abrir <ArrowUpRight size={16} aria-hidden />
                  </Link>
                </article>
              </li>
            );
          })}
        </ul>
      </main>
    </AppShell>
  );
}
