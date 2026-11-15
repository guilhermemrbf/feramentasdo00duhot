export type StoryLibraryItem = {
  path: string;
  filename: string;
  mime: "image/jpeg" | "image/png" | "video/mp4" | "video/quicktime" | "video/webm";
  size: number;
};
const types = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
} as const;
export const storyLibraryLimit = 50 * 1024 * 1024;
export function storyLibraryPrefix(workspaceId: string, accountId: string) {
  if (![workspaceId, accountId].every((id) => /^[a-f0-9-]{36}$/i.test(id)))
    throw new Error("Conta inválida.");
  return `${workspaceId}/stories/${accountId}`;
}
export function storyLibraryItem(
  prefix: string,
  name: string,
  metadata: { size?: number } | null,
): StoryLibraryItem | null {
  if (!/^[a-f0-9-]{36}--[A-Za-z0-9_.-]+$/i.test(name)) return null;
  const filename = name.slice(38);
  const mime = types[filename.split(".").at(-1)?.toLowerCase() as keyof typeof types];
  const size = Number(metadata?.size);
  return mime && size > 0 && size <= storyLibraryLimit
    ? { path: `${prefix}/${name}`, filename, mime, size }
    : null;
}
export async function validateStoryLibraryFile(file: Blob & { name: string }) {
  const mime = types[file.name.split(".").at(-1)?.toLowerCase() as keyof typeof types];
  if (!mime || !file.size || file.size > storyLibraryLimit)
    throw new Error("Use JPG, PNG, MP4, MOV ou WebM com conteúdo e até 50 MB.");
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const tag = new TextDecoder().decode(b.slice(4, 8));
  const valid =
    mime === "image/jpeg"
      ? b[0] === 255 && b[1] === 216 && b[2] === 255
      : mime === "image/png"
        ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v)
        : mime === "video/webm"
          ? [26, 69, 223, 163].every((v, i) => b[i] === v)
          : b.length >= 12 && tag === "ftyp";
  if (!valid) throw new Error(`${file.name}: o conteúdo não corresponde ao formato selecionado.`);
  return mime;
}
