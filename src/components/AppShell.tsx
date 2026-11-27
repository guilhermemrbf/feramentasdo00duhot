import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Activity,
  Bell,
  Box,
  LogOut,
  ChevronDown,
  CircleHelp,
  ChartNoAxesCombined,
  Download,
  FileKey,
  Facebook,
  GitBranch,
  Home,
  Image,
  Instagram,
  ScanSearch,
  LayoutGrid,
  Mail,
  Menu,
  MonitorSmartphone,
  PanelTop,
  Percent,
  Plug,
  Puzzle,
  Search,
  Send,
  ShieldCheck,
  Scan,
  Settings2,
  Star,
  Wallet,
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
import { readMouseHotSettings } from "@/lib/mousehot-settings";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import { accessForRoute } from "@/lib/platform-access";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DashboardHeader, type DashboardHeaderKind } from "@/components/DashboardHeader";
import { BRAND_MARK, BRAND_NAME, BRAND_SLOGAN, TRACKING_NAME } from "@/lib/brand";

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
  sales: ChartNoAxesCombined,
  funnels: GitBranch,
  profiles: MonitorSmartphone,
  tempMail: Mail,
};

const PRIMARY_LINKS = [
  { path: "/automacao-instagram", title: "Automatic Post", icon: Instagram },
  { path: "/vendas", title: TRACKING_NAME, icon: ChartNoAxesCombined },
  { path: "/vendas/integracoes", title: "Gateways", icon: Plug },
  { path: "/vendas/notificacoes", title: "Notificações", icon: Bell },
  { path: "/ferramentas", title: "Ferramentas", icon: LayoutGrid },
  { path: "/assinatura", title: "Planos", icon: Wallet },
  { path: "/configuracoes", title: "Configurações", icon: Settings2 },
] as const;
const SCALEHOT_LINKS = [
  { path: "/vendas", title: "Resumo", icon: LayoutGrid },
  { path: "/vendas/meta", title: "Meta", icon: Facebook },
  { path: "/vendas/pixels", title: "Pixels", icon: Scan },
  { path: "/vendas/eventos", title: "Eventos", icon: Activity },
  { path: "/vendas/produtos", title: "Produtos", icon: Box },
  { path: "/vendas/taxas", title: "Taxas", icon: Percent },
  { path: "/vendas/despesas", title: "Despesas", icon: Wallet },
  { path: "/vendas/rastreamento", title: "Rastreamento de vendas", icon: ChartNoAxesCombined },
  { path: "/vendas/conexoes", title: "Integrações", icon: Puzzle },
] as const;
const SIDEBAR_CATEGORIES = [
  "Automação",
  ...CATEGORIES.filter((category) => category !== "Automação"),
] as const;

function Brand() {
  return (
    <span className="flex items-center gap-3">
      <img
        src={BRAND_MARK}
        alt=""
        width={44}
        height={44}
        className="brand-mark size-11 shrink-0 rounded-lg object-contain"
      />
      <span>
        <strong className="block text-[17px] font-semibold tracking-tight">{BRAND_NAME}</strong>
        <span className="mt-0.5 block text-[11px] leading-snug font-medium text-muted-foreground">
          {BRAND_SLOGAN}
        </span>
      </span>
    </span>
  );
}

