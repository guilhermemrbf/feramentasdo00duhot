import { classify, directVideoSources, pageInfo } from "../../core/media.js";

const knownScripts = new WeakMap();
const safeVideo = (url) => typeof url === "string" && !classify(url, "instagram");
function videoSources(node) {
  const versions = Array.isArray(node.video_versions) ? node.video_versions.slice(0, 100) : [];
  const ordered = versions.filter(v => safeVideo(v?.url))
    .sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
  return directVideoSources([...ordered.map(v => v.url), node.video_url, node.playback_url], "instagram");
}
function readEntries(script) {
  const raw = script.textContent;
  const saved = knownScripts.get(script);
  if (saved?.raw === raw) return saved.entries;
  if (!raw || raw.length > 3_000_000 || !/"(?:video_versions|video_url|playback_url)"/.test(raw)) return [];
  let root;
  try { root = JSON.parse(raw); } catch { return []; }
  const stack = [root];
  const entries = [];
  let visited = 0;
  while (stack.length && ++visited <= 55000) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    const code = node.shortcode || node.code || node.media_shortcode;
    if (typeof code === "string" && /^[a-z0-9_-]{1,90}$/i.test(code)) {
      const carousel = node.carousel_media || node.edge_sidecar_to_children?.edges?.map(e => e.node);
      if (Array.isArray(carousel)) {
        carousel.slice(0, 40).forEach((child, index) => {
          const [source, ...alternates] = child ? videoSources(child) : [];
          if (source) entries.push({ code, index, source, alternates });
        });
      } else {
        const [source, ...alternates] = videoSources(node);
        if (source) entries.push({ code, index: 0, source, alternates });
      }
    }
    for (const value of Object.values(node)) if (value && typeof value === "object") stack.push(value);
  }
  knownScripts.set(script, { raw, entries });
  return entries;
}
export function embeddedVideos(posts) {
  const byCode = new Map(posts.map(post => [pageInfo(post.postUrl)?.id, post]));
  if (!byCode.size) return [];
  const found = [];
  const scripts = document.querySelectorAll('script[type="application/json"], script[type="application/ld+json"]');
  for (const script of [...scripts].slice(-90)) {
    for (const { code, source, index, alternates } of readEntries(script)) {
      const post = byCode.get(code);
      if (post) found.push({ ...post, index, kind: "video", source, alternates });
    }
  }
  const current = pageInfo(location.href);
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  if (current?.id && pageInfo(canonical)?.id === current.id && byCode.has(current.id)) {
    const meta = [...document.querySelectorAll('meta[property="og:video"], meta[property="og:video:secure_url"]')]
      .map(tag => tag.content).find(safeVideo);
    if (meta) found.push({ ...byCode.get(current.id), kind: "video", index: 0, source: meta });
  }
  return found;
}
