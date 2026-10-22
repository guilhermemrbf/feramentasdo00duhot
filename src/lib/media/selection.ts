export function selectMediaFiles<
  T extends { name: string; type: string; size: number; lastModified: number },
>(files: readonly T[], current: readonly T[], types: readonly string[]) {
  const key = (file: T) => `${file.name}\0${file.size}\0${file.lastModified}\0${file.type}`;
  const seen = new Set(current.map(key));
  const accepted: T[] = [];
  let rejected = 0;
  for (const file of files) {
    if (!types.includes(file.type) || file.size <= 0 || seen.has(key(file))) {
      rejected++;
      continue;
    }
    seen.add(key(file));
    accepted.push(file);
  }
  return { accepted, rejected };
}
export function formatMediaLink(
  item: { url: string; fileName: string; type: "image" | "video" },
  format: "url" | "markdown" | "html" | "ai",
) {
  const escape = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const label = item.fileName.replace(/[\\\[\]]/g, "\\$&");
  if (format === "html")
    return item.type === "video"
      ? `<video src="${escape(item.url)}" controls></video>`
      : `<img src="${escape(item.url)}" alt="${escape(item.fileName)}" />`;
  if (format === "markdown")
    return `${item.type === "image" ? "!" : ""}[${label}](${item.url.replace(/\(/g, "%28").replace(/\)/g, "%29")})`;
  if (format === "ai") return `Use this ${item.type} as reference: ${item.url}`;
  return item.url;
}
