import { randomBytes, timingSafeEqual } from "node:crypto";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { hashSalesKey, salesService } from "@/lib/sales.server";
import { trackingToken } from "./attribution";
import { sealMetaAdsToken as sealToken, openMetaAdsToken as openToken } from "./meta-ads";
import {
  exchangeGoogleToken,
  googleAccount,
  googleAuthorizationUrl,
  listGoogleAdAccounts,
  readGoogleAdSpend,
} from "./google-ads";

const callback = "/api/vendas/ads/google/callback";
const cookie = "scalehot-google-ads-state";
const maxAge = 600;

function config() {
  const clientId = process.env.SCALEHOT_GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.SCALEHOT_GOOGLE_ADS_CLIENT_SECRET;
  const developerToken = process.env.SCALEHOT_GOOGLE_ADS_DEVELOPER_TOKEN;
  const version = process.env.SCALEHOT_GOOGLE_ADS_API_VERSION;
  const key = Buffer.from(process.env.SCALEHOT_GOOGLE_ADS_ENCRYPTION_KEY ?? "", "base64");
  const base = URL.parse(process.env.APP_BASE_URL ?? "");
  if (
    !clientId ||
    !clientSecret ||
    !version ||
    !/^v\d{2}$/.test(version) ||
    key.length !== 32 ||
    !base ||
    (base.protocol !== "https:" &&
      !(base.hostname === "127.0.0.1" && process.env.NODE_ENV !== "production"))
  )
    return null;
  return {
    clientId,
    clientSecret,
    developerToken,
    version,
    key,
    secure: base.protocol === "https:",
    redirect: new URL(callback, base.origin).href,
  };
}

const cookieOptions = (secure: boolean) => ({
  path: callback,
  secure,
  httpOnly: true,
  sameSite: "lax" as const,
});
const binding = (userId: string, clientId: string) => "google-ads:" + userId + ":" + clientId;
const connections = () => salesService.from("sales_google_ads_connections");

export async function startGoogleAds(userId: string) {
  const settings = config();
  if (!settings) throw new Error("Configure a integração do Google Ads neste ambiente.");
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const pending = await connections().upsert(
    {
      user_id: userId,
      state_hash: hashSalesKey(state),
      state_expires_at: new Date(Date.now() + maxAge * 1000).toISOString(),
      state_claimed_at: null,
    },
    { onConflict: "user_id" },
  );
  if (pending.error) throw new Error("Não foi possível iniciar a conexão com o Google.");
  setCookie(cookie, state + "." + verifier, { ...cookieOptions(settings.secure), maxAge });
  return googleAuthorizationUrl(settings, state, verifier);
}

export async function finishGoogleAds(request: Request) {
  const redirect = (result: string) =>
    new Response(null, {
      status: 303,
      headers: {
        Location: "/vendas/conexoes?google=" + result,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  const settings = config();
  if (!settings) return redirect("configuration");
  const parameters = new URL(request.url).searchParams;
  const state = parameters.get("state") ?? "";
  const [stored, verifier] = (getCookie(cookie) ?? "").split(".");
  if (
    !trackingToken.test(state) ||
    !trackingToken.test(stored ?? "") ||
    !trackingToken.test(verifier ?? "") ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(stored))
  )
    return redirect("session");
  deleteCookie(cookie, cookieOptions(settings.secure));

  try {
    const hash = hashSalesKey(state);
    const claimed = await salesService.rpc("sales_google_ads_claim_state", { p_hash: hash });
    if (claimed.error || !claimed.data) return redirect("session");
    if (parameters.has("error")) return redirect("denied");
    const code = parameters.get("code");
    if (!code || code.length > 4096) return redirect("session");
    const grant = await exchangeGoogleToken(settings, { code, verifier });
    if (!grant.refresh_token) return redirect("denied");
    const accounts = await listGoogleAdAccounts(settings, grant.access_token);
    if (accounts.length === 0) return redirect("empty");
    const saved = await salesService.rpc("sales_google_ads_finish_state", {
      p_owner: claimed.data,
      p_hash: hash,
      p_client: settings.clientId,
      p_refresh: sealToken(
        grant.refresh_token,
        settings.key,
        binding(claimed.data, settings.clientId),
      ),
      p_accounts: accounts,
    });
    return redirect(!saved.error && saved.data ? "connected" : "session");
  } catch {
    return redirect("unavailable");
  }
}

async function storedGoogleAds(user: string, includeToken = false) {
  const fields = "client_id,accounts,connected_at";
  const result = await connections()
    .select(includeToken ? fields + ",refresh_ciphertext" : fields)
    .eq("user_id", user)
    .maybeSingle();
  if (result.error) throw new Error("Não foi possível consultar sua conexão com o Google Ads.");
  return result.data as {
    client_id: string | null;
    connected_at: string | null;
    accounts: unknown;
    refresh_ciphertext?: string;
  } | null;
}

export async function googleAdsStatus(user: string) {
  const settings = config();
  if (!settings) return { status: "unconfigured", accounts: [] } as const;
  const row = await storedGoogleAds(user);
  if (!row?.connected_at) return { status: "disconnected", accounts: [] } as const;
  if (row.client_id !== settings.clientId) return { status: "expired", accounts: [] } as const;
  return { status: "connected", accounts: googleAccount.array().parse(row.accounts) } as const;
}

export async function removeGoogleAds(user: string) {
  const result = await connections().delete().eq("user_id", user);
  if (result.error) throw new Error("Não foi possível desconectar o Google Ads.");
  return true;
}

export async function googleAdsReport(user: string, id: string, days: 7 | 30) {
  const settings = config();
  if (!settings) throw new Error("Configure a integração do Google Ads neste ambiente.");
  const row = await storedGoogleAds(user, true);
  const account = googleAccount
    .array()
    .parse(row?.accounts ?? [])
    .find((item) => item.id === id);
  if (!account || !row?.refresh_ciphertext || row.client_id !== settings.clientId)
    throw new Error("Reconecte o Google Ads para acessar esta conta.");
  try {
    const refresh = openToken(
      row.refresh_ciphertext,
      settings.key,
      binding(user, settings.clientId),
    );
    const grant = await exchangeGoogleToken(settings, { refresh });
    return await readGoogleAdSpend(settings, grant.access_token, account, days);
  } catch (error) {
    if (error instanceof Error && error.message === "expired")
      throw new Error("O Google revogou ou expirou esta autorização. Reconecte sua conta.");
    if (error instanceof Error && error.message === "rate_limit")
      throw new Error("O Google limitou a consulta. Tente novamente mais tarde.");
    throw new Error("Não foi possível consultar as métricas do Google Ads.");
  }
}
