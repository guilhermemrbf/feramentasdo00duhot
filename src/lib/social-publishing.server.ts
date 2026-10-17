/** Instagram publishing API adapter. Treat an ambiguous publish response as a
 * reconciliation task; callers must never blindly retry media_publish. */

function getMetaGraphBaseUrl(): string {
  const version = process.env["META_GRAPH_API_VERSION"];
  if (!version || !/^v\d+\.\d+$/.test(version)) {
    throw new Error("Set META_GRAPH_API_VERSION to a supported Meta Graph API version.");
  }
  return `https://graph.instagram.com/${version}`;
}

async function instagramRequest<T>(url: URL, token: string, body?: URLSearchParams): Promise<T> {
  if (!url.hostname.endsWith("instagram.com")) throw new Error("Unexpected Instagram API host.");
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    // Meta's API accepts the token as a bearer header; do not put credentials
    // into query strings where proxies and logs commonly capture them.
    headers: body
      ? { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" }
      : { Authorization: `Bearer ${token}` },
    body,
  });
  const result = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string; type?: string; code?: number; fbtrace_id?: string } })
    | null;
  if (!response.ok || result === null || result.error) {
    const code = result && "error" in result ? result.error?.code : undefined;
    throw new Error(`Instagram API request failed${code ? ` (${code})` : ""}: ${response.status}`);
  }
  return result;
}

export type InstagramReelRequest = {
  accessToken: string;
  instagramUserId: string;
  publicVideoUrl: string;
  caption: string;
  shareToFeed?: boolean;
};

/** Publishes one Reel using Meta's container -> processing check -> publish flow. */
export async function publishInstagramReel(
  input: InstagramReelRequest,
): Promise<{ mediaId: string }> {
  if (!input.accessToken || !input.instagramUserId)
    throw new Error("Instagram authorization is missing.");
  if (input.caption.length > 2200) throw new Error("Instagram caption exceeds 2200 characters.");
  const videoUrl = new URL(input.publicVideoUrl);
  if (videoUrl.protocol !== "https:")
    throw new Error("Instagram media must use a public HTTPS URL.");

  const base = getMetaGraphBaseUrl();
  const createUrl = new URL(`${base}/${encodeURIComponent(input.instagramUserId)}/media`);
  const createBody = new URLSearchParams({
    media_type: "REELS",
    video_url: videoUrl.href,
    caption: input.caption,
    share_to_feed: String(input.shareToFeed ?? true),
  });
  const container = await instagramRequest<{ id: string }>(
    createUrl,
    input.accessToken,
    createBody,
  );
  if (!container.id) throw new Error("Instagram did not return a Reel container ID.");

  const statusUrl = new URL(`${base}/${encodeURIComponent(container.id)}`);
  statusUrl.searchParams.set("fields", "status_code");
  let ready = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const status = await instagramRequest<{ status_code?: string }>(statusUrl, input.accessToken);
    if (status.status_code === "FINISHED") {
      ready = true;
      break;
    }
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error(`Instagram Reel processing ended with ${status.status_code}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  if (!ready)
    throw new Error("Instagram Reel processing is still pending; reconcile before retrying.");

  // Do not retry this call automatically on a timeout: a missing response can
  // mean that Meta accepted the publish even though the client did not see it.
  const publishUrl = new URL(`${base}/${encodeURIComponent(input.instagramUserId)}/media_publish`);
  const published = await instagramRequest<{ id: string }>(
    publishUrl,
    input.accessToken,
    new URLSearchParams({ creation_id: container.id }),
  );
  if (!published.id) throw new Error("Instagram did not confirm a published media ID.");
  return { mediaId: published.id };
}
