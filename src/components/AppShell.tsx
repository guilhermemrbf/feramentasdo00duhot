import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  CircleHelp,
  Download,
  FileKey,
  GitBranch,
  Home,
  Image,
  Instagram,
  ScanSearch,
  Mail,
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
import {
  CATEGORIES,
  TOOL_CATALOG,
  findTool,
  normalizeSearch,
  searchTools,
  type Tool,
} from "@/lib/tool-catalog";
import { recordTool, useToolPreferences } from "@/lib/tool-preferences";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const TOOL_ICONS = {
  controlHub: MonitorSmartphone,
  telegram: Send,
  images: Image,
  downloader: Download,
  intelligence: ScanSearch,
  pages: PanelTop,
  metadata: FileKey,
  creatives: ShieldCheck,
  preview: Scan,
  social: Instagram,
  funnels: GitBranch,
  profiles: MonitorSmartphone,
  tempMail: Mail,
};
function Brand() {
  return (
    <span className="flex items-center gap-3">
      <img
        src="/brand/mark.png"
        alt=""
        width={44}
        height={44}
        className="brand-mark size-11 shrink-0 rounded-lg object-contain"
      />
      <span>
        <strong className="block text-[17px] font-semibold tracking-tight">MauseHot</strong>
        <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">
          Suas ferramentas, sem complicação
        </span>
      </span>
    </span>
  );
}

