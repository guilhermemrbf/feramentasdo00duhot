import {
  CalendarClock,
  CircleCheck,
  Clapperboard,
  FolderOpen,
  History,
  Scan,
  Tags,
} from "lucide-react";
import { useState } from "react";

const stages = [
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
  const [stageId, setStageId] = useState<(typeof stages)[number]["id"]>("preparacao");
  const stage = stages.find((entry) => entry.id === stageId) ?? stages[0];
  const StageIcon = stage.icon;

  return (
    <section id="fluxo" className="launch-workflow" aria-labelledby="launch-workflow-heading">
      <div className="launch-wrap wrap launch-workflow-layout">
        <div className="launch-workflow-copy">
          <h2 id="launch-workflow-heading">Do criativo ao Reel publicado</h2>
          <p>
            Veja como o trabalho passa da preparação à biblioteca e chega ao calendário de cada
            conta.
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
