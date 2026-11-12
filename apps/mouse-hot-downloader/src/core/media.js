const fixture = typeof __MOUSE_HOT_FIXTURE__ !== "undefined" && __MOUSE_HOT_FIXTURE__;
const cdns = {
  instagram: ["cdninstagram.com", "fbcdn.net"],
  tiktok: ["tiktokcdn.com", "tiktokcdn-us.com", "tiktokcdn-eu.com", "tiktokv.com", "tiktok.com"],
};
const nonProfiles = new Set(["accounts","explore","direct","reels","p","reel","tv","challenge","about",
  "web","legal","oauth","api","developer","privacy","stories","emails","settings"]);
const postRoutes = ["p", "reel", "reels", "tv"];
const exactOrSubdomain = (host, suffix) => host === suffix || host.endsWith("." + suffix);
const safeHandle = /^[a-z0-9._-]{1,80}$/i;
const safeId = /^[a-z0-9_-]{1,90}$/i;
const formats = {
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
};
export function parseUrl(raw, base) {
  if (typeof raw !== "string" || raw.length > 4096) return null;
  try { return new URL(raw, base); } catch { return null; }
}
export function pageInfo(raw) {
  const u = parseUrl(raw);
  if (!u || u.username || u.password) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  const local = fixture && u.protocol === "http:" && u.hostname === "127.0.0.1";
  if (local) parts.shift();
  if (local ? u.pathname.startsWith("/ig/") : u.protocol === "https:" && !u.port &&
      ["www.instagram.com", "instagram.com"].includes(u.hostname)) {
    const hasProfilePrefix = parts.length >= 3 && !nonProfiles.has(parts[0]?.toLowerCase()) &&
      safeHandle.test(parts[0]) && postRoutes.includes(parts[1]);
    const postIndex = hasProfilePrefix ? 1 : 0;
    if (postRoutes.includes(parts[postIndex]) && safeId.test(parts[postIndex + 1] || "")) {
      return { platform: "instagram", id: parts[postIndex + 1], handle: hasProfilePrefix ? parts[0].toLowerCase() : "",
        surface: "post" };
    }
    if (parts[0] === "stories") {
      const highlight = parts[1] === "highlights";
      if (highlight && !safeId.test(parts[2] || "")) return null;
      const handle = highlight ? "" : parts[1] || "";
      if (handle && !safeHandle.test(handle)) return null;
      return { platform: "instagram", id: safeId.test(parts[2] || "") ? parts[2] : "",
        handle: handle.toLowerCase(), surface: highlight ? "highlight" : "story" };
    }
    const handle = (parts[0] === "_u" ? parts[1] : parts[0]) || "";
    if (handle && !safeHandle.test(handle)) return null;
    const profile = handle && !nonProfiles.has(handle.toLowerCase());
    return { platform: "instagram", id: "", handle: profile ? handle.toLowerCase() : "",
      surface: profile ? "profile" : "feed" };
  }
  if (local ? u.pathname.startsWith("/tt/") : u.protocol === "https:" && !u.port &&
      ["www.tiktok.com", "tiktok.com", "m.tiktok.com"].includes(u.hostname)) {
    const handle = parts[0]?.startsWith("@") ? parts[0].slice(1) : "";
    if (handle && !safeHandle.test(handle)) return null;
    const id = ["video","photo"].includes(parts[1]) && safeId.test(parts[2] || "") ? parts[2] : "";
    return { platform: "tiktok", id, handle: handle.toLowerCase(),
      surface: id ? "post" : handle ? "profile" : "feed" };
  }
  return null;
}
export function mediaUrl(raw, platform) {
  const u = parseUrl(raw);
  if (!u || u.username || u.password) return null;
  if (fixture && u.protocol === "http:" && u.hostname === "127.0.0.1" && u.pathname.startsWith("/media/")) return u;
  if (u.protocol !== "https:" || u.port || !(cdns[platform] || []).some(s => exactOrSubdomain(u.hostname, s))) return null;
  return u;
}
export function classify(raw, platform) {
  const u = parseUrl(raw);
  if (u?.protocol === "blob:") return "O player só mostrou um vídeo interno, sem arquivo direto.";
  if (u && (/\.(?:m3u8|mpd|m4s|ts)$/i.test(u.pathname) ||
      [...u.searchParams.keys()].some(key => /^(?:bytestart|byteend)$/i.test(key)))) return "O vídeo está dividido em segmentos.";
  if (!mediaUrl(raw, platform)) return "O site não mostrou um arquivo de uma origem compatível.";
  return "";
}
export function makeCandidate(input, platform) {
  if (!cdns[platform] || !input || !["image", "video"].includes(input.kind)) return null;
  const post = pageInfo(input.postUrl);
  if (post?.platform !== platform || !post.id) return null;
  const id = post.id;
  const index = Number.isInteger(input.index) && input.index >= 0 && input.index < 100 ? input.index : 0;
  const handle = post.handle || (safeHandle.test(input.handle || "") ? input.handle.toLowerCase() : "");
  const surface = post.surface;
  const key = [platform, surface, id, index, input.kind].join(":");
  const u = parseUrl(input.postUrl);
  const source = typeof input.source === "string" && input.source.length <= 4096 ? input.source : "";
  const reason = source ? classify(source, platform) : "";
  return {
    key, platform, id, index, kind: input.kind, handle, source: reason ? "" : (mediaUrl(source, platform)?.href || ""),
    postUrl: u.origin + u.pathname, thumb: mediaUrl(input.thumb, platform)?.href || "",
    status: reason ? "unavailable" : source ? "check" : "open", reason,
  };
}
export function profileHandle(value) {
  return typeof value === "string" && safeHandle.test(value) ? value.toLowerCase() : "";
}
export function cleanPathPart(value) {
  const clean = value.toLowerCase().replace(/[^a-z0-9._-]/g, "_").replace(/^\.+|\.+$/g, "").slice(0, 80).replace(/\.+$/g, "");
  return !clean || /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(clean) ?
    "perfil_" + (clean || "sem-nome") : clean;
}
export function filePath(item, ext) {
  if (!Object.values(formats).includes(ext)) throw new Error("Formato inválido.");
  const site = item.platform === "instagram" ? "Instagram" : "TikTok";
  const profile = cleanPathPart(item.handle || "perfil-nao-identificado");
  return "Mouse Hot/" + site + "/" + profile + "/" + cleanPathPart(item.surface || item.key.split(":")[1]) + "_" +
    cleanPathPart(item.id) + "_" + (item.index + 1) + "_" + item.kind + "." + ext;
}
function sniff(bytes) {
  const ascii = (from, to) => String.fromCharCode(...bytes.subarray(from, to));
  if (ascii(4, 8) === "ftyp") return ascii(8, 12) === "qt  " ? "mov" :
    /^(avif|avis|heic|heix|mif1|msf1)$/.test(ascii(8, 12)) ? "" : "mp4";
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3 &&
      ascii(0, bytes.length).includes("webm")) return "webm";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 137 && ascii(1, 4) === "PNG" && ascii(4, 8) === "\r\n\x1a\n") return "png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (["GIF87a", "GIF89a"].includes(ascii(0, 6))) return "gif";
  return "";
}
export async function verifyMedia(item, fetcher = fetch) {
  const invalid = classify(item.source, item.platform);
  if (invalid) throw new Error(invalid);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6500);
  let reader;
  try {
    const response = await fetcher(item.source, {
      signal: ctrl.signal, credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
      redirect: "error", headers: { Range: "bytes=0-511" },
    });
    if ([401, 403, 404, 410].includes(response.status)) throw new Error("Arquivo expirado ou sem acesso. Reabra a publicação.");
    if (![200, 206].includes(response.status)) throw new Error("O servidor de mídia não disponibilizou o arquivo.");
    if (response.status === 206 && !/^bytes 0-\d+\/(?:\d+|\*)$/i.test(response.headers.get("content-range") || "")) {
      throw new Error("A origem não retornou o início do arquivo.");
    }
    const mime = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (mime && mime !== "application/octet-stream" && !formats[mime]) throw new Error("O servidor não retornou um formato compatível.");
    reader = response.body?.getReader();
    const sample = new Uint8Array(512);
    let n = 0;
    while (reader && n < sample.length) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, sample.length - n);
      sample.set(chunk, n);
      n += chunk.length;
    }
    const ext = sniff(sample.subarray(0, n));
    if (!ext || (formats[mime] && formats[mime] !== ext) ||
        (["mp4","webm","mov"].includes(ext) ? "video" : "image") !== item.kind) {
      throw new Error("O conteúdo não corresponde à mídia detectada.");
    }
    return ext;
  } catch (error) {
    if (error.name === "AbortError" || error instanceof TypeError) {
      throw new Error("Não foi possível verificar o arquivo. Confira a permissão de mídia ou reabra a publicação.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    ctrl.abort();
    void reader?.cancel().catch(() => {});
  }
}
