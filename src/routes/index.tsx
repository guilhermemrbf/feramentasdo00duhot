import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, Clock3, Search, Star, X } from "lucide-react";
import { AppShell, TOOL_ICONS } from "@/components/AppShell";
import { CATEGORIES, TOOL_CATALOG, normalizeSearch, searchTools } from "@/lib/tool-catalog";
import { useToolPreferences } from "@/lib/tool-preferences";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TOOL_VISUALS } from "@/lib/tool-visuals";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MauseHot — sua operação digital" },
      { property: "og:title", content: "MauseHot — sua operação digital" },
      { property: "og:description", content: "Prepare arquivos, crie páginas e organize seus Reels com as ferramentas MauseHot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
          <img src="/brand/mark.png" alt="Mascote MauseHot" width={100} height={100} className="size-16 shrink-0 rounded-lg sm:size-24" />
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs font-semibold text-primary">VISÃO GERAL</p>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">Sua operação. MauseHot.</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">Do primeiro arquivo ao próximo Reel. Escolha o que você precisa fazer hoje.</p>
          </div>
          <span className="hidden text-xs text-muted-foreground xl:block">{TOOL_CATALOG.length} ferramentas<br /><span className="mt-1 block text-gold">Uma operação conectada</span></span>
        </section>
        <section aria-labelledby="quick-tools-title" className="mb-9">
          <h2 id="quick-tools-title" className="mb-3 text-sm font-semibold">
            Comece por aqui
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
          <div className="catalog-filter-bar mb-5 flex flex-wrap items-center gap-2">
            {catalogCategories.map((value) => (
              <Button variant="ghost"
                key={value}
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
                type="button"
                className="filter-chip"
              >
                {value}
              </Button>
            ))}
            <Button variant="ghost"
              type="button"
              onClick={() => setOnlyFavorites(!onlyFavorites)}
              aria-pressed={onlyFavorites}
              className="filter-chip sm:ml-auto"
            >
              <Star className={cn("size-3.5", onlyFavorites && "fill-current")} />
              Favoritas ({favorites.length})
            </Button>
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
                  <Link to={tool.path} tabIndex={-1} aria-hidden="true">
                    <img src={TOOL_VISUALS[tool.id].image} alt={TOOL_VISUALS[tool.id].alt} loading="lazy" width={1536} height={1024} className="tool-card-photo" />
                  </Link>
                  <div className="tool-card-body">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="tool-tone inline-flex items-center gap-2 text-xs font-medium" data-tone={normalizeSearch(tool.category)}><Icon className="size-4" />{tool.category}</span>
                      <Button variant="ghost" size="icon" onClick={() => toggle(tool.id)} aria-pressed={favorite} title={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} aria-label={`${favorite ? "Remover" : "Adicionar"} ${tool.name} ${favorite ? "dos" : "aos"} favoritos`} className="text-muted-foreground aria-pressed:text-gold">
                        <Star className={cn("size-4", favorite && "fill-current")} />
                      </Button>
                    </div>
                    <h3 className="text-base font-semibold">{tool.name}</h3>
                    <p className="mb-5 mt-2 text-sm leading-6 text-muted-foreground">{tool.summary}</p>
                    <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
                      <span className="text-[11px] text-muted-foreground">{tool.mode}</span>
                      <Button asChild variant="ghost" size="sm" className="shrink-0 text-primary">
                        <Link to={tool.path} aria-label={`Abrir ${tool.name}`}>{TOOL_VISUALS[tool.id].action}<ArrowUpRight className="size-4" /></Link>
                      </Button>
                    </div>
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
              <Button variant="ghost"
                onClick={() => {
                  setQuery("");
                  setCategory("Todas");
                  setOnlyFavorites(false);
                }}
                className="mt-5 inline-flex items-center gap-2 text-xs text-primary"
              >
                <X className="size-3" />
                Limpar filtros
              </Button>
            </div>
          )}
        </section>

      </main>
    </AppShell>
  );
}
