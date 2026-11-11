import { pageInfo } from "../../core/media.js";
import { gridEntries, mediaEntries, postLink } from "../shared.js";
import { embeddedVideos } from "./embedded-media.js";

const postSelector = 'a[href*="/reel/"], a[href*="/reels/"], a[href*="/p/"], a[href*="/tv/"]';

function author(root) {
  for (const a of root.querySelectorAll("header a[href], [role=heading] a[href]")) {
    const info = pageInfo(a.href);
    if (info?.surface === "profile" && info.handle) return info.handle;
  }
  return "";
}
export function scanInstagram(current) {
  if (current.surface === "story" || current.surface === "highlight") {
    if (!current.id) return [];
    const root = document.querySelector("[role=dialog]") || document.querySelector("main") || document.body;
    return mediaEntries(root, location.href, current.handle || author(root));
  }
  const dialog = [...document.querySelectorAll('[role="dialog"]')].find(el => el.querySelector("video, article"));
  if (current.surface === "post") {
    const root = dialog || document.querySelector("main article") || document.querySelector("article, main") || document.body;
    const entry = { postUrl: location.href, handle: current.handle || author(root), kind: "video", index: 0 };
    return [...mediaEntries(root, entry.postUrl, entry.handle, {
      videosOnly: /\/reels?\//.test(location.pathname),
    }), ...embeddedVideos([entry])];
  }
  const groups = dialog ? [dialog] : [...document.querySelectorAll("article")];
  const posts = groups.slice(0, 100).flatMap(root => {
    const post = postLink(root, "instagram");
    return post ? mediaEntries(root, post, author(root) || current.handle, {
      videosOnly: /\/reel\//.test(new URL(post).pathname),
    }) : [];
  });
  if (current.surface === "profile") {
    const grid = gridEntries("instagram", current.handle, postSelector);
    posts.push(...grid, ...embeddedVideos(grid));
  }
  return posts;
}
