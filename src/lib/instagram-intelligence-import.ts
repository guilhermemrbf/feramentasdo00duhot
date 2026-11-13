export const PROFILE_LIMIT = 1_000;
export const IMPORT_LIMIT = 150_000;

export function instagramProfileUrl(username: string) {
  return "https://www.instagram.com/" + username + "/";
}

const reserved = new Set([
  "about",
  "accounts",
  "api",
  "challenge",
  "developer",
  "direct",
  "explore",
  "legal",
  "oauth",
  "p",
  "privacy",
  "reel",
  "reels",
  "settings",
  "stories",
  "terms",
  "tv",
  "web",
]);

function usernameOf(value: string) {
  let name = value.replace(/^@/, "");
  if (/^(?:https?:\/\/|(?:www\.)?instagram\.com\/)/i.test(value)) {
    const address = /^https?:\/\//i.test(value) ? value : "https://" + value;
    const match =
      /^https:\/\/(?:www\.)?instagram\.com\/([a-z0-9_.]{1,30})\/?(?:[?#][^\s]*)?$/i.exec(address);
    if (!match) return null;
    name = match[1];
  }
  name = name.toLowerCase();
  return /^[a-z0-9_]+(?:\.[a-z0-9_]+)*$/.test(name) && name.length <= 30 && !reserved.has(name)
    ? name
    : null;
}

export function parseInstagramProfiles(text: string) {
  const usernames = new Set<string>();
  const invalidLines: number[] = [];
  let duplicateCount = 0;
  const result = (error: "limit" | "size" | null) => ({
    usernames: Array.from(usernames),
    invalidLines,
    duplicateCount,
    error,
  });
  if (text.length > IMPORT_LIMIT) return result("size");
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    let invalid = false;
    for (const value of line.split(/[\s,;]+/).filter(Boolean)) {
      const name = usernameOf(value);
      if (name === null) invalid = true;
      else if (usernames.has(name)) duplicateCount++;
      else usernames.add(name);
      if (usernames.size > PROFILE_LIMIT) return result("limit");
    }
    if (invalid) invalidLines.push(index + 1);
  }
  return result(null);
}
