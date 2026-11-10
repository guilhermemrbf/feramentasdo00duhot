import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Clock3, Search, Star, X } from "lucide-react";
import { AppShell, Brand, TOOL_ICONS } from "@/components/AppShell";
import { CATEGORIES, TOOL_CATALOG, normalizeSearch, searchTools } from "@/lib/tool-catalog";
import { useToolPreferences } from "@/lib/tool-preferences";
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "00duHot — seu centro de operação" },
      {
        name: "description",
        content:
          "Conteúdo, preparação, planejamento e automação em um workspace de ferramentas para sua operação digital.",
      },
    ],
  }),
  component: Home,
});

const shortcutIds = ["social", "preview", "telegram"] as const;
const shortcuts = shortcutIds.flatMap((id) => TOOL_CATALOG.filter((tool) => tool.id === id));
const catalogCategories = CATEGORIES.filter(
  (category) => category === "Todas" || TOOL_CATALOG.some((tool) => tool.category === category),
);

function Home() {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("Todas"),
    [onlyFavorites, setOnlyFavorites] = useState(false);
  const { favorites, recent, toggle } = useToolPreferences();
  const results = searchTools(query, category).filter(
    (tool) => !onlyFavorites || favorites.includes(tool.id),
  );
  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <section className="home-intro">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-red/30 bg-brand-red/10 px-3 py-1 text-xs font-semibold text-brand-red">
              <span className="size-1.5 rounded-full bg-brand-red" aria-hidden />
              Workspace 00duHot
            </p>
            <h1 className="max-w-xl font-display text-3xl font-bold leading-tight tracking-tight sm:text-[46px]">
              Sua operação digital <span className="text-primary">em um só lugar</span>
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
              Prepare conteúdo, organize seus fluxos e acompanhe o que está agendado. Comece pela
              ferramenta que você precisa agora.
            </p>
            <a
              href="#tools-title"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-[#f5ce90]"
            >
              Explorar ferramentas <ArrowDown className="size-4" aria-hidden />
            </a>
          </div>
          <div className="home-mark hidden shrink-0 p-2 sm:block">
            <img
              src="/brand/mark.png"
              alt="Mascote 00duHot: rato de óculos com corrente dourada"
              width={176}
              height={176}
              className="size-32 rounded-2xl object-contain xl:size-44"
            />
          </div>
        </section>
        <section aria-labelledby="quick-tools-title" className="mb-9">
          <h2 id="quick-tools-title" className="mb-3 text-sm font-semibold">
            Acesso rápido
          </h2>
          <div className="grid gap-3 xl:grid-cols-3">
            {shortcuts.map((tool) => {
              const Icon = TOOL_ICONS[tool.id];
              return (
                <Link key={tool.id} to={tool.path} className="workspace-shortcut">
                  <span
                    className="tool-tone tool-icon grid size-10 shrink-0 place-items-center rounded-lg"
                    data-tone={normalizeSearch(tool.category)}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm font-semibold">{tool.name}</strong>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {tool.summary}
                    </span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-primary" aria-hidden />
                </Link>
              );
            })}
          </div>
        </section>
        {recent.length > 0 && (
          <section className="mb-9">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Clock3 className="size-3.5" />
              Acessadas recentemente
            </h2>
            <div className="flex flex-wrap gap-2">
              {recent.slice(0, 4).map((id) => {
                const tool = TOOL_CATALOG.find((t) => t.id === id);
                if (!tool) return null;
                return (
                  <Link
                    key={id}
                    to={tool.path}
                    className="inline-flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-xs hover:border-primary/50"
                  >
                    {tool.name}
                    <ArrowRight className="size-3 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </section>
        )}
        <section aria-labelledby="tools-title">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Workspace
              </p>
              <h2
                id="tools-title"
                tabIndex={-1}
                className="mt-2 scroll-mt-4 text-2xl font-semibold"
              >
                Suas ferramentas
              </h2>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
              <label htmlFor="catalog-search" className="sr-only">
                Buscar ferramentas por nome ou objetivo
              </label>
              <input
                id="catalog-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome ou objetivo"
                className="workspace-input pl-10"
              />
            </div>
          </div>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {catalogCategories.map((value) => (
              <button
                key={value}
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
                type="button"
                className="filter-chip"
              >
                {value}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOnlyFavorites(!onlyFavorites)}
              aria-pressed={onlyFavorites}
              className="filter-chip sm:ml-auto"
            >
              <Star className={cn("size-3.5", onlyFavorites && "fill-current")} />
              Favoritas ({favorites.length})
            </button>
          </div>
          <p className="sr-only" role="status">
            {results.length} ferramentas encontradas.
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {results.map((tool) => {
              const Icon = TOOL_ICONS[tool.id],
                favorite = favorites.includes(tool.id);
              return (
                <article key={tool.id} className="tool-card">
                  <div className="mb-6 flex items-center justify-between">
                    <span
                      className="tool-tone tool-icon flex size-11 items-center justify-center rounded-lg"
                      data-tone={normalizeSearch(tool.category)}
                    >
                      <Icon className="size-[18px]" />
                    </span>
                    <button
                      type="button"
                      onClick={() => toggle(tool.id)}
                      aria-pressed={favorite}
                      aria-label={`${favorite ? "Remover" : "Adicionar"} ${tool.name} ${favorite ? "dos" : "aos"} favoritos`}
                      className="grid size-10 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary aria-pressed:border-primary/70 aria-pressed:bg-primary/10"
                    >
                      <Star className={cn("size-4", favorite && "fill-primary text-primary")} />
                    </button>
                  </div>
                  <p
                    className="tool-tone mb-2 text-xs font-medium"
                    data-tone={normalizeSearch(tool.category)}
                  >
                    {tool.category}
                  </p>
                  <h3 className="text-[17px] font-semibold tracking-tight">{tool.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{tool.summary}</p>
                  <div className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-4">
                    <span className="text-xs text-muted-foreground">{tool.mode}</span>
                    <Link
                      to={tool.path}
                      className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-primary/35 bg-primary/10 px-2.5 py-2 text-xs font-semibold text-primary hover:border-primary hover:bg-primary/15"
                      aria-label={`Abrir ${tool.name}`}
                    >
                      Abrir ferramenta
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
          {!results.length && (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <Search className="mx-auto mb-4 size-5 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Nenhuma ferramenta encontrada</h3>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                Tente outro termo ou remova os filtros para ver todas as opções.
              </p>
              <button
                onClick={() => {
                  setQuery("");
                  setCategory("Todas");
                  setOnlyFavorites(false);
                }}
                className="mt-5 inline-flex items-center gap-2 text-xs text-primary"
              >
                <X className="size-3" />
                Limpar filtros
              </button>
            </div>
          )}
        </section>
        <section className="mt-10 flex flex-wrap items-center gap-5 rounded-lg border border-border bg-card p-5">
          <Brand compact />
          <p className="flex-1 text-xs leading-6 text-muted-foreground">
            Cada ferramenta explica os dados de entrada, o resultado e os requisitos. O
            processamento local permanece no seu dispositivo; integrações externas são identificadas
            em cada área.
          </p>
        </section>
      </main>
    </AppShell>
  );
}
