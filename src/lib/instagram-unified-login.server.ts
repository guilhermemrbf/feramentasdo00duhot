type OAuthConfig = ReturnType<typeof import("./instagram-oauth.server").getInstagramOAuthConfig>;

// Both identifiers are public parameters of the Meta OAuth dialog.
const publisherAppId = "2201393490722211";
const publisherConfigId = "2579077412515904";
const requiredScopes = ["instagram_basic", "instagram_content_publish"];

export function instagramUnifiedAuthorizationUrl(
  state: string,
  { appId, callbackUrl }: Pick<OAuthConfig, "appId" | "callbackUrl">,
): string {
  const configId =
    process.env.META_INSTAGRAM_LOGIN_CONFIG_ID?.trim() ||
    (appId === publisherAppId ? publisherConfigId : "");
  if (!/^\d+$/.test(configId)) throw new Error("Instagram Unified Login is not configured.");

  const url = new URL("https://www.facebook.com/dialog/oauth");
  url.search = new URLSearchParams({
    client_id: appId,
    config_id: configId,
    display: "popup",
    override_default_response_type: "true",
    redirect_uri: callbackUrl,
    response_type: "code",
    state,
    prompt: "login",
  }).toString();
  return url.href;
}

type GraphResponse<T> = T & { error?: object };
type Profile = { id: string; username: string };
type ProfilePage = {
  data?: Profile[];
  paging?: { next?: string; cursors?: { after?: string } };
};

async function readGraph<T>(url: URL, failure: string, bearer?: string): Promise<T> {
  const response = await fetch(url, {
    headers: bearer ? { Authorization: "Bearer " + bearer } : undefined,
    signal: AbortSignal.timeout(12_000),
  }).catch(() => null);
  const body = (await response?.json().catch(() => null)) as GraphResponse<T> | null;
  if (!response?.ok || !body || body.error) throw new Error(failure);
  return body;
}

export async function readInstagramUnifiedGrant(
  code: string,
  { appId, appSecret, callbackUrl, facebookGraphBaseUrl }: OAuthConfig,
) {
  const exchange = new URL(facebookGraphBaseUrl + "/oauth/access_token");
  exchange.search = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: callbackUrl,
    code,
  }).toString();
  const exchangeFailure = "Instagram Unified Login code exchange failed.";
  const { access_token: token } = await readGraph<{ access_token?: string }>(
    exchange,
    exchangeFailure,
  );
  if (!token) throw new Error(exchangeFailure);

  const debug = new URL(facebookGraphBaseUrl + "/debug_token");
  debug.searchParams.set("input_token", token);
  const grantFailure = "Instagram Unified Login grant is invalid.";
  const { data: grant } = await readGraph<{
    data?: {
      app_id: string;
      is_valid: boolean;
      expires_at: number;
      data_access_expires_at?: number;
      scopes?: string[];
    };
  }>(debug, grantFailure, appId + "|" + appSecret);
  if (
    !grant?.is_valid ||
    String(grant.app_id) !== appId ||
    !Number.isSafeInteger(grant.expires_at) ||
    grant.expires_at < 0
  ) {
    throw new Error(grantFailure);
  }
  const scopes = grant.scopes ?? [];
  if (!requiredScopes.every((scope) => scopes.includes(scope))) {
    throw new Error("Instagram Unified Login permissions were not granted.");
  }
  const expirations = [grant.expires_at, grant.data_access_expires_at ?? 0].filter(
    (value) => value > 0,
  );
  const expiry = expirations.length ? Math.min(...expirations) * 1000 : null;
  if (expiry !== null && expiry <= Date.now()) throw new Error(grantFailure);

  const accounts = new Map<string, Profile>();
  const cursors = new Set<string>();
  const url = new URL(facebookGraphBaseUrl + "/me/assigned_instagram_accounts");
  url.searchParams.set("fields", "id,username");
  url.searchParams.set("limit", "100");
  const accountsFailure = "Instagram Unified Login account lookup failed.";
  for (;;) {
    const { data, paging } = await readGraph<ProfilePage>(url, accountsFailure, token);
    if (!Array.isArray(data)) throw new Error(accountsFailure);
    for (const account of data) {
      if (typeof account?.id !== "string" || !/^\d+$/.test(account.id) || !account.username) {
        throw new Error(accountsFailure);
      }
      accounts.set(account.id, { id: account.id, username: account.username });
    }
    if (!paging?.next) break;
    const cursor = paging.cursors?.after;
    if (!cursor || cursors.has(cursor) || cursors.size >= 20) throw new Error(accountsFailure);
    cursors.add(cursor);
    url.searchParams.set("after", cursor);
  }
  if (!accounts.size) throw new Error("No Instagram accounts were shared in Unified Login.");

  return {
    token,
    scopes,
    expiry: expiry === null ? null : new Date(expiry).toISOString(),
    accounts: [...accounts.values()],
  };
}
