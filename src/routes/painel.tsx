import { ArrowUpRight, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, TOOL_ICONS } from "@/components/AppShell";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import { dashboardGreeting } from "@/lib/dashboard-greeting";
import { accessForRoute } from "@/lib/platform-access";
import { CATEGORIES, TOOL_CATALOG, type Tool } from "@/lib/tool-catalog";
import { SalesDashboard } from "@/components/sales/SalesDashboard";
import { AutomaticPostOverview } from "@/components/postkit/AutomaticPostOverview";

export const Route = createFileRoute("/painel")({
  head: () => ({ meta: [{ title: "Dashboard | MouseHot" }] }),
  component: WorkspaceHome,
});

function WorkspaceHome() {
  const { status, user, offsetMs } = usePlatformAccess();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const tools = TOOL_CATALOG.filter((tool) => status && accessForRoute(tool.path, status)).sort(
    (first, second) =>
      Number(second.id === "social") - Number(first.id === "social") ||
      CATEGORIES.indexOf(first.category) - CATEGORIES.indexOf(second.category),
  );
  const directory = <ToolDirectory tools={tools} trial={status === "trial"} />;
  return (
    <AppShell>
      <main className="workspace-overview mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-9">
        <header className="operate-heading">
          <div>
            <h1>{dashboardGreeting(new Date(now + offsetMs), user, status === "admin")}</h1>
            <p>Acompanhe sua operação e abra as ferramentas da MouseHot.</p>
          </div>
        </header>
        {status === "admin" || status === "approved" ? (
          <SalesDashboard
            embedded
            renderOverview={(period, salesMetrics) => (
              <AutomaticPostOverview period={period} salesMetrics={salesMetrics} />
            )}
          >
            {directory}
          </SalesDashboard>
        ) : (
          directory
        )}
      </main>
    </AppShell>
  );
}

function ToolDirectory({ tools, trial }: { tools: Tool[]; trial: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const expansion = useRef<HTMLLIElement>(null);
  const firstExtra = 3;
  return (
    <section className="workspace-directory mt-8" aria-labelledby="workspace-tools">
      <h2 id="workspace-tools">{trial ? "Ferramentas do seu teste" : "Ferramentas"}</h2>
      <ul className="workspace-directory-cards" id="workspace-tool-grid">
        {tools.map((tool, index) => (
          <li
            key={tool.id}
            hidden={!expanded && index >= firstExtra}
            ref={index === firstExtra ? expansion : undefined}
          >
            <ToolOverviewCard tool={tool} />
          </li>
        ))}
      </ul>
      {tools.length > firstExtra && (
        <button
          type="button"
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted"
          aria-expanded={expanded}
          aria-controls="workspace-tool-grid"
          onClick={() => {
            setExpanded(!expanded);
            if (!expanded)
              requestAnimationFrame(() => expansion.current?.querySelector("a")?.focus());
          }}
        >
          {expanded ? "Mostrar menos ferramentas" : "Ver todas as ferramentas"}
          <ChevronDown size={17} className={expanded ? "rotate-180" : undefined} aria-hidden />
        </button>
      )}
    </section>
  );
}

function ToolOverviewCard({ tool }: { tool: Tool }) {
  const Icon = TOOL_ICONS[tool.id];
  const headingId = `workspace-tool-${tool.id}`;

  return (
    <article className="workspace-feature" aria-labelledby={headingId}>
      <div className="workspace-feature-brand">
        <span className="workspace-feature-icon">
          <Icon size={19} aria-hidden />
        </span>
        <h3 id={headingId}>{tool.name}</h3>
      </div>
      <p className="workspace-feature-description">{tool.summary}</p>
      <Link to={tool.path} className="workspace-feature-open" aria-label={`Abrir ${tool.name}`}>
        Abrir <ArrowUpRight size={16} aria-hidden />
      </Link>
    </article>
  );
}
