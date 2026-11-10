import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptInstagramToken, getInstagramAccountAccessToken } from "./instagram-oauth.server";
import type { PostkitDatabase } from "./postkit-database";
import { getMetaGraphBaseUrl, type InstagramAuthMode } from "./social-publishing.server";

type Issue = "permission" | "reconnect" | "temporary";
type Media = {
  id: string;
  kind: "reel" | "post" | "story";
  published_at: string;
  permalink: string | null;
  likes: number | null;
  comments: number | null;
};
type Job = {
  account_id: string;
  lease_id: string;
  instagram_user_id: string;
  auth_mode: InstagramAuthMode;
  edge: "media" | "stories" | null;
  after: string | null;
  media: string[];
};
type Result = {
  issue?: Issue;
  graph?: { status: number; code?: number };
  discovered?: boolean;
  restart?: boolean;
  after?: string;
  followers?: number;
  following?: number;
  catalog?: Media[];
  measurements?: Array<{ id: string; views: number | null }>;
};

class GraphError extends Error {
  constructor(
    readonly status: number,
    readonly code?: number,
  ) {
    super("Instagram analytics request failed.");
  }
}

async function readGraph<T>(
  base: string,
  path: string,
  params: Record<string, string>,
  token: string,
) {
  const url = new URL(`${base}/${path}`);
  url.search = new URLSearchParams(params).toString();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: "error",
    signal: AbortSignal.timeout(7_000),
  });
  const value = (await response.json().catch(() => null)) as
    | (T & { error?: { code?: number } })
    | null;
  if (!response.ok || !value || value.error)
    throw new GraphError(response.status, value?.error?.code);
  return value;
}

function classify(error: unknown): Issue {
  if (error instanceof GraphError) {
    if (error.status === 401 || error.code === 190 || error.code === 102) return "reconnect";
    if (error.status === 403 || error.code === 10 || error.code === 200 || error.code === 294)
      return "permission";
  }
  return "temporary";
}

function metricCount(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function instagramPermalink(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      ["instagram.com", "www.instagram.com"].includes(url.hostname)
      ? url.origin + url.pathname
      : null;
  } catch {
    return null;
  }
}

async function readPage(base: string, token: string, job: Job, result: Result) {
  const account = encodeURIComponent(job.instagram_user_id);
  const baseFields = "id,media_product_type,timestamp,permalink";
  const query: Record<string, string> = {
    fields: job.edge === "media" ? baseFields + ",like_count,comments_count" : baseFields,
    limit: "50",
  };
  if (job.after) query.after = job.after;
  const read = (params: Record<string, string>) =>
    readGraph<{
      data?: Array<{
        id: string;
        media_product_type?: string;
        timestamp?: string;
        permalink?: string;
        like_count?: number;
        comments_count?: number;
      }>;
      paging?: { next?: string; cursors?: { after?: string } };
    }>(base, `${account}/${job.edge}`, params, token);
  const page = await read(query).catch((error) => {
    if (job.edge === "media" && error instanceof GraphError && error.code === 100)
      return read({ ...query, fields: baseFields });
    throw error;
  });
  if (!Array.isArray(page.data)) throw new Error("Instagram media response is missing its list.");
  const items = new Map<string, Media>();
  for (const item of page.data) {
    const kind =
      job.edge === "stories"
        ? "story"
        : item.media_product_type === "REELS"
          ? "reel"
          : item.media_product_type === "FEED"
            ? "post"
            : null;
    if (!kind || !item.id || !item.timestamp || !Number.isFinite(Date.parse(item.timestamp)))
      continue;
    items.set(item.id, {
      id: item.id,
      kind,
      published_at: item.timestamp,
      permalink: instagramPermalink(item.permalink),
      likes: metricCount(item.like_count) ?? null,
      comments: metricCount(item.comments_count) ?? null,
    });
  }
  const next = page.paging?.next ? page.paging.cursors?.after : undefined;
  if (page.paging?.next && (!next || next === job.after))
    throw new Error("Instagram media pagination did not advance.");
  result.discovered = true;
  result.after = next;
  result.catalog = [...items.values()];
}

