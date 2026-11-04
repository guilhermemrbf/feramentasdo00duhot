/** Container preflight only: actual codecs/duration still require platform validation. */
export async function validatePostkitVideo(file: Blob & { name: string; type: string }) {
  if (file.size === 0 || file.size > 500 * 1024 * 1024)
    throw new Error("O vídeo deve ter conteúdo e no máximo 500 MB.");
  if (!/\.(mp4|mov)$/i.test(file.name)) throw new Error("Selecione um vídeo MP4 ou MOV.");
  const header = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const tag = new TextDecoder("ascii").decode(header.slice(4, 8));
  if (header.length < 12 || tag !== "ftyp")
    throw new Error(
      "O arquivo não tem um contêiner MP4/MOV compatível. Exporte novamente o vídeo.",
    );
  return /\.mov$/i.test(file.name) ? "video/quicktime" : "video/mp4";
}
