import {
  CalendarClock,
  CircleCheck,
  Clapperboard,
  FolderOpen,
  GitBranch,
  History,
  Scan,
  Tags,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProductMockup } from "./ProductMockup";
import { useLaunchEntrance } from "./useLaunchEntrance";

const stages = [
  {
    id: "planejamento",
    name: "Planeje com dados",
    icon: GitBranch,
    title: "Escolha os perfis e desenhe o funil",
    description:
      "Compare os dados disponíveis dos perfis e organize o caminho que cada pessoa segue do primeiro contato à próxima etapa.",
    tool: "Análise e planejamento",
    rows: [
      { label: "Instagram Intelligence", detail: "Comparação de perfis em lote", icon: Scan },
      { label: "Funil", detail: "Etapas e decisões em um quadro visual", icon: GitBranch },
    ],
  },
  {
    id: "preparacao",
    name: "Prepare em lote",
    icon: Clapperboard,
    title: "Do arquivo original à prévia com sua marca",
    description:
      "Guarde o original, exporte a versão com sua marca e crie uma prévia para divulgar. O tratamento acontece no seu navegador.",
    tool: "Preparação de mídia",
    rows: [
      { label: "Otimizar Criativos", detail: "Marca em fotos e vídeos", icon: Clapperboard },
      { label: "Limpar Metadados", detail: "Arquivos tratados no navegador", icon: Tags },
      { label: "Gerar Preview", detail: "Prévia com desfoque ou pixelização", icon: Scan },
    ],
  },
  {
    id: "biblioteca",
    name: "Organize por conta",
    icon: FolderOpen,
    title: "Uma biblioteca para cada conta",
    description:
      "Escolha o perfil que vai publicar e reúna os Reels dele. Importe uma pasta privada do Google Drive quando seus vídeos já estiverem lá.",
    tool: "Biblioteca de Reels",
    rows: [
      { label: "Selecionar perfil", detail: "Conta de destino no Instagram", icon: CircleCheck },
      {
        label: "Vincular pasta privada",
        detail: "Google Drive como fonte dos Reels",
        icon: FolderOpen,
      },
      {
        label: "Importar vídeos",
        detail: "Conteúdo disponível na biblioteca do perfil",
        icon: Clapperboard,
      },
    ],
  },
  {
    id: "publicacao",
    name: "Agende e acompanhe",
    icon: CalendarClock,
    title: "Confira o destino de cada publicação",
    description:
      "Escolha os dias e horários, revise a fila e acompanhe o que foi publicado para cada perfil.",
    tool: "Automatic Post",
    rows: [
      { label: "Planejar publicação", detail: "Perfil, conteúdo e horário", icon: CalendarClock },
      { label: "Revisar a fila", detail: "Ordem das próximas publicações", icon: Clapperboard },
      { label: "Conferir histórico", detail: "Resultado de cada publicação", icon: History },
    ],
  },
] as const;

export function LaunchWorkflow() {
  const [stageId, setStageId] = useState<(typeof stages)[number]["id"]>("planejamento");
  const { ref: preview, entered } = useLaunchEntrance<HTMLDivElement>();
  const steps = useRef<HTMLOListElement>(null);
  const stage = stages.find((entry) => entry.id === stageId) ?? stages[0];
  const StageIcon = stage.icon;

  useEffect(() => {
    if (!steps.current || !("IntersectionObserver" in window)) return;
    const layout = window.matchMedia(
      "(min-width: 1000px) and (prefers-reduced-motion: no-preference)",
    );
    const elements = [...steps.current.children];
    const observer = new IntersectionObserver(
      (entries) => {
        if (!layout.matches) return;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = elements.indexOf(entry.target);
          if (index >= 0) setStageId(stages[index].id);
        }
      },
      { rootMargin: "-38% 0px -60% 0px" },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="fluxo"
      className="launch-workflow premium-workflow"
      aria-labelledby="launch-workflow-heading"
    >
      <div className="launch-wrap">
        <div className="premium-section-heading">
          <h2 id="launch-workflow-heading">Da ideia ao post no ar, em 4 passos.</h2>
          <p>
            Acompanhe o caminho de uma campanha da escolha dos perfis até a conferência do que foi
            publicado.
          </p>
        </div>
        <div className="launch-workflow-layout premium-story-layout">
          <ol
            className="launch-stage-controls premium-story-steps"
            style={
              {
                "--campaign-progress": (stages.indexOf(stage) + 1) / stages.length,
              } as React.CSSProperties
            }
            ref={steps}
            aria-label="Etapas da operação"
          >
            {stages.map(({ id, name, icon: Icon, title, description }, index) => (
              <li key={id} data-current={stageId === id || undefined}>
                <button
                  type="button"
                  aria-pressed={stageId === id}
                  aria-controls="launch-workflow-preview"
                  onClick={(event) => {
                    setStageId(id);
                    if (
                      window.matchMedia(
                        "(min-width: 1000px) and (prefers-reduced-motion: no-preference)",
                      ).matches
                    ) {
                      const top = event.currentTarget.closest("li")!.getBoundingClientRect().top;
                      window.scrollTo({
                        top: window.scrollY + top - window.innerHeight * 0.36,
                        behavior: "instant",
                      });
                    }
                  }}
                >
                  <Icon size={19} aria-hidden />
                  <span>{name}</span>
                  <small aria-hidden="true">
                    {index + 1}/{stages.length}
                  </small>
                </button>
                <div className="premium-story-copy" aria-hidden={stageId !== id}>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <div className="command-mobile-mock">
                  <ProductMockup stage={id} />
                </div>
              </li>
            ))}
          </ol>
          <div
            id="launch-workflow-preview"
            className="launch-workflow-preview"
            ref={preview}
            data-entered={entered || undefined}
            role="region"
            aria-label="Demonstração do produto"
          >
            <div className="launch-workflow-preview-head">
              <StageIcon size={20} aria-hidden />
              <strong>{stage.tool}</strong>
              <span className="premium-demo-label">Demonstração</span>
              <span className="launch-stage-position" aria-hidden="true">
                {stages.map(({ id }) => (
                  <i key={id} data-current={stage.id === id || undefined} />
                ))}
              </span>
            </div>
            <div key={stage.id} className="launch-workflow-preview-body" data-stage={stage.id}>
              <h3>{stage.title}</h3>
              <p>{stage.description}</p>
              <ProductMockup stage={stage.id} />
              <ul>
                {stage.rows.map(({ label, detail, icon: Icon }) => (
                  <li key={label}>
                    <Icon size={19} aria-hidden />
                    <div>
                      <strong>{label}</strong>
                      <span>{detail}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
