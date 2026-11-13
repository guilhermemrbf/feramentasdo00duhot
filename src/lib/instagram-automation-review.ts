export type StoriesChoice = "" | "skip" | "planned";
export function reviewAutomation(input: {
  accountId: string;
  connected: boolean;
  videoCount: number;
  dailyCount: number;
  previewCurrent: boolean;
  workerActive: boolean;
  stories: StoriesChoice;
  storyCount: number;
  confirmed: boolean;
}) {
  const errors: string[] = [];
  if (!input.accountId || !input.connected) errors.push("Conecte e selecione a conta.");
  if (!Number.isInteger(input.videoCount) || input.videoCount < 1)
    errors.push("Adicione os vídeos desta conta.");
  if (!Number.isInteger(input.dailyCount) || input.dailyCount < 1 || input.dailyCount > 10)
    errors.push("Escolha de 1 a 10 Reels por dia.");
  if (!input.previewCurrent) errors.push("Atualize a prévia dos horários.");
  if (!input.workerActive) errors.push("Ative o processamento em Configurações.");
  if (!["skip", "planned"].includes(input.stories))
    errors.push("Decida se vai preparar Stories para esta conta.");
  if (input.stories === "planned" && input.storyCount < 1)
    errors.push("Salve ao menos um Story futuro desta conta antes de continuar.");
  if (!input.confirmed)
    errors.push("Confirme a revisão da conta, legendas, hashtags, capa e horários.");
  return errors;
}
