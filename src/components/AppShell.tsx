import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  CircleHelp,
  FileKey,
  GitBranch,
  Home,
  Image,
  Layers3,
  Menu,
  MonitorSmartphone,
  PanelTop,
  Search,
  Send,
  ShieldCheck,
  Scan,
  Star,
  X,
} from "lucide-react";
import { TOOL_CATALOG, findTool, searchTools, type Tool } from "@/lib/tool-catalog";
import { recordTool, useToolPreferences } from "@/lib/tool-preferences";
import { cn } from "@/lib/utils";

export const TOOL_ICONS = {
  telegram: Send,
  images: Image,
  pages: PanelTop,
  metadata: FileKey,
  creatives: ShieldCheck,
  preview: Scan,
  social: Layers3,
  funnels: GitBranch,
  profiles: MonitorSmartphone,
};
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <img
        src="/brand/mark.png"
        alt=""
        width={44}
        height={44}
        className="size-11 shrink-0 rounded-lg object-contain"
      />
      <span>
        <strong className="block text-[17px] font-semibold tracking-tight">00duHot</strong>
        {!compact && (
          <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Operação digital
          </span>
        )}
      </span>
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = findTool(pathname);
  const [mobile, setMobile] = useState(false),
    [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    searchInput = useRef<HTMLInputElement>(null);
  const { favorites } = useToolPreferences();
  useEffect(() => {
    if (current) recordTool(current.id);
    setMobile(false);
  }, [current?.id, pathname]);
  const openSearch = () => {
    setQuery("");
    dialog.current?.showModal();
    searchInput.current?.focus();
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else openSearch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const nav = (tool: Tool) => {
    const Icon = TOOL_ICONS[tool.id];
    const active = current?.id === tool.id;
    return (
      <Link
        key={tool.id}
        to={tool.path}
        aria-current={active ? "page" : undefined}
        className={cn("tool-nav-link", active && "is-active")}
      >
        <Icon className="size-[17px] shrink-0" />
        <span className="min-w-0 flex-1 truncate">{tool.name}</span>
        {favorites.includes(tool.id) && (
          <Star className="size-3 shrink-0 fill-current opacity-60" />
        )}
      </Link>
    );
  };
  return (
    <div className="app-workspace min-h-screen bg-background text-foreground">
      <a href="#workspace-main" className="skip-link">
        Pular para o conteúdo
      </a>
      {mobile && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/65 lg:hidden"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={cn("workspace-sidebar", mobile ? "flex" : "hidden lg:flex")}>
        <Link to="/" aria-label="00duHot, início" className="border-b border-border px-5 py-5">
          <Brand />
        </Link>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <button
            onClick={openSearch}
            className="mb-6 flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Search className="size-4" />
            Buscar ferramenta<kbd className="ml-auto text-[10px]">Ctrl K</kbd>
          </button>
          <nav aria-label="Navegação principal">
            <Link
              to="/"
              aria-current={pathname === "/" ? "page" : undefined}
              className={cn("tool-nav-link mb-5", pathname === "/" && "is-active")}
            >
              <Home className="size-[17px]" />
              Visão geral
            </Link>
            {["Conteúdo", "Preparação", "Automação", "Planejamento", "Ambientes"].map(
              (category) => (
                <div key={category} className="mb-5">
                  <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                    {category}
                  </p>
                  {TOOL_CATALOG.filter((tool) => tool.category === category).map(nav)}
                </div>
              ),
            )}
          </nav>
        </div>
        <div className="border-t border-border px-5 py-4 text-xs leading-5 text-muted-foreground">
          <span className="block font-medium text-foreground">Seu centro de operação</span>Conteúdo,
          preparação e automação.
        </div>
      </aside>
      <div className="lg:pl-[244px]">
        <header className="workspace-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="Abrir menu"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
              className="rounded-md p-2 hover:bg-accent lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <Link
              to="/"
              className="hidden text-xs text-muted-foreground hover:text-foreground sm:block"
            >
              Workspace
            </Link>
            <span className="hidden text-muted-foreground/40 sm:block">/</span>
            <span className="truncate text-xs font-medium">{current?.name || "Visão geral"}</span>
          </div>
          <button
            onClick={openSearch}
            aria-label="Buscar ferramenta"
            className="rounded-md border border-border p-2 text-muted-foreground hover:text-foreground"
          >
            <Search className="size-4" />
          </button>
        </header>
        <div id="workspace-main" tabIndex={-1}>
          {current && (current.id === "profiles" || current.id === "funnels") && (
            <div className="mx-auto max-w-7xl px-5 pt-4 sm:px-8">
              <ToolGuide tool={current} />
            </div>
          )}
          {children}
        </div>
        <footer className="workspace-footer">
          <span>00duHot · Operação digital</span>
          <span>Suas ferramentas. Seu ritmo.</span>
        </footer>
      </div>
      <dialog
        ref={dialog}
        aria-labelledby="tool-search-title"
        className="tool-search-dialog"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="border-b border-border p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="tool-search-title" className="font-semibold">
              Encontrar ferramenta
            </h2>
            <button aria-label="Fechar busca" onClick={() => dialog.current?.close()}>
              <X className="size-4" />
            </button>
          </div>
          <label htmlFor="tool-search" className="sr-only">
            Nome ou tarefa que deseja realizar
          </label>
          <input
            ref={searchInput}
            id="tool-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="O que você quer fazer?"
            className="workspace-input"
          />
        </div>
        <div className="max-h-[60vh] overflow-auto p-2">
          {searchTools(query).map((tool) => {
            const Icon = TOOL_ICONS[tool.id];
            return (
              <Link
                key={tool.id}
                to={tool.path}
                onClick={() => dialog.current?.close()}
                className="flex items-start gap-3 rounded-md p-3 hover:bg-accent"
              >
                <Icon className="mt-0.5 size-4 text-primary" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{tool.name}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {tool.summary}
                  </span>
                </span>
                <ArrowUpRight className="size-4 text-muted-foreground" />
              </Link>
            );
          })}
          {!searchTools(query).length && (
            <p className="p-6 text-sm text-muted-foreground">
              Nenhuma ferramenta encontrada. Tente “vídeo”, “links” ou “Telegram”.
            </p>
          )}
        </div>
      </dialog>
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tool = findTool(pathname);
  return (
    <header className="page-intro">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </p>
        {tool && <span className="workspace-badge">{tool.mode}</span>}
      </div>
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{description}</p>
      {tool && <ToolGuide tool={tool} />}
    </header>
  );
}

function ToolGuide({ tool }: { tool: Tool }) {
  return (
    <details className="tool-guide">
      <summary>
        <CircleHelp className="size-4" />
        <span>Como usar · o que você precisa e o que recebe</span>
      </summary>
      <div className="px-4 pb-5 pt-2 sm:px-5">
        <div className="grid gap-5 border-b border-border pb-5 md:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold">Você fornece</h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">{tool.input}</p>
          </div>
          <div>
            <h2 className="text-xs font-semibold">Você recebe</h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">{tool.output}</p>
          </div>
        </div>
        <ol className="my-5 grid gap-4 md:grid-cols-3">
          {tool.steps.map((step, index) => (
            <li key={step} className="flex items-start gap-2 text-xs leading-6">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border border-border text-[10px] text-primary">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="rounded-md bg-background px-3 py-2 text-xs leading-6 text-muted-foreground">
          {tool.requirement}
        </p>
      </div>
    </details>
  );
}
