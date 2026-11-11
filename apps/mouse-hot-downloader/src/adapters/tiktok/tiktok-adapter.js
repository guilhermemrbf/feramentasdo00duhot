import { gridEntries, mediaEntries, postLink } from "../shared.js";

export function scanTikTok(current) {
  if (current.surface === "profile") {
    return gridEntries("tiktok", current.handle, 'a[href*="/video/"], a[href*="/photo/"]');
  }
  if (current.surface === "post") {
    const root = document.querySelector('[data-e2e="browse-video"]') ||
      document.querySelector('[data-e2e="video-detail"]') ||
      document.querySelector("main") || document.body;
    const visual = /\/photo\//.test(location.pathname) ?
      root.querySelector('[data-e2e="photo-mode"],[role="listbox"],[class*="PhotoMode"]') || root : root;
    return mediaEntries(visual, location.href, current.handle, { videosOnly: !location.pathname.includes("/photo/") });
  }
  return [...document.querySelectorAll('[data-e2e="recommend-list-item-container"], article')].slice(0, 100).flatMap(root => {
    const post = postLink(root, "tiktok");
    return post ? mediaEntries(root, post, "", { videosOnly: new URL(post).pathname.includes("/video/") }) : [];
  });
}
