import { classify, pageInfo, parseUrl } from "../../core/media.js";
import { instagramProfileData, instagramProfileHandle, publicProfileLink } from "../../core/profile-data.js";

const maxHtmlBytes = 8_000_000;
const maxJsonNodes = 55_000;
const jsonSelector = 'script[type="application/json"], script[type="application/ld+json"]';
const postRoutes = new Set(["p", "reel", "reels", "tv"]);

function permalink(raw, origin) {
  const info = pageInfo(raw);
  if (info?.platform !== "instagram" || info.surface !== "post") return null;
  const url = new URL(raw);
  if (url.origin !== origin || !/^\/(?:[^/]+\/)*[^/]+\/?$/.test(url.pathname)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.protocol === "http:") parts.shift(); // Fixture route already validated by pageInfo.
  if (info.handle) parts.shift();
  if (parts.length !== 2 || !postRoutes.has(parts[0])) return null;
  url.search = "";
  url.hash = "";
  return { url, code: info.id, route: parts[0] };
}

async function readHtml(response) {
  const mime = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (response.status !== 200 || response.redirected || mime !== "text/html" ||
      Number(response.headers.get("content-length")) > maxHtmlBytes || !response.body) {
    void response.body?.cancel().catch(() => {});
    return "";
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let html = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return html + decoder.decode();
      size += value.byteLength;
      if (size > maxHtmlBytes) return "";
      html += decoder.decode(value, { stream: true });
    }
  } finally {
    void reader.cancel().catch(() => {});
  }
}

function mediaSource(raw, postUrl) {
  if (typeof raw !== "string" || !raw || raw.length > 4096) return "";
  const source = parseUrl(raw, postUrl);
  if (!source || (source.protocol === "http:" && source.origin !== postUrl.origin) ||
      classify(source.href, "instagram")) return "";
  return source.href;
}

function dimension(value) {
  const numeric = typeof value === "string" || typeof value === "number" ? Number(value) : 0;
  return Number.isFinite(numeric) && numeric > 0 && numeric <= 100_000 ? numeric : 0;
}

function largestSource(versions, postUrl) {
  if (!Array.isArray(versions)) return "";
  let best = "";
  let area = -1;
  for (const version of versions.slice(0, 100)) {
    const source = mediaSource(version?.url || version?.src, postUrl);
    const size = dimension(version?.width || version?.config_width) *
      dimension(version?.height || version?.config_height);
    if (source && size > area) {
      best = source;
      area = size;
    }
  }
  return best;
}

function describesVideo(node) {
  return node.is_video === true || node.media_type === 2 || node.media_type === "2" ||
    node.__typename === "GraphVideo" || (Array.isArray(node.video_versions) && node.video_versions.length > 0) ||
    (typeof node.video_url === "string" && !!node.video_url) ||
    (typeof node.playback_url === "string" && !!node.playback_url);
}

function asset(node, index, postUrl, videoOnly = false) {
  if (!node || typeof node !== "object") return null;
  const video = largestSource(node.video_versions, postUrl) ||
    mediaSource(node.video_url, postUrl) || mediaSource(node.playback_url, postUrl);
  const image = largestSource(node.image_versions2?.candidates || node.display_resources, postUrl) ||
    mediaSource(node.display_url, postUrl) || mediaSource(node.image_url, postUrl);
  if (video) return { postUrl: postUrl.href, index, kind: "video", source: video, thumb: image };
  if (videoOnly || describesVideo(node)) return null;
  return image ? { postUrl: postUrl.href, index, kind: "image", source: image, thumb: image } : null;
}

function jsonNodes(document) {
  return [...document.querySelectorAll(jsonSelector)].slice(-90).flatMap(script => {
    const raw = script.textContent;
    if (!raw || raw.length > 3_000_000 ||
        !/"(?:shortcode|code|media_shortcode|VideoObject|ImageObject)"/.test(raw)) return [];
    try { return [JSON.parse(raw)]; } catch { return []; }
  });
}

function structuredAsset(node, post) {
  const kind = node["@type"] === "ImageObject" ? "image" : node["@type"] === "VideoObject" ? "video" : "";
  if (kind !== "image" && kind !== "video") return null;
  const page = node.mainEntityOfPage?.["@id"] || node.mainEntityOfPage || node.url;
  if (permalink(parseUrl(page, post.url)?.href, post.url.origin)?.code !== post.code) return null;
  const source = mediaSource(node.contentUrl, post.url);
  if (!source || (kind === "image" && post.route !== "p")) return null;
  const thumb = kind === "image" ? source : mediaSource(node.thumbnailUrl, post.url);
  return { postUrl: post.url.href, index: 0, kind, source, thumb };
}

function embeddedAssets(document, post) {
  const stack = jsonNodes(document).reverse();
  const singles = [];
  const carousel = new Map();
  let hasCarousel = false;
  let hasVideo = post.route !== "p";
  let visited = 0;
  while (stack.length && ++visited <= maxJsonNodes) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if ((node.shortcode || node.code || node.media_shortcode) === post.code) {
      const children = node.carousel_media || node.edge_sidecar_to_children?.edges;
      if (Array.isArray(children) || node.media_type === 8 || node.media_type === "8" || node.__typename === "GraphSidecar") {
        hasCarousel = true;
        if (Array.isArray(children)) children.slice(0, 40).forEach((child, index) => {
          const item = asset(child?.node || child, index, post.url);
          if (item && !carousel.has(index)) carousel.set(index, item);
        });
      } else {
        const item = asset(node, 0, post.url, hasVideo);
        hasVideo ||= item?.kind === "video" || describesVideo(node);
        if (item) singles.push(item);
      }
    } else {
      const item = structuredAsset(node, post);
      if (item) {
        hasVideo ||= item.kind === "video";
        singles.push(item);
      }
    }
    for (const key of Object.keys(node)) {
      if (stack.length + visited >= maxJsonNodes) break;
      const value = node[key];
      if (value && typeof value === "object") stack.push(value);
    }
  }
  return { hasCarousel, hasVideo, items: hasCarousel ?
    [...carousel.values()].sort((a, b) => a.index - b.index) :
    singles.filter(item => !hasVideo || item.kind === "video").slice(0, 1) };
}

