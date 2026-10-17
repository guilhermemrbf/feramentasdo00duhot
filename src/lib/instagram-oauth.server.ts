const OAUTH_TTL_SECONDS = 10 * 60;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

function base64Url(value: Uint8Array | string): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function hmacKey(usage: KeyUsage): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(requiredEnv("INSTAGRAM_OAUTH_STATE_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

async function signState(payload: string): Promise<Uint8Array> {
  return new Uint8Array(
    await globalThis.crypto.subtle.sign(
      "HMAC",
      await hmacKey("sign"),
      new TextEncoder().encode(payload),
    ),
  );
}

export async function createInstagramOAuthState(input: {
  workspaceId: string;
  userId: string;
}): Promise<string> {
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const payload = base64Url(
    JSON.stringify({
      ...input,
      nonce: base64Url(nonce),
      expiresAt: Date.now() + OAUTH_TTL_SECONDS * 1000,
    }),
  );
  return `${payload}.${base64Url(await signState(payload))}`;
}

export async function verifyInstagramOAuthState(state: string): Promise<{
  workspaceId: string;
  userId: string;
}> {
  const [payload, signature, extra] = state.split(".");
  if (!payload || !signature || extra) throw new Error("Invalid OAuth state.");
  const actual = decodeBase64Url(signature);
  const isValid = await globalThis.crypto.subtle.verify(
    "HMAC",
    await hmacKey("verify"),
    actual,
    new TextEncoder().encode(payload),
  );
  if (!isValid) {
    throw new Error("Invalid OAuth state.");
  }

  const parsed = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as {
    workspaceId?: string;
    userId?: string;
    nonce?: string;
    expiresAt?: number;
  };
  if (
    !parsed.workspaceId ||
    !parsed.userId ||
    !parsed.nonce ||
    !parsed.expiresAt ||
    parsed.expiresAt < Date.now()
  ) {
    throw new Error("OAuth state expired.");
  }
  return { workspaceId: parsed.workspaceId, userId: parsed.userId };
}

export async function encryptInstagramToken(token: string): Promise<string> {
  const key = decodeBase64(requiredEnv("INSTAGRAM_TOKEN_ENCRYPTION_KEY"));
  if (key.length !== 32) throw new Error("Instagram token encryption key must decode to 32 bytes.");
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await globalThis.crypto.subtle.importKey("raw", key, "AES-GCM", false, [
    "encrypt",
  ]);
  const encrypted = new Uint8Array(
    await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      cryptoKey,
      new TextEncoder().encode(token),
    ),
  );
  return `v1.${base64Url(iv)}.${base64Url(encrypted.slice(-16))}.${base64Url(encrypted.slice(0, -16))}`;
}

export async function decryptInstagramToken(value: string): Promise<string> {
  const [version, ivPart, tagPart, encryptedPart, extra] = value.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !encryptedPart || extra) {
    throw new Error("Stored Instagram token has an unsupported format.");
  }
  const key = decodeBase64(requiredEnv("INSTAGRAM_TOKEN_ENCRYPTION_KEY"));
  if (key.length !== 32) throw new Error("Instagram token encryption key must decode to 32 bytes.");
  const cryptoKey = await globalThis.crypto.subtle.importKey("raw", key, "AES-GCM", false, [
    "decrypt",
  ]);
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64Url(ivPart), tagLength: 128 },
    cryptoKey,
    new Uint8Array([...decodeBase64Url(encryptedPart), ...decodeBase64Url(tagPart)]),
  );
  return new TextDecoder().decode(decrypted);
}

export async function getInstagramAccountAccessToken(accountId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("instagram_tokens")
    .select("access_token_ciphertext,token_expires_at,updated_at")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error || !data) throw new Error("Instagram account token is unavailable.");

  let accessToken = await decryptInstagramToken(data.access_token_ciphertext);
  if (!data.token_expires_at) throw new Error("Instagram account token has no expiry.");
  const expiresAt = new Date(data.token_expires_at).getTime();
  if (expiresAt <= Date.now()) throw new Error("Instagram account authorization expired.");

  // Long-lived Instagram tokens are refreshed before expiry, but never more
  // often than once per day. Avoids putting a refresh request on every job.
  const refreshedRecently = Date.now() - new Date(data.updated_at).getTime() < 24 * 60 * 60 * 1000;
  if (expiresAt - Date.now() < 7 * 24 * 60 * 60 * 1000 && !refreshedRecently) {
    const { graphBaseUrl } = getInstagramOAuthConfig();
    const url = new URL(`${graphBaseUrl}/refresh_access_token`);
    url.search = new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: accessToken,
    }).toString();
    const response = await fetch(url);
    if (!response.ok) throw new Error("Instagram access token refresh failed.");
    const refreshed = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!refreshed.access_token || !refreshed.expires_in) {
      throw new Error("Instagram returned an invalid refreshed token.");
    }
    accessToken = refreshed.access_token;
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("instagram_tokens")
      .update({
        access_token_ciphertext: await encryptInstagramToken(accessToken),
        encryption_key_version: "v1",
        token_expires_at: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq("account_id", accountId);
    if (updateError) throw new Error("Refreshed Instagram token could not be saved.");
    const { error: accountError } = await supabaseAdmin
      .from("instagram_accounts")
      .update({ token_expires_at: newExpiry, last_verified_at: new Date().toISOString() })
      .eq("id", accountId);
    if (accountError) throw new Error("Instagram account expiry could not be updated.");
  }
  return accessToken;
}

export function instagramOAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_TTL_SECONDS,
  };
}

export function instagramOAuthCookieName() {
  return process.env.NODE_ENV === "production" ? "__Host-instagram-oauth" : "instagram-oauth-state";
}

export function getInstagramOAuthConfig() {
  const baseUrl = new URL(requiredEnv("APP_BASE_URL"));
  if (baseUrl.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error("APP_BASE_URL must use HTTPS in production.");
  }
  const callbackUrl = new URL("/api/instagram/oauth/callback", baseUrl);
  const version = requiredEnv("META_GRAPH_API_VERSION");
  if (!/^v\d+\.\d+$/.test(version)) throw new Error("META_GRAPH_API_VERSION is invalid.");
  return {
    appId: requiredEnv("META_APP_ID"),
    appSecret: requiredEnv("META_APP_SECRET"),
    callbackUrl: callbackUrl.href,
    appBaseUrl: baseUrl,
    graphBaseUrl: `https://graph.instagram.com/${version}`,
  };
}

export function instagramAuthorizationUrl(state: string): string {
  const { appId, callbackUrl } = getInstagramOAuthConfig();
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: appId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "instagram_business_basic,instagram_business_content_publish",
    state,
  }).toString();
  return url.href;
}
