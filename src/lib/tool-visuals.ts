import reels from "@/assets/reels-studio.jpg";
import media from "@/assets/media-workbench.jpg";
import profile from "@/assets/profile-workspace.jpg";
import operations from "@/assets/operations-desk.jpg";
import privacy from "@/assets/photo-privacy.jpg";
import creatives from "@/assets/creative-workbench.jpg";
import preview from "@/assets/preview-workbench.jpg";
import type { Tool } from "./tool-catalog";

export const TOOL_VISUALS: Record<Tool["id"], { image: string; alt: string; action: string }> = {
  social: { image: reels, alt: "Gravação de um vídeo vertical com celular", action: "Agendar Reels" },
  images: { image: media, alt: "Fotografias e arquivos de mídia organizados", action: "Gerar links" },
  pages: { image: profile, alt: "Página de perfil em um computador e celular", action: "Gerar prompt" },
  metadata: { image: privacy, alt: "Detalhes de uma fotografia e armazenamento de arquivos", action: "Limpar arquivos" },
  creatives: { image: creatives, alt: "Edição de um criativo com mesa digitalizadora", action: "Preparar criativos" },
  preview: { image: preview, alt: "Fotografia original ao lado de uma versão pixelizada", action: "Criar prévias" },
  telegram: { image: operations, alt: "Mensagens e planejamento de destinos", action: "Trocar links" },
  funnels: { image: operations, alt: "Etapas conectadas em um fluxo de trabalho", action: "Organizar funil" },
  profiles: { image: profile, alt: "Perfil de criadora visualizado em diferentes telas", action: "Preparar perfis" },
  tempMail: { image: operations, alt: "Mesa de organização e comunicação digital", action: "Abrir caixa" },
};