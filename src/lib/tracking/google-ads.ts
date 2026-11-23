import { createHash } from "node:crypto";
import { z } from "zod";

export type GoogleAdsSettings = {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  version: string;
  redirect: string;
};

export const googleAccount = z.object({
  id: z.string().regex(/^\d{10}$/),
  name: z.string(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  timezone: z.string(),
  manager: z.boolean(),
  loginCustomerId: z
    .string()
    .regex(/^\d{10}$/)
    .optional(),
});
export type GoogleAdAccount = z.infer<typeof googleAccount>;
const tokenResponse = z.object({
  access_token: z.string().min(1).max(8192),
  refresh_token: z.string().min(1).max(8192).optional(),
});
const reportRow = z.object({
  metrics: z
    .object({
      costMicros: z.coerce.number().int().nonnegative().default(0),
      clicks: z.coerce.number().int().nonnegative().default(0),
      impressions: z.coerce.number().int().nonnegative().default(0),
    })
    .default({ costMicros: 0, clicks: 0, impressions: 0 }),
});

export function googleAuthorizationUrl(
  settings: GoogleAdsSettings,
  state: string,
  verifier: string,
) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: settings.clientId,
    redirect_uri: settings.redirect,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/adwords",
    access_type: "offline",
    prompt: "consent select_account",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return url.href;
}

type TokenGrant = { code: string; verifier: string } | { refresh: string };

export async function exchangeGoogleToken(
  settings: GoogleAdsSettings,
  grant: TokenGrant,
  request = fetch,
) {
  const payload =
    "code" in grant
      ? {
          grant_type: "authorization_code",
          code: grant.code,
          code_verifier: grant.verifier,
          redirect_uri: settings.redirect,
        }
      : { grant_type: "refresh_token", refresh_token: grant.refresh };
  const body = new URLSearchParams({
    client_id: settings.clientId,
    client_secret: settings.clientSecret,
  });
  for (const [field, value] of Object.entries(payload)) if (value) body.set(field, value);
  const response = await request("https://oauth2.googleapis.com/token", {
    method: "POST",
    body,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    const failure = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(failure.error === "invalid_grant" ? "expired" : "unavailable");
  }
  return tokenResponse.parse(await response.json());
}

async function adsRequest(
  settings: GoogleAdsSettings,
  access: string,
  path: string,
  request: typeof fetch,
  options?: { query: string; manager?: string },
) {
  const headers = new Headers({
    authorization: "Bearer " + access,
    "developer-token": settings.developerToken,
  });
  if (options?.manager) headers.set("login-customer-id", options.manager);
  if (options) headers.set("Content-Type", "application/json");
  const response = await request("https://googleads.googleapis.com/" + settings.version + path, {
    method: options ? "POST" : "GET",
    headers,
    body: options ? JSON.stringify({ query: options.query }) : undefined,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 401 ? "expired" : response.status === 429 ? "rate_limit" : "unavailable",
    );
  return response.json();
}

const rawAccount = z.object({
  id: z.string().regex(/^\d{10}$/),
  descriptiveName: z.string().optional(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  timeZone: z.string(),
  manager: z.boolean().default(false),
});

function accountFrom(value: z.infer<typeof rawAccount>, loginCustomerId?: string): GoogleAdAccount {
  return {
    id: value.id,
    name: value.descriptiveName || value.id,
    currency: value.currencyCode,
    timezone: value.timeZone,
    manager: value.manager,
    ...(loginCustomerId ? { loginCustomerId } : {}),
  };
}

export async function listGoogleAdAccounts(
  settings: GoogleAdsSettings,
  access: string,
  request = fetch,
) {
  const accessible = z
    .object({ resourceNames: z.array(z.string().regex(/^customers\/\d{10}$/)).default([]) })
    .parse(await adsRequest(settings, access, "/customers:listAccessibleCustomers", request));
  const accounts = new Map<string, GoogleAdAccount>();
  const directSchema = z.object({
    results: z.array(z.object({ customer: rawAccount })).default([]),
  });
  const clientsSchema = z.object({
    results: z.array(z.object({ customerClient: rawAccount })).default([]),
  });
  for (const resource of accessible.resourceNames) {
    const rows = directSchema.parse(
      await adsRequest(settings, access, "/" + resource + "/googleAds:search", request, {
        query:
          "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager FROM customer",
      }),
    );
    const direct = rows.results[0]?.customer;
    if (!direct) continue;
    if (!direct.manager) {
      accounts.set(direct.id, accountFrom(direct));
      continue;
    }
    const clients = clientsSchema.parse(
      await adsRequest(settings, access, "/" + resource + "/googleAds:search", request, {
        query:
          "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.manager FROM customer_client WHERE customer_client.level > 0 AND customer_client.manager = FALSE AND customer_client.status = 'ENABLED' LIMIT 500",
        manager: direct.id,
      }),
    );
    for (const { customerClient } of clients.results) {
      if (!accounts.has(customerClient.id))
        accounts.set(customerClient.id, accountFrom(customerClient, direct.id));
    }
  }
  return [...accounts.values()];
}

export async function readGoogleAdSpend(
  settings: GoogleAdsSettings,
  access: string,
  account: GoogleAdAccount,
  days: 7 | 30,
  request = fetch,
  now = new Date(),
) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: account.timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(now);
  const [year, month, day] = ["year", "month", "day"].map((part) =>
    Number(parts.find(({ type }) => type === part)?.value),
  );
  const since = new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10);
  const until = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
  const data = z.object({ results: z.array(reportRow).max(1).default([]) }).parse(
    await adsRequest(settings, access, "/customers/" + account.id + "/googleAds:search", request, {
      query:
        "SELECT metrics.cost_micros, metrics.impressions, metrics.clicks FROM customer WHERE segments.date BETWEEN '" +
        since +
        "' AND '" +
        until +
        "'",
      manager: account.loginCustomerId,
    }),
  );
  const metrics = data.results[0]?.metrics;
  return {
    since,
    until,
    account,
    totals: metrics
      ? {
          spend: metrics.costMicros / 1_000_000,
          clicks: metrics.clicks,
          impressions: metrics.impressions,
        }
      : null,
  };
}