function meta(document, name) {
  return document.querySelector('meta[property="' + name + '"]')?.getAttribute("content") || "";
}

export async function resolveInstagramPost(postUrl, { signal } = {}) {
  const post = permalink(postUrl, location.origin);
  if (!post || signal?.aborted) return [];
  const timeout = AbortSignal.timeout(8000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(post.url.href, { method: "GET", mode: "same-origin", credentials: "same-origin",
      cache: "no-store", redirect: "error", referrerPolicy: "no-referrer", signal: requestSignal,
      headers: { Accept: "text/html" } });
    const html = await readHtml(response);
    if (!html || requestSignal.aborted) return [];
    // Template contents stay detached and inert, including scripts, images and iframes.
    const template = document.createElement("template");
    template.innerHTML = html;
    const root = template.content;
    const canonical = root.querySelector('link[rel~="canonical"]');
    if (canonical && permalink(parseUrl(canonical.getAttribute("href"), post.url)?.href,
      post.url.origin)?.code !== post.code) return [];
    const { items, hasCarousel, hasVideo } = embeddedAssets(root, post);
    if (items.length || !canonical || hasCarousel) return items;
    const videoMeta = meta(root, "og:video:secure_url") || meta(root, "og:video") || meta(root, "og:video:url");
    const source = mediaSource(videoMeta, post.url);
    const thumb = mediaSource(meta(root, "og:image:secure_url"), post.url) ||
      mediaSource(meta(root, "og:image"), post.url);
    if (source) return [{ postUrl: post.url.href, index: 0, kind: "video", source, thumb }];
    if (hasVideo || videoMeta || meta(root, "og:video:type") ||
        /^video(?:[.:]|$)/i.test(meta(root, "og:type")) || !thumb) return [];
    return [{ postUrl: post.url.href, index: 0, kind: "image", source: thumb, thumb }];
  } catch {
    return [];
  }
}

const displayedCount = "(\\d[\\d.,\\u00a0\\u202f]*(?:\\s*(?:mil|mi|bi|[kmb]))?)";
const countLabels = {
  posts: "posts?|publicaç(?:ão|ões)",
  followers: "followers?|seguidores?",
  following: "following|seguindo",
};

function countFrom(text, key) {
  return text.match(new RegExp(displayedCount + "\\s+(?:" + countLabels[key] + ")\\b", "i"))?.[1] ||
    text.match(new RegExp("^(?:" + countLabels[key] + ")\\s+" + displayedCount, "i"))?.[1] || "";
}

function visibleText(node) {
  if (!node || node.closest('[hidden], [aria-hidden="true"]') ||
      (node.ownerDocument.defaultView?.getComputedStyle && (!node.getClientRects().length ||
        node.ownerDocument.defaultView.getComputedStyle(node).visibility !== "visible"))) return "";
  return (node.innerText || node.textContent || "").trim();
}

function shownText(header, selector) {
  return [...header.querySelectorAll(selector)].map(visibleText).find(Boolean) || "";
}

export function readInstagramProfile(page = document) {
  const url = page.URL;
  const handle = instagramProfileHandle(url);
  if (!handle) return null;
  const title = meta(page, "og:title");
  const titleMatch = title.match(/^(.*?)\s*\(@([\w.-]+)\)(?:\s*[•|–-]|$)/);
  const hasTitle = titleMatch?.[2].toLowerCase() === handle;
  const header = [...page.querySelectorAll("main header, main [role=banner], body > header")].find(node =>
    [...node.querySelectorAll("h1, h2, [role=heading]")].some(heading =>
      visibleText(heading).replace(/^@/, "").toLowerCase() === handle));
  if (!header && !hasTitle) return null;
  const profile = { handle, name: hasTitle ? titleMatch[1] : "" };
  if (hasTitle) {
    const description = meta(page, "og:description");
    for (const key of Object.keys(countLabels)) profile[key] = countFrom(description, key);
  }
  if (header) {
    profile.name = shownText(header, '[data-profile-name], [itemprop="name"]') || profile.name;
    profile.biography = shownText(header, '[data-profile-bio], [itemprop="description"]') ||
      [...header.querySelectorAll("h1")].map(visibleText).find(value => value && value.toLowerCase() !== handle) || "";
    for (const key of Object.keys(countLabels)) {
      const labeled = [...header.querySelectorAll("li, a, button, [aria-label]")].find(node => {
        const text = visibleText(node);
        return text && countFrom(text, key);
      });
      profile[key] = (labeled && countFrom(visibleText(labeled), key)) || profile[key];
    }
    const origin = new URL(url).origin;
    profile.links = [...header.querySelectorAll("a[href]")].slice(0, 60).flatMap(link => {
      if (!visibleText(link)) return [];
      const target = parseUrl(link.getAttribute("href"), url);
      if (!target || target.origin === origin) return [];
      return publicProfileLink(target.hostname === "l.instagram.com" ? target.searchParams.get("u") : target.href) || [];
    });
  }
  return instagramProfileData(profile, handle);
}
