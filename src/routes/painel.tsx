import { ArrowUpRight, Check } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, TOOL_ICONS } from "@/components/AppShell";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import { accessForRoute } from "@/lib/platform-access";
import { CATEGORIES, TOOL_CATALOG, type Tool } from "@/lib/tool-catalog";

export const Route = createFileRoute("/painel")({
  head: () => ({ meta: [{ title: "Visão geral | MouseHot" }] }),
  component: WorkspaceHome,
});

function WorkspaceHome() {
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
            <h1>Visão geral</h1>
            <p>Prepare seus arquivos, planeje publicações e gerencie suas contas.</p>
          </div>
        </header>
        <section className="workspace-directory" aria-labelledby="workspace-tools">
          <h2 id="workspace-tools">
            {status === "trial" ? "Ferramentas do seu teste" : "Todas as ferramentas"}
          </h2>
          <div className="workspace-directory-cards">
            {tools.map((tool) => (
              <ToolOverviewCard key={tool.id} tool={tool} />
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}

function ToolOverviewCard({ tool }: { tool: Tool }) {
  const Icon = TOOL_ICONS[tool.id];
  const headingId = `workspace-tool-${tool.id}`;

  return (
    <article className="workspace-feature" aria-labelledby={headingId}>
      <div>
        <div className="workspace-feature-brand">
          <span className="workspace-feature-icon">
            <Icon size={25} aria-hidden />
          </span>
          <h3 id={headingId}>{tool.name}</h3>
        </div>
        <p className="workspace-feature-title">{tool.overview.title}</p>
        <p className="workspace-feature-description">{tool.summary}</p>
        <Link to={tool.path} className="tool-action" aria-label={`Abrir ${tool.name}`}>
          Abrir <ArrowUpRight size={17} aria-hidden />
        </Link>
      </div>
      <ul className="workspace-feature-flow">
        {tool.overview.highlights.map((highlight) => (
          <li key={highlight}>
            <Check size={18} aria-hidden />
            {highlight}
          </li>
        ))}
      </ul>
    </article>
  );
}