export function AppShell({
  children,
}: {
  children: ReactNode | ((openTools: () => void) => ReactNode);
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = findTool(pathname);
  const currentId = current?.id;
  const isHome = pathname === "/";
  const [mobile, setMobile] = useState(false),
    [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    searchInput = useRef<HTMLInputElement>(null);
  const desktopSidebar = useRef<HTMLElement>(null);
  const { favorites, recent, toggle } = useToolPreferences();
  const shortcuts = [...new Set([...favorites, ...recent.slice(0, 4)])]
    .map((id) => TOOL_CATALOG.find((tool) => tool.id === id))
    .filter((tool) => tool !== undefined);
  const openTools = () => {
    if (desktopSidebar.current?.getClientRects().length) {
      desktopSidebar.current.querySelector<HTMLAnchorElement>("[data-main-tool]")?.focus();
    } else {
      setMobile(true);
    }
  };
  useEffect(() => {
    if (currentId) recordTool(currentId);
    setMobile(false);
  }, [currentId, pathname]);
  const openSearch = () => {
    setQuery("");
    setMobile(false);
    requestAnimationFrame(() => {
      if (!dialog.current?.open) dialog.current?.showModal();
      searchInput.current?.focus();
    });
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
  const nav = (tool: Tool, shortcut = false) => {
    const Icon = TOOL_ICONS[tool.id];
    const active = currentId === tool.id;
    const favorite = favorites.includes(tool.id);
    return (
      <div key={tool.id} className="flex min-w-0 items-center gap-0.5">
        <Link
          to={tool.path}
          data-main-tool={shortcut ? undefined : ""}
          onClick={() => setMobile(false)}
          aria-current={active ? "page" : undefined}
          className={cn("tool-nav-link min-w-0 flex-1 gap-2.5", active && "is-active")}
        >
          <Icon
            className="tool-tone size-[17px] shrink-0"
            data-tone={normalizeSearch(tool.category)}
            aria-hidden
          />
          <span className="min-w-0 flex-1 leading-tight break-words">{tool.name}</span>
        </Link>
        {!shortcut && (
          <button
            type="button"
            onClick={() => toggle(tool.id)}
            aria-pressed={favorite}
            aria-label={`${favorite ? "Remover" : "Adicionar"} ${tool.name} ${favorite ? "dos" : "aos"} favoritos`}
            className="grid min-h-11 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-brand-red aria-pressed:text-brand-red"
          >
            <Star className={cn("size-3.5", favorite && "fill-current")} aria-hidden />
          </button>
        )}
      </div>
    );
  };
  const sidebar = (
    <>
      <Link
        to="/"
        onClick={() => setMobile(false)}
        aria-label="MauseHot, início"
        className="border-b border-border px-5 py-5"
      >
        <Brand />
      </Link>
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <button
          onClick={openSearch}
          className="mb-5 flex min-h-11 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-foreground"
        >
          <Search className="size-4" />
          Buscar ferramenta<kbd className="ml-auto text-[10px]">Ctrl K</kbd>
        </button>
        <nav aria-label="Navegação principal">
          <Link
            to="/"
            onClick={() => setMobile(false)}
            aria-current={isHome ? "page" : undefined}
            className={cn("tool-nav-link mb-4", isHome && "is-active")}
          >
            <Home className="size-[17px]" />
            Visão geral
          </Link>
          {shortcuts.length > 0 && (
            <details className="group mb-5 rounded-lg border border-border px-1">
              <summary className="flex min-h-11 list-none items-center gap-2 px-2 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                <Star className="size-3.5" aria-hidden />
                Favoritas e recentes
                <ChevronDown className="ml-auto size-3.5 group-open:rotate-180" aria-hidden />
              </summary>
              <div className="pb-1">{shortcuts.map((tool) => nav(tool, true))}</div>
            </details>
          )}
          {CATEGORIES.filter((category) =>
            TOOL_CATALOG.some((tool) => tool.category === category),
          ).map((category) => (
            <div key={category} className="mb-5">
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </p>
              {TOOL_CATALOG.filter((tool) => tool.category === category).map((tool) => nav(tool))}
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-border px-5 py-4 text-xs leading-5 text-muted-foreground">
        <span className="block font-medium text-foreground">Tudo em um só lugar</span>Conteúdo,
        preparação e automação.
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          <a href="/privacidade" className="underline underline-offset-4 hover:text-foreground">
            Privacidade
          </a>
          <a
            href="/exclusao-de-dados"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Exclusão de dados
          </a>
        </div>
      </div>
    </>
  );

  return (
    <div className="app-workspace min-h-screen bg-background text-foreground">
      <a href="#workspace-main" className="skip-link">
        Pular para o conteúdo
      </a>
      <aside ref={desktopSidebar} className="workspace-sidebar hidden lg:flex">
        {sidebar}
      </aside>
      <div className="lg:pl-[244px]">
        <header className="workspace-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={mobile} onOpenChange={setMobile}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Abrir menu de ferramentas"
                  className="grid size-11 shrink-0 place-items-center rounded-lg border border-border hover:border-primary hover:bg-accent lg:hidden"
                >
                  <Menu className="size-5" aria-hidden />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                aria-describedby={undefined}
                className="workspace-sidebar mobile-sidebar flex w-[min(320px,86vw)] gap-0 p-0"
                onCloseAutoFocus={(event) => {
                  if (dialog.current?.open) event.preventDefault();
                }}
              >
                <SheetTitle className="sr-only">Menu de ferramentas</SheetTitle>
                {sidebar}
              </SheetContent>
            </Sheet>
            <Link to="/" aria-label="MauseHot, início" className="shrink-0 sm:hidden">
              <img
                src="/brand/mark.png"
                alt=""
                width={32}
                height={32}
                className="brand-mark size-8 rounded-md object-contain"
              />
            </Link>
            {!isHome && (
              <>
                <Link
                  to="/"
                  className="hidden text-xs text-muted-foreground hover:text-foreground sm:block"
                >
                  Início
                </Link>
                <span className="hidden text-muted-foreground/40 sm:block">/</span>
              </>
            )}
            <span className="truncate text-sm font-semibold">{current?.name || "Visão geral"}</span>
          </div>
          {!isHome && (
            <button
              onClick={openSearch}
              aria-label="Buscar ferramenta"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground hover:border-primary hover:text-foreground"
            >
              <Search className="size-4" aria-hidden />
              <span className="hidden sm:inline">Buscar</span>
            </button>
          )}
        </header>
        <div id="workspace-main" tabIndex={-1}>
          {current && (current.id === "profiles" || current.id === "funnels") && (
            <div className="mx-auto max-w-7xl px-5 pt-4 sm:px-8">
              <ToolGuide tool={current} />
            </div>
          )}
          {typeof children === "function" ? children(openTools) : children}
        </div>
        <footer className="workspace-footer">
          <span>MauseHot · Suas ferramentas, sem complicação</span>
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
              O que você quer fazer?
            </h2>
            <button
              type="button"
              aria-label="Fechar busca"
              className="grid size-10 place-items-center rounded-lg border border-border hover:bg-accent"
              onClick={() => dialog.current?.close()}
            >
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
                <Icon
                  className="tool-tone mt-0.5 size-4"
                  data-tone={normalizeSearch(tool.category)}
                  aria-hidden
                />
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
              Nenhuma ferramenta encontrada. Tente “vídeo”, “links” ou “trocar links”.
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
  const Icon = tool ? TOOL_ICONS[tool.id] : PanelTop;
  return (
    <header className="page-intro">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </p>
        {tool && <span className="workspace-badge">{tool.mode}</span>}
      </div>
      <div className="flex items-center gap-4">
        <span className="tool-tone tool-icon grid size-14 shrink-0 place-items-center" aria-hidden>
          <Icon className="size-7" />
        </span>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{description}</p>
      {tool && <ToolGuide tool={tool} />}
    </header>
  );
}

function ToolGuide({ tool }: { tool: Tool }) {
  return (
    <div className="mt-6">
      <p className="mb-3 text-sm font-semibold">Como começar</p>
      <ol className="grid gap-3 md:grid-cols-3">
        {tool.steps.map((step, index) => (
          <li
            key={step}
            className="flex items-start gap-3 rounded-xl border border-border bg-background/60 p-3 text-sm leading-6"
          >
            <span
              className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
              aria-hidden
            >
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <details className="tool-guide">
        <summary>
          <CircleHelp className="size-4" aria-hidden />
          <span>O que preciso para usar?</span>
        </summary>
        <div className="space-y-4 px-4 pb-5 pt-2 sm:px-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold">Antes de começar</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{tool.input}</p>
            </div>
            <div>
              <h2 className="text-sm font-semibold">Seu resultado</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{tool.output}</p>
            </div>
          </div>
          <p className="rounded-lg bg-background px-3 py-3 text-sm leading-6 text-muted-foreground">
            {tool.requirement}
          </p>
        </div>
      </details>
    </div>
  );
}
