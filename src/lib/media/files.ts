export function outputName(original: string, prefix: string, mime: string) {
  const extensions: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/avif": "avif",
    "video/webm": "webm",
    "video/mp4": "mp4",
    "text/plain": "txt",
    "application/json": "json",
  };
  const base =
    original
      .replace(/\.[^.]+$/, "")
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
      .replace(/[. ]+$/, "")
      .slice(0, 140) || "arquivo";
  return `${prefix}${base}.${extensions[mime] || "bin"}`;
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function validPublicUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Processamento cancelado.", "AbortError");
}
export function isAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}
export function queueCandidates<T extends { status: string }>(items: readonly T[]) {
  return items.filter((item) => item.status === "waiting" || item.status === "error");
}

/** UI queue identifier, including local HTTP previews without randomUUID. */
export function mediaItemId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
