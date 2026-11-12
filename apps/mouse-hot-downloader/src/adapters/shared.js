import { pageInfo } from "../core/media.js";

export function visibleMedia(el) {
  const box = el.getBoundingClientRect();
  return box.width >= 110 && box.height >= 110 && getComputedStyle(el).visibility !== "hidden";
}
export function videoSource(video) {
  return video.currentSrc || video.src || [...video.querySelectorAll("source[src]")].find(s => s.src)?.src || "";
}
export function postLink(root, platform) {
  if (!root) return "";
  for (const a of root.querySelectorAll("a[href]")) {
    const p = pageInfo(a.href);
    if (p?.platform === platform && p.id) return a.href;
  }
  return "";
}
export function imagesAndVideos(root, opts = {}) {
  const elements = [...root.querySelectorAll("video, img")].filter(el =>
    visibleMedia(el) && !el.closest('[aria-hidden="true"]') &&
    !(el.tagName === "IMG" && /avatar|profile picture|foto do perfil|emoji/i.test(el.alt)));
  const videoThumbs = new Set(elements.filter(el => el.tagName === "VIDEO").map(el => el.poster).filter(Boolean));
  return elements.filter(el => el.tagName === "VIDEO" || (!videoThumbs.has(el.currentSrc || el.src) &&
    !el.parentElement?.querySelector("video") && (!opts.videosOnly)));
}
export function mediaEntries(root, postUrl, handle, opts) {
  const active = [...root.querySelectorAll("[aria-current='true'][aria-label],[aria-selected='true'][aria-label]")].find(el =>
    /(?:slide|photo|foto|item)\s*\d+/i.test(el.getAttribute("aria-label") || ""));
  const selected = active?.getAttribute("aria-label")?.match(/\d+/)?.[0];
  return imagesAndVideos(root, opts).slice(0, 40).map((el, i) => {
    const video = el.tagName === "VIDEO";
    const marked = el.closest("[data-index]")?.getAttribute("data-index");
    const index = marked !== undefined && marked !== null && /^\d+$/.test(marked) ? Number(marked) :
      selected ? Math.max(Number(selected) - 1, 0) + i : i;
    return {
      postUrl, handle, index, kind: video ? "video" : "image", element: el,
      source: video ? videoSource(el) : (el.currentSrc || el.src),
      thumb: video ? el.poster : (el.currentSrc || el.src),
    };
  });
}
function visibleGridElement(element) {
  return !element.closest('[hidden], [aria-hidden="true"]') &&
    !["hidden", "collapse"].includes(getComputedStyle(element).visibility);
}
export function gridEntries(platform, handle, matches) {
  const result = [];
  for (const a of document.querySelectorAll(matches)) {
    if (result.length >= 350) break;
    const info = pageInfo(a.href);
    if (info?.platform !== platform || !info.id || !visibleGridElement(a)) continue;
    const media = [...a.querySelectorAll("img, video")];
    const visible = media.filter(visibleGridElement);
    if (media.length && !visible.length) continue;
    const img = visible.find(element => element.tagName === "IMG");
    const video = visible.find(element => element.tagName === "VIDEO");
    const box = (video || img || a).getBoundingClientRect();
    if (box.width < 55 || box.height < 55) continue;
    if (info.handle && handle && info.handle !== handle) continue;
    result.push({ postUrl: a.href, handle, index: 0, kind: a.pathname.includes("/photo/") ? "image" : "video",
      source: video ? videoSource(video) : "", thumb: video?.poster || img?.currentSrc || img?.src || "" });
  }
  return result;
}
