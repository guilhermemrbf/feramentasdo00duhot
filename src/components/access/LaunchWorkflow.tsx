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
import { useState } from "react";
import { useLaunchEntrance } from "./useLaunchEntrance";

const stages = [
  {
    id: "planejamento",
    name: "Planeje a campanha",
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
    name: "Prepare o conteúdo",
    icon: Clapperboard,
    title: "Um vídeo pronto para publicar",
    description:
      "Aplique sua marca aos criativos, limpe metadados ou gere uma prévia antes de publicar.",
    tool: "Preparação de mídia",
    rows: [
      { label: "Otimizar Criativos", detail: "Marca em fotos e vídeos", icon: Clapperboard },
      { label: "Limpar Metadados", detail: "Arquivos tratados no navegador", icon: Tags },
      { label: "Gerar Preview", detail: "Prévia com desfoque ou pixelização", icon: Scan },
    ],
  },
  {
    id: "biblioteca",
    name: "Organize por perfil",
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
    title: "Da fila ao histórico",
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
  const stage = stages.find((entry) => entry.id === stageId) ?? stages[0];
  const StageIcon = stage.icon;

  return (
    <section id="fluxo" className="launch-workflow" aria-labelledby="launch-workflow-heading">
      <div className="launch-wrap wrap launch-workflow-layout">
        <div className="launch-workflow-copy">
          <h2 id="launch-workflow-heading">Da ideia ao conteúdo publicado</h2>
          <p>
            Explore um fluxo completo. Comece por uma campanha, passe pelo tratamento dos arquivos e
            chegue à biblioteca e ao calendário de cada conta.
          </p>
          <div className="launch-stage-controls" role="group" aria-label="Etapas da operação">
            {stages.map(({ id, name, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={stageId === id}
                aria-controls="launch-workflow-preview"
                onClick={() => setStageId(id)}
              >
                <Icon size={19} aria-hidden />
                <span>{name}</span>
              </button>
            ))}
          </div>
        </div>
        <div
          id="launch-workflow-preview"
          className="launch-workflow-preview"
          ref={preview}
          data-entered={entered || undefined}
          role="region"
          aria-label="Demonstração do produto"
          aria-live="polite"
        >
          <div className="launch-workflow-preview-head">
            <StageIcon size={20} aria-hidden />
            <strong>{stage.tool}</strong>
          </div>
          <div key={stage.id} className="launch-workflow-preview-body">
            <h3>{stage.title}</h3>
            <p>{stage.description}</p>
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
    </section>
  );
}
