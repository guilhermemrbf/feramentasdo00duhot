export const driveMediaPrefix = "drive/";
export const driveVideoMaxBytes = 50_000_000;
export const driveFileLimit = 1000;

export function driveFolderId(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.origin !== "https://drive.google.com" || url.username || url.password) return null;
    return /^\/drive\/(?:u\/\d+\/)?folders\/([\w-]{10,120})\/?$/.exec(url.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

export type DrivePublishErrorCode = "drive_unavailable" | "drive_changed" | "drive_transfer";

export const drivePublishMessages: Record<DrivePublishErrorCode, string> = {
  drive_unavailable:
    "O vídeo do Google Drive está indisponível. Confira a pasta e o acesso de leitura.",
  drive_changed: "O vídeo mudou no Google Drive. Atualize a biblioteca e refaça o agendamento.",
  drive_transfer:
    "Não foi possível preparar o vídeo do Google Drive para publicar. Revise o arquivo e tente novamente.",
};

export function drivePublishMessage(code: string | null) {
  if (code && Object.hasOwn(drivePublishMessages, code))
    return drivePublishMessages[code as DrivePublishErrorCode];
}

export class DrivePublishError extends Error {
  readonly code: DrivePublishErrorCode;

  constructor(code: DrivePublishErrorCode) {
    super(drivePublishMessages[code]);
    this.code = code;
  }
}
