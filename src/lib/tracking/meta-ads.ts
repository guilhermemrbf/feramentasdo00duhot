import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

export type MetaAdsConfig = { appId: string; secret: string; version: string; redirect: string };
export type MetaAdAccount = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  active: boolean;
};
type Provider = (url: URL, init?: RequestInit) => Promise<Response>;
type GraphError = { error?: { code?: number; error_subcode?: number } };
type MetaAdsOperation =
  | "exchange_code"
  | "extend_token"
  | "inspect_token"
  | "list_accounts"
  | "read_insights";

export class MetaAdsProviderError extends Error {
  readonly operation: MetaAdsOperation;
  readonly httpStatus?: number;
  readonly providerCode?: number;
  readonly providerSubcode?: number;

  constructor(
    reason: string,
    operation: MetaAdsOperation,
    httpStatus?: number,
    providerCode?: number,
    providerSubcode?: number,
  ) {
    super(reason);
    this.operation = operation;
    this.httpStatus = httpStatus;
    this.providerCode = providerCode;
    this.providerSubcode = providerSubcode;
  }
}

export function adsAuthorizationUrl(config: MetaAdsConfig, state: string) {
  const url = new URL("/" + config.version + "/dialog/oauth", "https://www.facebook.com");
  url.search = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirect,
    response_type: "code",
    scope: "ads_read",
    state,
  }).toString();
  return url;
}