export function AppShell({
  children,
  workspaceNavigation,
  dashboard,
}: {
  children: ReactNode;
  workspaceNavigation?: (closeMenu: () => void) => ReactNode;
  dashboard?: DashboardHeaderKind;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname.replace(/\/$/, "") });
  const current = findTool(pathname);
  const section = [...PRIMARY_LINKS, ...SCALEHOT_LINKS].find(({ path }) => path === pathname);
  const currentId = current?.id;
  const isHome = pathname === "/painel";
  const isAdmin = pathname === "/aprovacoes";
  const isScaleHot = SCALEHOT_LINKS.some(({ path }) => path === pathname);
  const isTools =
    pathname === "/ferramentas" || (current && current.id !== "social" && current.id !== "sales");
  const { status, user } = usePlatformAccess();
  const dashboardKind =
    dashboard ?? (isHome ? "home" : pathname === "/vendas" ? "scalehot" : undefined);
  const available = TOOL_CATALOG.filter((tool) => status && accessForRoute(tool.path, status));
  const visitMode = status && !["admin", "approved"].includes(status);
  const directoryTools = available.filter(({ id }) => id !== "social" && id !== "sales");
  const [mobile, setMobile] = useState(false),
    [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    searchInput = useRef<HTMLInputElement>(null);
  const { favorites, recent, toggle } = useToolPreferences();
  const shortcuts = [...new Set([...favorites, ...recent.slice(0, 4)])]
    .map((id) => available.find((tool) => tool.id === id))
    .filter((tool) => tool !== undefined);
  const closeMenu = () => setMobile(false);
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
    const title = tool.name;
    const active = currentId === tool.id;
    const favorite = favorites.includes(tool.id);
    return (
      <div key={tool.id} className="flex min-w-0 items-center gap-0.5">
        <Link
          to={tool.path}
          onClick={() => setMobile(false)}
          aria-current={active ? "page" : undefined}
          className={cn("tool-nav-link min-w-0 flex-1 gap-2.5", active && "is-active")}
        >
          <Icon
            className="tool-tone size-[17px] shrink-0"
            data-tone={normalizeSearch(tool.category)}
            aria-hidden
          />
          <span className="min-w-0 flex-1 leading-tight break-words">{title}</span>
        </Link>
        {!shortcut && (
          <button
            type="button"
            onClick={() => toggle(tool.id)}
            aria-pressed={favorite}
            aria-label={`${favorite ? "Remover" : "Adicionar"} ${title} ${favorite ? "dos" : "aos"} favoritos`}
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
        to="/painel"
        onClick={() => setMobile(false)}
        aria-label={`${BRAND_NAME}, início`}
        className="border-b border-border px-5 py-5"
      >
        <Brand />
      </Link>
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <nav aria-label="Navegação principal" className="space-y-1">
          <Link
            to="/painel"
            onClick={() => setMobile(false)}
            aria-current={isHome ? "page" : undefined}
            className={cn("tool-nav-link", isHome && "is-active")}
          >
            <Home className="size-[17px]" />
            Dashboard
          </Link>
          {status === "admin" && (
            <Link
              to="/aprovacoes"
              aria-current={isAdmin ? "page" : undefined}
              onClick={() => setMobile(false)}
              className={cn("tool-nav-link", isAdmin && "is-active")}
            >
              <ShieldCheck className="size-[17px]" aria-hidden /> Aprovações e convites
            </Link>
          )}
          {status &&
            PRIMARY_LINKS.filter(({ path }) => accessForRoute(path, status)).map(
              ({ path, title, icon: Icon }) => {
                const exact = pathname === path;
                const active =
                  exact ||
                  (path === "/vendas" && isScaleHot) ||
                  (path === "/ferramentas" && isTools);
                return (
                  <div key={path}>
                    <Link
                      to={path}
                      onClick={closeMenu}
                      aria-current={exact ? "page" : active ? "location" : undefined}
                      className={cn("tool-nav-link", active && "is-active")}
                    >
                      <Icon className="size-[17px] shrink-0" aria-hidden />
                      {title}
                    </Link>
                    {path === "/vendas" && isScaleHot && (
                      <nav aria-label={title} className="scalehot-subnav space-y-1">
                        {SCALEHOT_LINKS.map(
                          ({ path: itemPath, title: itemTitle, icon: ItemIcon }) => (
                            <Link
                              key={itemPath}
                              to={itemPath}
                              onClick={closeMenu}
                              aria-current={pathname === itemPath ? "page" : undefined}
                              className={cn("tool-nav-link", pathname === itemPath && "is-active")}
                            >
                              <ItemIcon className="size-4 shrink-0" aria-hidden />
                              {itemTitle}
                            </Link>
                          ),
                        )}
                      </nav>
                    )}
                  </div>
                );
              },
            )}
        </nav>
        {workspaceNavigation?.(closeMenu)}
        {isTools && (
          <nav
            aria-label="Catálogo lateral de ferramentas"
            className="mt-5 border-t border-border pt-4"
          >
            {SIDEBAR_CATEGORIES.filter((category) =>
              directoryTools.some((tool) => tool.category === category),
            ).map((category) => (
              <div key={category} className="mb-5">
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {category}
                </p>
                {directoryTools
                  .filter((tool) => tool.category === category)
                  .map((tool) => nav(tool))}
              </div>
            ))}
            {readMouseHotSettings(user?.user_metadata).showToolShortcuts &&
              shortcuts.length > 0 && (
                <details className="group mb-5 rounded-lg border border-border px-1">
                  <summary className="flex min-h-11 list-none items-center gap-2 px-2 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                    <Star className="size-3.5" aria-hidden />
                    Favoritas e recentes
                    <ChevronDown className="ml-auto size-3.5 group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="pb-1">{shortcuts.map((tool) => nav(tool, true))}</div>
                </details>
              )}
          </nav>
        )}
      </div>
      <div className="border-t border-border px-5 py-4 text-xs leading-5 text-muted-foreground">
        {user && (
          <div className="workspace-account">
            <div>
              <strong>{user.email || "Minha conta"}</strong>
              <span>
                {status === "admin"
                  ? "Administração"
                  : status === "approved"
                    ? "Plano ativo"
                    : "Modo de visita"}
              </span>
            </div>
            <button
              type="button"
              aria-label="Sair da conta"
              onClick={() => void supabase.auth.signOut()}
            >
              <LogOut size={17} aria-hidden />
            </button>
          </div>
        )}
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
      <aside className="workspace-sidebar hidden lg:flex">{sidebar}</aside>
      <div className="lg:pl-[244px]">
        <header className={cn("workspace-topbar", dashboardKind && "dashboard-topbar")}>
          <div className={cn("flex min-w-0 items-center gap-3", dashboardKind && "lg:hidden")}>
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
            {!dashboardKind && (
              <Link
                to="/painel"
                aria-label={`${BRAND_NAME}, início`}
                className="shrink-0 sm:hidden"
              >
                <img
                  src={BRAND_MARK}
                  alt=""
                  width={32}
                  height={32}
                  className="brand-mark size-8 rounded-md object-contain"
                />
              </Link>
            )}
            {!isHome && !dashboardKind && (
              <>
                <Link
                  to="/painel"
                  className="hidden text-xs text-muted-foreground hover:text-foreground sm:block"
                >
                  Início
                </Link>
                <span className="hidden text-muted-foreground/40 sm:block">/</span>
              </>
            )}
            {!dashboardKind && (
              <span className="truncate text-sm font-semibold">
                {current?.name ||
                  section?.title ||
                  (isAdmin ? "Aprovações e convites" : "Dashboard")}
              </span>
            )}
          </div>
          {dashboardKind && (
            <DashboardHeader key={dashboardKind} kind={dashboardKind} onSearch={openSearch} />
          )}
          {!dashboardKind && (!isHome || isTools) && (
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
          {visitMode && (
            <div className="mx-auto max-w-7xl px-5 pt-4 sm:px-8">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
                <p>
                  Você está no modo de visita. Explore o Mousefy; para conectar contas e executar
                  ferramentas, escolha um plano.
                </p>
                <Link to="/assinatura" className="font-semibold text-brand-red hover:underline">
                  Ver planos
                </Link>
              </div>
            </div>
          )}
          {current && (current.id === "profiles" || current.id === "funnels") && (
            <div className="mx-auto max-w-7xl px-5 pt-4 sm:px-8">
              <ToolGuide tool={current} />
            </div>
          )}
          {children}
        </div>
        <footer className="workspace-footer">
          <span>
            {BRAND_NAME} · {BRAND_SLOGAN}
          </span>
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
          {searchTools(query)
            .filter((tool) => available.includes(tool))
            .map((tool) => {
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
          {!searchTools(query).some((tool) => available.includes(tool)) && (
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
