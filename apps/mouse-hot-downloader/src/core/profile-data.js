import { pageInfo, parseUrl, profileHandle } from "./media.js";

const countPattern = /^\d[\d.,\s]*\s*(?:[kmb]|mil|mi|bi)?$/i;

export function instagramProfileHandle(raw) {
  const info = pageInfo(raw);
  if (info?.platform !== "instagram" || info.surface !== "profile") return "";
  const url = new URL(raw);
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.protocol === "http:") parts.shift();
  if (parts[0] === "_u") parts.shift();
  if (parts.length > 2 || (parts.length === 2 && !["reels", "tagged", "channel", "guides"].includes(parts[1]))) return "";
  return info.handle;
}

export function publicProfileLink(value) {
  if (typeof value !== "string" || value.length > 2048) return "";
  const url = parseUrl(value);
  return url && ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
}

export function instagramProfileData(input, handle) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      !handle || profileHandle(input.handle) !== handle) return null;
  const profile = { handle };
  for (const [key, max] of [["name", 200], ["biography", 2200]]) {
    const value = typeof input[key] === "string" ? input[key].trim().slice(0, max) : "";
    if (value) profile[key] = value;
  }
  if (Array.isArray(input.links)) {
    const links = [...new Set(input.links.slice(0, 20).map(publicProfileLink).filter(Boolean))];
    if (links.length) profile.links = links;
  }
  for (const key of ["posts", "followers", "following"]) {
    const value = input[key];
    if (Number.isSafeInteger(value) && value >= 0 ||
        typeof value === "string" && value.length <= 32 && countPattern.test(value.trim())) {
      profile[key] = typeof value === "string" ? value.trim() : value;
    }
  }
  return profile;
}
