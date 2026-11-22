import { ArrowUpRight, ChevronRight, Monitor, Smartphone, UserPlus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ProductMockup, type LaunchStage } from "./ProductMockup";
import { useState } from "react";
import { TOOL_CATALOG, type Tool } from "@/lib/tool-catalog";
import { TOOL_ICONS } from "@/components/AppShell";
import { useLaunchEntrance } from "./useLaunchEntrance";

const upcomingAccountCreator = {
  id: "accountCreator",
  name: "Criação Automática de Contas — Instagram",
  category: "Automação",
  mode: "Recurso planejado",
  summary:
    "A proposta é reunir as etapas de criação e configuração de contas do Instagram e o acompanhamento dos perfis em um fluxo centralizado.",
} as const;

const categoryPreviews: Record<ShowcaseCategory, LaunchStage> = {
  Planejamento: "planejamento",
  Preparação: "preparacao",
  Automação: "publicacao",
  Conteúdo: "preparacao",
  Ambientes: "biblioteca",
};
const showcaseTools = [...TOOL_CATALOG, upcomingAccountCreator];

export type ShowcaseCategory = Tool["category"];
const categories: ShowcaseCategory[] = [
  "Planejamento",
  "Preparação",
  "Automação",
  "Conteúdo",
  "Ambientes",
];

export function LaunchShowcase({
  category,
  onCategoryChange,
}: {
  category: ShowcaseCategory;
  onCategoryChange: (category: ShowcaseCategory) => void;
}) {
  const reduced = useReducedMotion();
  const [selection, setSelection] = useState<(typeof showcaseTools)[number]["id"]>();
  const { ref, entered } = useLaunchEntrance<HTMLDivElement>();
  const tools = showcaseTools.filter((tool) => tool.category === category);
  const selected = tools.find((tool) => tool.id === selection) ?? tools[0];
  const SelectedIcon = selected.id === "accountCreator" ? UserPlus : TOOL_ICONS[selected.id];

  return (
    <section id="ferramentas" className="premium-showcase" aria-labelledby="launch-catalog-heading">
      <div className="launch-wrap">
        <div className="premium-section-heading">
          <h2 id="launch-catalog-heading">Tudo que sua operação usa, no mesmo lugar.</h2>
          <p>
            Cada ferramenta resolve uma etapa do orgânico. Escolha o que precisa fazer e veja como
            funciona.
          </p>
        </div>
        <div className="premium-categories" role="group" aria-label="Categorias de ferramentas">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={category === item}
              aria-controls="showcase-tools"
              onClick={() => {
                onCategoryChange(item);
                setSelection(undefined);
              }}
            >
              {category === item && (
                <motion.span
                  className="command-tab-indicator"
                  layoutId={reduced ? undefined : "showcase-category"}
                  transition={{ duration: reduced ? 0 : 0.24 }}
                  aria-hidden
                />
              )}
              <span>{item}</span>
            </button>
          ))}
        </div>
        <div className="premium-showcase-body" ref={ref} data-entered={entered || undefined}>
          <div
            id="showcase-tools"
            key={category}
            className="premium-tool-list"
            role="group"
            aria-label={`Ferramentas de ${category}`}
          >
            {tools.map((tool) => {
              const Icon = tool.id === "accountCreator" ? UserPlus : TOOL_ICONS[tool.id];
              return (
                <button
                  key={tool.id}
                  type="button"
                  aria-pressed={selected.id === tool.id}
                  aria-controls="showcase-detail"
                  onClick={() => setSelection(tool.id)}
                >
                  <Icon size={22} aria-hidden />
                  <span>{tool.name}</span>
                  <ChevronRight size={17} aria-hidden />
                </button>
              );
            })}
          </div>
          <article
            id="showcase-detail"
            className="premium-tool-detail"
            aria-live="polite"
            onPointerMove={(event) => {
              if (reduced || event.pointerType !== "mouse") return;
              const element = event.currentTarget;
              const box = element.getBoundingClientRect();
              const x = (event.clientX - box.left) / box.width;
              const y = (event.clientY - box.top) / box.height;
              element.style.setProperty("--spot-x", x * 100 + "%");
              element.style.setProperty("--spot-y", y * 100 + "%");
              element.style.setProperty("--tool-tilt", (x - 0.5) * 3 + "deg");
            }}
            onPointerLeave={(event) => event.currentTarget.style.removeProperty("--tool-tilt")}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={selected.id}
                className="premium-tool-detail-content"
                initial={{ opacity: 0.5, y: reduced ? 0 : 7 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -5 }}
                transition={{ duration: reduced ? 0 : 0.16 }}
              >
                <div className="premium-tool-identity">
                  <SelectedIcon size={24} aria-hidden />
                  <span>{selected.mode}</span>
                </div>
                <h3>{selected.name}</h3>
                <p>
                  {selected.id === "intelligence"
                    ? "Saiba quais perfis valem seu tempo antes de investir em produção. Compare desempenho, potencial e conformidade em uma análise privada."
                    : selected.summary}
                </p>
                {selected.id === "accountCreator" ? (
                  <div className="premium-tool-preview premium-planned">
                    <strong>Indisponível nesta versão</strong>
                    <p>
                      Hoje, o Automatic Post conecta contas existentes pelo fluxo oficial do
                      Instagram.
                    </p>
                  </div>
                ) : (
                  <>
                    {selected.id === "controlHub" && (
                      <div
                        className="premium-farm-preview"
                        aria-label="Esquema de vários iPhones conectados a um computador Windows"
                      >
                        <span>
                          <Smartphone aria-hidden /> iPhones via USB
                        </span>
                        <Smartphone aria-hidden />
                        <Smartphone aria-hidden />
                        <span>
                          <Monitor aria-hidden /> Windows
                        </span>
                      </div>
                    )}
                    {selected.id !== "controlHub" && (
                      <ProductMockup stage={categoryPreviews[category]} variant={selected.id} />
                    )}
                    <dl className="premium-tool-preview">
                      <div>
                        <dt>O que você usa</dt>
                        <dd>{selected.input}</dd>
                      </div>
                      <ArrowUpRight size={18} aria-hidden />
                      <div>
                        <dt>O que você obtém</dt>
                        <dd>{selected.output}</dd>
                      </div>
                    </dl>
                    <p className="premium-tool-requirement">{selected.requirement}</p>
                    <Link to={selected.path} className="premium-text-link">
                      {selected.action} <ArrowUpRight size={17} aria-hidden />
                    </Link>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </article>
        </div>
      </div>
    </section>
  );
}
