import { motion, useReducedMotion } from "motion/react";
import { CalendarDays, Check, ChevronRight, FileVideo, FolderOpen } from "lucide-react";

const examples = {
  planejamento: { title: "Comparação de perfis", labels: ["Perfil A", "Perfil B", "Perfil C"] },
  preparacao: {
    title: "Preparação de mídia",
    labels: ["original.mp4", "com-marca.mp4", "previa.mp4"],
  },
  biblioteca: {
    title: "Biblioteca por perfil",
    labels: ["Pasta no Google Drive", "Reels da conta", "Stories da conta"],
  },
  publicacao: {
    title: "Fila de publicação",
    labels: ["Reel da manhã", "Reel da tarde", "Reel da noite"],
  },
} as const;

const alternativePreviews: Record<string, { title: string; labels: string[] }> = {
  funnels: { title: "Mapa da campanha", labels: ["Descoberta", "Interesse", "Oferta"] },
  metadata: {
    title: "Limpeza de metadados",
    labels: ["foto.jpg · entrada", "video.mp4 · entrada", "arquivos-limpos.zip · exportação"],
  },
  creatives: {
    title: "Aplicação de marca",
    labels: ["Original", "Posição e opacidade", "Criativo com marca"],
  },
  preview: {
    title: "Prévia de divulgação",
    labels: ["Foto ou vídeo", "Desfoque ou pixelização", "Exportar prévia"],
  },
  telegram: {
    title: "Revisão de links",
    labels: ["Canal selecionado", "Link atual", "Novo destino"],
  },
  downloader: {
    title: "Fila de downloads",
    labels: ["Publicação selecionada", "Arquivos encontrados", "Pasta Downloads"],
  },
  images: {
    title: "Arquivo compartilhável",
    labels: ["Enviar mídia", "Gerar link público", "Copiar URL"],
  },
  pages: {
    title: "Preparação de página",
    labels: ["Foto e capa", "Nome e descrição", "Prompt para copiar"],
  },
  tempMail: {
    title: "Caixa temporária",
    labels: ["Copiar endereço", "Aguardar mensagem", "Excluir caixa"],
  },
};
export type LaunchStage = keyof typeof examples;
const scoreWidths = [78, 61, 48];
const queueTimes = ["09:00", "14:00", "18:00"];
const queueStatus = ["Revisado", "Agendado", "Na fila"];

export function ProductMockup({ stage, variant }: { stage: LaunchStage; variant?: string }) {
  const reduced = useReducedMotion();
  const example = examples[stage];
  const funnel = variant === "funnels";
  const { title, labels } = (variant && alternativePreviews[variant]) || example;
  return (
    <figure className="command-mock" data-mock={stage}>
      <figcaption>
        <strong>{title}</strong>
        <span>Exemplo ilustrativo</span>
      </figcaption>
      {stage === "publicacao" && (
        <div className="command-calendar" aria-hidden="true">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day, index) => (
            <span key={day} data-marked={index % 2 === 0 || undefined}>
              <small>{day}</small>
              {index + 12}
            </span>
          ))}
        </div>
      )}
      <ol>
        {labels.map((label, index) => {
          const Icon =
            stage === "biblioteca"
              ? FolderOpen
              : stage === "preparacao"
                ? FileVideo
                : stage === "publicacao"
                  ? CalendarDays
                  : ChevronRight;
          return (
            <motion.li
              key={label}
              initial={reduced ? false : { opacity: 0.66, y: 5 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: reduced ? 0 : index * 0.07 }}
            >
              <Icon size={16} aria-hidden />
              <span>{label}</span>
              {stage === "planejamento" && !funnel && (
                <span className="command-meter" aria-hidden="true">
                  <motion.i
                    initial={reduced ? false : { scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.65, delay: index * 0.09 }}
                    style={{ width: scoreWidths[index] + "%" }}
                  />
                </span>
              )}
              {stage === "publicacao" && (
                <small>
                  {queueTimes[index]} · {queueStatus[index]}
                </small>
              )}
              {(stage === "preparacao" || funnel) && <Check size={15} aria-hidden />}
            </motion.li>
          );
        })}
      </ol>
    </figure>
  );
}