async function graph<T extends object>(
  config: MetaAdsConfig,
  operation: MetaAdsOperation,
  path: string,
  fields: Record<string, string>,
  request: Provider,
  token?: string,
) {
  const url = new URL("/" + config.version + "/" + path, "https://graph.facebook.com");
  const proof = token ? createHmac("sha256", config.secret).update(token).digest("hex") : undefined;
  url.search = new URLSearchParams(
    proof && path !== "debug_token" ? { ...fields, appsecret_proof: proof } : fields,
  ).toString();
  let response: Response;
  let body: T & GraphError;
  try {
    response = await request(url, {
      headers: token ? { Authorization: "Bearer " + token } : {},
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    body = await response.json();
  } catch {
    throw new MetaAdsProviderError("unavailable", operation);
  }
  if (!body || typeof body !== "object") {
    throw new MetaAdsProviderError("unavailable", operation, response.status);
  }
  if (!response.ok || body.error) {
    const code = body.error?.code;
    const subcode = body.error?.error_subcode;
    let reason = "unavailable";
    if (code === 190) reason = "expired";
    else if (code === 10 || code === 200 || response.status === 403) reason = "permission";
    else if (code === 4 || code === 17 || code === 80004 || response.status === 429) {
      reason = "rate_limit";
    }
    throw new MetaAdsProviderError(
      reason,
      operation,
      response.status,
      Number.isSafeInteger(code) ? code : undefined,
      Number.isSafeInteger(subcode) ? subcode : undefined,
    );
  }
  return body;
}

export async function exchangeMetaAdsGrant(
  config: MetaAdsConfig,
  code: string,
  request: Provider = fetch,
  now = Date.now(),
) {
  const app = { client_id: config.appId, client_secret: config.secret };
  const exchange = (operation: MetaAdsOperation, fields: Record<string, string>) =>
    graph<{ access_token?: string; expires_in?: number }>(
      config,
      operation,
      "oauth/access_token",
      { ...app, ...fields },
      request,
    );
  const short = await exchange("exchange_code", { redirect_uri: config.redirect, code });
  if (typeof short.access_token !== "string" || !short.access_token) {
    throw new MetaAdsProviderError("missing_token", "exchange_code");
  }
  const long = await exchange("extend_token", {
    grant_type: "fb_exchange_token",
    fb_exchange_token: short.access_token,
  });
  if (typeof long.access_token !== "string" || !long.access_token) {
    throw new MetaAdsProviderError("missing_token", "extend_token");
  }
  const { data } = await graph<{
    data?: {
      app_id?: string;
      is_valid?: boolean;
      scopes?: string[];
      expires_at?: number;
      data_access_expires_at?: number;
    };
  }>(
    config,
    "inspect_token",
    "debug_token",
    { input_token: long.access_token },
    request,
    config.appId + "|" + config.secret,
  );
  if (!data?.is_valid || data.app_id !== config.appId || !data.scopes?.includes("ads_read")) {
    throw new MetaAdsProviderError("permission", "inspect_token");
  }

  const expiries = [data.expires_at, data.data_access_expires_at]
    .filter((value): value is number => typeof value === "number" && value > 0)
    .map((value) => value * 1000);
  if (typeof long.expires_in === "number" && long.expires_in > 0) {
    expiries.push(now + long.expires_in * 1000);
  }
  // An inspected token without a declared expiry still requires periodic reauthorization.
  const end = expiries.length ? Math.min(...expiries) : now + 60 * 60 * 1000;
  const expiry = new Date(end);
  if (!Number.isFinite(expiry.getTime()) || end <= now) {
    throw new MetaAdsProviderError("expired", "inspect_token");
  }
  return { token: long.access_token, expiresAt: expiry.toISOString() };
}

export const metaAdAccountId = /^act_[0-9]{1,32}$/;

export async function listMetaAdAccounts(
  config: MetaAdsConfig,
  token: string,
  request: Provider = fetch,
) {
  const accounts = new Map<string, MetaAdAccount>();
  const cursors = new Set<string>();
  const fields = { fields: "id,name,currency,timezone_name,account_status", limit: "100" };
  let after: string | undefined;
  for (let page = 0; page < 5; page++) {
    const result: {
      data?: {
        id: string;
        name: string;
        currency: string;
        timezone_name: string;
        account_status: number;
      }[];
      paging?: { next?: string; cursors?: { after?: string } };
    } = await graph(
      config,
      "list_accounts",
      "me/adaccounts",
      after ? { ...fields, after } : fields,
      request,
      token,
    );
    if (!Array.isArray(result.data)) throw new Error("unavailable");
    for (const row of result.data) {
      if (
        !row ||
        !metaAdAccountId.test(row.id) ||
        typeof row.name !== "string" ||
        typeof row.currency !== "string" ||
        !/^[A-Z]{3}$/.test(row.currency) ||
        typeof row.timezone_name !== "string"
      )
        continue;
      accounts.set(row.id, {
        id: row.id,
        name: row.name.slice(0, 160),
        currency: row.currency,
        timezone: row.timezone_name.slice(0, 80),
        active: row.account_status === 1,
      });
    }
    if (!result.paging?.next) return [...accounts.values()];
    after = result.paging.cursors?.after;
    if (!after || cursors.has(after)) throw new Error("unavailable");
    cursors.add(after);
  }
  throw new Error("account_limit");
}

export async function readMetaAdSpend(
  config: MetaAdsConfig,
  token: string,
  account: string,
  period: { since: string; until: string },
  request: Provider = fetch,
) {
  if (!metaAdAccountId.test(account)) throw new Error("permission");
  const result = await graph<{
    data?: { spend?: string; impressions?: string; clicks?: string }[];
  }>(
    config,
    "read_insights",
    account + "/insights",
    {
      fields: "spend,impressions,clicks",
      level: "account",
      time_range: JSON.stringify(period),
    },
    request,
    token,
  );
  if (!Array.isArray(result.data) || result.data.length > 1) throw new Error("unavailable");
  const row = result.data[0];
  if (!row) return null;
  if (
    !row.spend ||
    !/^\d+(?:\.\d+)?$/.test(row.spend) ||
    !row.impressions ||
    !/^\d+$/.test(row.impressions) ||
    !row.clicks ||
    !/^\d+$/.test(row.clicks)
  ) {
    throw new Error("unavailable");
  }
  const spend = Number(row.spend);
  const impressions = Number(row.impressions);
  const clicks = Number(row.clicks);
  if (
    !Number.isFinite(spend) ||
    !Number.isSafeInteger(impressions) ||
    !Number.isSafeInteger(clicks)
  ) {
    throw new Error("unavailable");
  }
  return { spend, impressions, clicks };
}

export function sealMetaAdsToken(token: string, key: Buffer, accountBinding: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(accountBinding));
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    data.toString("base64url"),
  ].join(".");
}

export function openMetaAdsToken(value: string, key: Buffer, accountBinding: string) {
  const [version, iv, tag, data, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !data || extra !== undefined)
    throw new Error("unavailable");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(accountBinding));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString();
}
