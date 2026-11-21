import { ArrowUpRight, CalendarClock, FolderOpen, Instagram } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, TOOL_ICONS } from "@/components/AppShell";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import { accessForRoute } from "@/lib/platform-access";
import { CATEGORIES, TOOL_CATALOG } from "@/lib/tool-catalog";

export const Route = createFileRoute("/painel")({
  head: () => ({ meta: [{ title: "Visão geral | MouseHot" }] }),
  component: WorkspaceHome,
});

function WorkspaceHome() {
  const { status } = usePlatformAccess();
  const tools = TOOL_CATALOG.filter((tool) => status && accessForRoute(tool.path, status));
  const hasPublishing = tools.some((tool) => tool.id === "social");
  return (
    <AppShell>
      <main className="workspace-overview mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-9">
        <header className="operate-heading">
          <div>
            <h1>Visão geral</h1>
            <p>Encontre as ferramentas para a próxima etapa do seu conteúdo.</p>
          </div>
          {status === "admin" && (
            <Link to="/aprovacoes" className="saas-button saas-button-outline">
              Gerenciar acessos <ArrowUpRight size={17} aria-hidden />
            </Link>
          )}
        </header>
        {hasPublishing && (
          <section className="workspace-feature" aria-labelledby="workspace-publishing">
            <div>
              <div className="workspace-feature-icon">
                <Instagram size={26} aria-hidden />
              </div>
              <h2 id="workspace-publishing">Sua operação no Instagram</h2>
              <p>Organize os Reels de cada perfil, agende publicações e acompanhe o histórico.</p>
              <Link to="/automacao-instagram" className="tool-action">
                Abrir Automatic Post <ArrowUpRight size={17} aria-hidden />
              </Link>
            </div>
            <ul className="workspace-feature-flow">
              <li>
                <FolderOpen size={19} aria-hidden />
                <span>Biblioteca de Reels</span>
              </li>
              <li>
                <CalendarClock size={19} aria-hidden />
                <span>Fila de publicações</span>
              </li>
            </ul>
          </section>
        )}
        <section className="workspace-directory" aria-labelledby="workspace-tools">
          <h2 id="workspace-tools">
            {status === "trial" ? "Ferramentas do seu teste" : "Todas as ferramentas"}
          </h2>
          {CATEGORIES.map((category) => {
            const group = tools.filter((tool) => tool.category === category);
            if (!group.length) return null;
            return (
              <section className="workspace-directory-group" key={category} aria-label={category}>
                <h3>{category}</h3>
                <ul>
                  {group.map((tool) => {
                    const Icon = TOOL_ICONS[tool.id];
                    return (
                      <li key={tool.id}>
                        <Link to={tool.path}>
                          <Icon size={20} aria-hidden />
                          <span>
                            <strong>{tool.name}</strong>
                            <small>{tool.summary}</small>
                          </span>
                          <ArrowUpRight className="directory-arrow" size={17} aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </section>
      </main>
    </AppShell>
  );
}