async function collect(job: Job, token: string) {
  const base = getMetaGraphBaseUrl(job.auth_mode);
  const result: Result = {};
  const catalog = async () => {
    if (!job.edge) return;
    try {
      await readPage(base, token, job, result);
    } catch (error) {
      if (error instanceof GraphError) {
        result.graph = { status: error.status, code: error.code };
      }
      if (
        job.edge === "stories" &&
        error instanceof GraphError &&
        (error.code === 100 || classify(error) === "permission")
      ) {
        // Some accounts don't expose the Stories edge.
        result.discovered = true;
      } else {
        result.issue = classify(error);
        result.restart = !!job.after && error instanceof GraphError && error.code === 100;
      }
    }
  };
  const profile = async () => {
    if (job.edge !== "media" || job.after) return;
    const data = await readGraph<{ followers_count?: number; follows_count?: number }>(
      base,
      encodeURIComponent(job.instagram_user_id),
      { fields: "followers_count,follows_count" },
      token,
    ).catch(() => undefined);
    result.followers = metricCount(data?.followers_count);
    result.following = metricCount(data?.follows_count);
  };
  const measures = async () => {
    const responses = await Promise.all(
      job.media.map(async (id) => {
        try {
          const metrics = await readGraph<{
            data?: Array<{
              name?: string;
              values?: Array<{ value?: unknown }>;
              total_value?: { value?: unknown };
            }>;
          }>(base, `${encodeURIComponent(id)}/insights`, { metric: "views" }, token);
          const views = metrics.data?.find((metric) => metric.name === "views");
          return {
            id,
            views: metricCount(views?.values?.[0]?.value ?? views?.total_value?.value) ?? null,
          };
        } catch (error) {
          if (error instanceof GraphError && error.code === 100) return { id, views: null };
          return { issue: classify(error) };
        }
      }),
    );
    result.measurements = responses.flatMap((response) =>
      "id" in response && response.id ? [{ id: response.id, views: response.views ?? null }] : [],
    );
    return responses.flatMap((response) => (response.issue ? [response.issue] : []));
  };
  const [, , issues] = await Promise.all([catalog(), profile(), measures()]);
  if (issues.includes("reconnect")) result.issue = "reconnect";
  else if (issues.includes("permission") && result.issue !== "reconnect")
    result.issue = "permission";
  else if (issues.length && !result.issue) result.issue = "temporary";
  return result;
}

export async function runInstagramAnalytics(client: SupabaseClient<PostkitDatabase>) {
  const { data, error } = await client.rpc("claim_instagram_analytics");
  if (error) return Response.json({ error: "Analytics queue unavailable." }, { status: 503 });
  const job = data as Job | null;
  if (!job) return Response.json({ claimed: 0 });

  let result: Result;
  try {
    const authorization = await analyticsAuthorization(client, job);
    if (!authorization) result = { issue: "reconnect" };
    else {
      result = await collect(job, authorization.token);
      if (
        !authorization.insightsGranted &&
        (result.issue ||
          (result.measurements?.length && result.measurements.every((m) => m.views === null)))
      ) {
        result.issue = "permission";
      }
    }
  } catch {
    result = { issue: "reconnect" };
  }
  const finish = await client.rpc("finish_instagram_analytics", {
    p_account: job.account_id,
    p_lease: job.lease_id,
    p_result: result,
  });
  if (finish.error || !finish.data)
    return Response.json({ error: "Analytics checkpoint unavailable." }, { status: 503 });
  return Response.json({
    claimed: 1,
    discovered: result.catalog?.length ?? 0,
    measured: result.measurements?.filter((m) => m.views !== null).length ?? 0,
    issue: result.issue,
    graph: result.graph,
  });
}

async function analyticsAuthorization(client: SupabaseClient<PostkitDatabase>, job: Job) {
  if (job.auth_mode !== "facebook_login") {
    return { token: await getInstagramAccountAccessToken(job.account_id), insightsGranted: true };
  }
  const { data, error } = await client
    .from("instagram_tokens")
    .select("analytics_access_token_ciphertext,analytics_token_expires_at")
    .eq("account_id", job.account_id)
    .maybeSingle();
  if (error) throw error;
  if (data?.analytics_access_token_ciphertext) {
    if (
      !data.analytics_token_expires_at ||
      Date.parse(data.analytics_token_expires_at) <= Date.now()
    )
      return null;
    return {
      token: await decryptInstagramToken(data.analytics_access_token_ciphertext),
      insightsGranted: true,
    };
  }
  return { token: await getInstagramAccountAccessToken(job.account_id), insightsGranted: false };
}
