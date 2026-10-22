import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, Clock3, Search, Star, X } from "lucide-react";
import { AppShell, Brand, TOOL_ICONS } from "@/components/AppShell";
import { CATEGORIES, TOOL_CATALOG, searchTools } from "@/lib/tool-catalog";
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
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
              Seu centro de operação
            </p>
            <h1 className="max-w-2xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-[42px]">
              Menos ferramentas soltas.
              <br />
              Mais controle da operação.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
              Prepare seus materiais, organize seus fluxos e acompanhe suas automações. Escolha
              abaixo o que precisa fazer agora.
            </p>
          </div>
          <div className="hidden rounded-xl border border-border bg-[#080808] p-5 sm:block">
            <img
              src="/brand/mark.png"
              alt="Mascote 00duHot: rato de óculos com corrente dourada"
              width={176}
              height={176}
              className="size-40 object-contain"
            />
          </div>
        </section>
        <section aria-label="Atalhos por objetivo" className="mb-10 grid gap-3 md:grid-cols-3">
          {[
            {
              to: "/gerar-preview" as const,
              title: "Preparar conteúdo",
              text: "Prévias, marca e arquivos prontos.",
            },
            {
              to: "/funil" as const,
              title: "Organizar a estratégia",
              text: "Etapas e caminhos do seu funil.",
            },
            {
              to: "/telegram-sync" as const,
              title: "Automatizar a rotina",
              text: "Sincronização e edição de canais.",
            },
          ].map((item) => (
            <Link key={item.to} to={item.to} className="workspace-shortcut">
              <span>
                <strong className="block text-sm font-medium">{item.title}</strong>
                <span className="mt-1 block text-xs text-muted-foreground">{item.text}</span>
              </span>
              <ArrowUpRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
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
              <h2 id="tools-title" className="mt-2 text-xl font-semibold">
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
            {CATEGORIES.map((value) => (
              <button
                key={value}
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
                className={cn("catalog-filter", category === value && "is-active")}
              >
                {value}
              </button>
            ))}
            <button
              onClick={() => setOnlyFavorites(!onlyFavorites)}
              aria-pressed={onlyFavorites}
              className={cn(
                "catalog-filter ml-auto inline-flex items-center gap-2",
                onlyFavorites && "is-active",
              )}
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
                    <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-background text-primary">
                      <Icon className="size-[18px]" />
                    </span>
                    <button
                      onClick={() => toggle(tool.id)}
                      aria-pressed={favorite}
                      aria-label={`${favorite ? "Remover" : "Adicionar"} ${tool.name} ${favorite ? "dos" : "aos"} favoritos`}
                      className="rounded-md p-2 text-muted-foreground hover:text-primary"
                    >
                      <Star className={cn("size-4", favorite && "fill-primary text-primary")} />
                    </button>
                  </div>
                  <p className="mb-2 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {tool.category}
                  </p>
                  <h3 className="text-[17px] font-semibold tracking-tight">{tool.name}</h3>
                  <p className="mt-3 min-h-12 text-xs leading-6 text-muted-foreground">
                    {tool.summary}
                  </p>
                  <div className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-4">
                    <span className="text-[10px] text-muted-foreground">{tool.mode}</span>
                    <Link
                      to={tool.path}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-primary"
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
