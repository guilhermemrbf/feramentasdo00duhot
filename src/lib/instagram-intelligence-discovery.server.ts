type DiscoveryOptions = { version: string; accountId: string; token: string; username: string };
type GraphMedia = {
  permalink?: string;
  timestamp?: string;
  caption?: string;
  media_url?: string;
  thumbnail_url?: string;
  view_count?: number;
  like_count?: number;
  comments_count?: number;
};
type GraphProfile = {
  username?: string;
  name?: string;
  biography?: string;
  website?: string;
  followers_count?: number;
  media_count?: number;
  media?: { data?: GraphMedia[]; paging?: { next?: string; cursors?: { after?: string } } };
};

const PAGE_LIMIT = 4;
const REEL_LIMIT = 30;
const mediaFields =
  "permalink,timestamp,caption,media_url,thumbnail_url,view_count,like_count,comments_count";
const profileFields = "username,name,biography,website,followers_count,media_count";

function count(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function httpsUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port ? url : null;
  } catch {
    return null;
  }
}

function cdnUrl(value: unknown) {
  const url = httpsUrl(value);
  return url && /(?:^|\.)(?:cdninstagram\.com|fbcdn\.net)$/.test(url.hostname) ? url.href : null;
}

function readReel(media: GraphMedia) {
  const link = httpsUrl(media?.permalink);
  if (
    !link ||
    !["www.instagram.com", "instagram.com"].includes(link.hostname) ||
    !/^\/reel\/[a-zA-Z0-9_-]+\/?$/.test(link.pathname)
  )
    return null;
  const published = Date.parse(media.timestamp ?? "");
  if (!Number.isFinite(published)) return null;
  return {
    url: "https://www.instagram.com" + link.pathname.replace(/\/?$/, "/"),
    publishedAt: new Date(published).toISOString(),
    caption: typeof media.caption === "string" ? media.caption : null,
    videoUrl: cdnUrl(media.media_url),
    thumbnailUrl: cdnUrl(media.thumbnail_url),
    views: count(media.view_count),
    likes: count(media.like_count),
    comments: count(media.comments_count),
  };
}

function failure(http: number, code?: number) {
  if (http === 401 || code === 190 || code === 102) return { status: "reauthorize" } as const;
  if (http === 429 || http >= 500 || [1, 2, 4, 17, 32, 613].includes(code ?? 0))
    return { status: "retry" } as const;
  if (http === 403 || code === 10 || code === 200 || code === 294)
    return { status: "permission" } as const;
  return { status: "unavailable" } as const;
}

/** Media URLs are transient source references. Keep them server-side; this adapter never downloads them. */
export async function discoverInstagramProfile(options: DiscoveryOptions, request = fetch) {
  const { version, accountId, token, username } = options;
  if (
    !/^v\d+\.\d+$/.test(version) ||
    !/^\d{1,32}$/.test(accountId) ||
    !/^[a-z0-9_]+(?:\.[a-z0-9_]+)*$/.test(username) ||
    username.length > 30 ||
    !token.trim()
  )
    throw new Error("Configuração inválida para Business Discovery.");

  const endpoint = new URL("https://graph.facebook.com/" + version + "/" + accountId);
  const reels = new Map<string, NonNullable<ReturnType<typeof readReel>>>();
  const seenCursors = new Set<string>();
  let profile: GraphProfile | undefined;
  let after: string | undefined;
  let truncated = false;
  for (let page = 0; page < PAGE_LIMIT && reels.size < REEL_LIMIT; page++) {
    const cursor = after ? ".after(" + after + ")" : "";
    endpoint.searchParams.set(
      "fields",
      "business_discovery.username(" +
        username +
        "){" +
        profileFields +
        ",media.limit(30)" +
        cursor +
        "{" +
        mediaFields +
        "}}",
    );
    let response: Response;
    try {
      response = await request(endpoint.href, {
        headers: { Authorization: "Bearer " + token },
        redirect: "error",
        signal: AbortSignal.timeout(7000),
      });
    } catch {
      return { status: "retry" } as const;
    }
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: number };
      business_discovery?: GraphProfile;
    } | null;
    if (!response.ok || body?.error || !body) return failure(response.status, body?.error?.code);
    const current = body.business_discovery;
    if (current?.username?.toLowerCase() !== username) return { status: "unavailable" } as const;
    profile ??= current;
    const items = Array.isArray(current.media?.data) ? current.media.data.slice(0, 30) : [];
    for (const item of items) {
      const reel = readReel(item);
      if (reel && !reels.has(reel.url) && reels.size < REEL_LIMIT) reels.set(reel.url, reel);
    }
    const paging = current.media?.paging;
    truncated = Boolean(paging?.next) || (reels.size === REEL_LIMIT && page > 0);
    const next = paging?.cursors?.after;
    if (
      !paging?.next ||
      typeof next !== "string" ||
      !/^[a-zA-Z0-9_+=/-]{1,1024}$/.test(next) ||
      seenCursors.has(next)
    )
      break;
    seenCursors.add(next);
    after = next;
  }
  if (!profile) return { status: "unavailable" } as const;
  return {
    status: "available",
    source: "meta_business_discovery",
    viewScope: "paid_and_organic_possible_crosspost",
    username,
    name: profile.name ?? null,
    biography: profile.biography ?? null,
    website: httpsUrl(profile.website)?.href ?? null,
    followers: count(profile.followers_count),
    mediaCount: count(profile.media_count),
    truncated,
    reels: Array.from(reels.values()).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
  } as const;
}
