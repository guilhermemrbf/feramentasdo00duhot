/** Instagram publishing API adapter. Treat an ambiguous publish response as a
 * reconciliation task; callers must never blindly retry media_publish. */

export type InstagramAuthMode = "instagram_login" | "facebook_login";

class InstagramRequestError extends Error {
  readonly status: number;

  constructor(status: number, code?: number) {
    super(`Instagram API request failed${code ? ` (${code})` : ""}: ${status}`);
    this.status = status;
  }
}

function getMetaGraphBaseUrl(mode: InstagramAuthMode = "instagram_login"): string {
  const version = process.env["META_GRAPH_API_VERSION"];
  if (!version || !/^v\d+\.\d+$/.test(version)) {
    throw new Error("Set META_GRAPH_API_VERSION to a supported Meta Graph API version.");
  }
  const host = mode === "facebook_login" ? "graph.facebook.com" : "graph.instagram.com";
  return `https://${host}/${version}`;
}

async function instagramRequest<T>(url: URL, token: string, body?: URLSearchParams): Promise<T> {
  if (url.hostname !== "graph.instagram.com" && url.hostname !== "graph.facebook.com")
    throw new Error("Unexpected Instagram API host.");
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    // Meta's API accepts the token as a bearer header; do not put credentials
    // into query strings where proxies and logs commonly capture them.
    headers: body
      ? { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" }
      : { Authorization: `Bearer ${token}` },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const result = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string; type?: string; code?: number; fbtrace_id?: string } })
    | null;
  if (!response.ok || result === null || result.error) {
    const code = result && "error" in result ? result.error?.code : undefined;
    throw new InstagramRequestError(response.status, code);
  }
  return result;
}

export type InstagramReelRequest = {
  accessToken: string;
  instagramUserId: string;
  publicVideoUrl: string;
  publicCoverUrl?: string;
  caption: string;
  shareToFeed?: boolean;
  authMode?: InstagramAuthMode;
};

export class InstagramPublishAmbiguousError extends Error {
  constructor() {
    super("Instagram publish response was inconclusive; manual reconciliation is required.");
    this.name = "InstagramPublishAmbiguousError";
  }
}

/** Publishes one Reel using Meta's container -> processing check -> publish flow. */
export async function createInstagramReelContainer(input: InstagramReelRequest): Promise<string> {
  if (!input.accessToken || !input.instagramUserId)
    throw new Error("Instagram authorization is missing.");
  if (input.caption.length > 2200) throw new Error("Instagram caption exceeds 2200 characters.");
  const videoUrl = new URL(input.publicVideoUrl);
  if (videoUrl.protocol !== "https:")
    throw new Error("Instagram media must use a public HTTPS URL.");

  const base = getMetaGraphBaseUrl(input.authMode);
  const createUrl = new URL(`${base}/${encodeURIComponent(input.instagramUserId)}/media`);
  const createBody = new URLSearchParams({
    media_type: "REELS",
    video_url: videoUrl.href,
    caption: input.caption,
    share_to_feed: String(input.shareToFeed ?? true),
  });
  if (input.publicCoverUrl) {
    const cover = new URL(input.publicCoverUrl);
    if (cover.protocol !== "https:") throw new Error("Instagram cover must use HTTPS.");
    createBody.set("cover_url", cover.href);
  }
  const container = await instagramRequest<{ id: string }>(
    createUrl,
    input.accessToken,
    createBody,
  );
  if (!container.id) throw new Error("Instagram did not return a Reel container ID.");
  return container.id;
}

export async function createInstagramFirstComment(input: {
  accessToken: string;
  mediaId: string;
  message: string;
  authMode: InstagramAuthMode;
}): Promise<"published" | "failed" | "needs_review"> {
  try {
    const url = new URL(
      `${getMetaGraphBaseUrl(input.authMode)}/${encodeURIComponent(input.mediaId)}/comments`,
    );
    const result = await instagramRequest<{ id?: string }>(
      url,
      input.accessToken,
      new URLSearchParams({ message: input.message }),
    );
    return result.id ? "published" : "needs_review";
  } catch (error) {
    return error instanceof InstagramRequestError && error.status >= 400 && error.status < 500
      ? "failed"
      : "needs_review";
  }
}

export async function getInstagramContainerStatus(
  accessToken: string,
  containerId: string,
  authMode: InstagramAuthMode = "instagram_login",
) {
  const statusUrl = new URL(`${getMetaGraphBaseUrl(authMode)}/${encodeURIComponent(containerId)}`);
  statusUrl.searchParams.set("fields", "status_code");
  const result = await instagramRequest<{ status_code?: string }>(statusUrl, accessToken);
  return result.status_code ?? "UNKNOWN";
}

export async function publishInstagramContainer(input: {
  accessToken: string;
  instagramUserId: string;
  containerId: string;
  authMode?: InstagramAuthMode;
}): Promise<{ mediaId: string }> {
  // Do not retry this call automatically on a timeout: a missing response can
  // mean that Meta accepted the publish even though the client did not see it.
  const publishUrl = new URL(
    `${getMetaGraphBaseUrl(input.authMode)}/${encodeURIComponent(input.instagramUserId)}/media_publish`,
  );
  let published: { id: string };
  try {
    published = await instagramRequest<{ id: string }>(
      publishUrl,
      input.accessToken,
      new URLSearchParams({ creation_id: input.containerId }),
    );
  } catch {
    throw new InstagramPublishAmbiguousError();
  }
  if (typeof published.id !== "string" || !published.id) throw new InstagramPublishAmbiguousError();
  return { mediaId: published.id };
}

/** One-shot helper for callers which do not use the durable worker. Never polls indefinitely. */
export async function publishInstagramReel(
  input: InstagramReelRequest,
): Promise<{ mediaId: string }> {
  const containerId = await createInstagramReelContainer(input);
  if ((await getInstagramContainerStatus(input.accessToken, containerId)) !== "FINISHED") {
    throw new Error(
      "Instagram processing is pending; use the durable worker to resume this container.",
    );
  }
  return publishInstagramContainer({ ...input, containerId });
}
