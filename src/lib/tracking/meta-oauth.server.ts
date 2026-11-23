import { randomBytes, timingSafeEqual } from "node:crypto";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { hashSalesKey, salesService } from "@/lib/sales.server";
import { trackingToken } from "./attribution";
import {
  adsAuthorizationUrl,
  exchangeMetaAdsGrant,
  listMetaAdAccounts,
  openMetaAdsToken,
  readMetaAdSpend,
  sealMetaAdsToken,
  type MetaAdAccount,
} from "./meta-ads";

const callback = "/api/vendas/ads/meta/callback";
const cookie = "scalehot-meta-ads-state";
const maxAge = 600;

function config() {
  if (process.env.SCALEHOT_META_ADS_ENABLED !== "1") return null;
  const dedicated =
    process.env.SCALEHOT_META_ADS_APP_ID || process.env.SCALEHOT_META_ADS_APP_SECRET;
  const appId = dedicated ? process.env.SCALEHOT_META_ADS_APP_ID : process.env.META_APP_ID;
  const secret = dedicated ? process.env.SCALEHOT_META_ADS_APP_SECRET : process.env.META_APP_SECRET;
  const version = process.env.META_GRAPH_API_VERSION;
  const origin = process.env.APP_BASE_URL;
  const key = Buffer.from(process.env.SCALEHOT_META_ADS_ENCRYPTION_KEY || "", "base64");
  if (
    !appId ||
    !/^[0-9]{1,32}$/.test(appId) ||
    !secret ||
    !version ||
    !/^v[0-9]+\.[0-9]+$/.test(version) ||
    !origin ||
    key.length !== 32
  )
    return null;
  try {
    const base = new URL(origin);
    if (
      base.protocol !== "https:" &&
      !(base.hostname === "127.0.0.1" && process.env.NODE_ENV !== "production")
    )
      return null;
    return {
      appId,
      secret,
      version,
      redirect: new URL(callback, base.origin).href,
      key,
      secure: base.protocol === "https:",
    };
  } catch {
    return null;
  }
}

const cookieOptions = (secure: boolean) => ({
  path: callback,
  httpOnly: true,
  secure,
  sameSite: "lax" as const,
});

export async function startMetaAds(userId: string) {
  const settings = config();
  if (!settings) throw new Error("A conexão de anúncios ainda não foi configurada.");
  const state = randomBytes(32).toString("base64url");
  const pending = await salesService.from("sales_meta_ads_connections").upsert(
    {
      user_id: userId,
      state_hash: hashSalesKey(state),
      state_expires_at: new Date(Date.now() + maxAge * 1000).toISOString(),
      state_claimed_at: null,
    },
    { onConflict: "user_id" },
  );
  if (pending.error) throw new Error("Não foi possível iniciar a conexão com a Meta.");
  setCookie(cookie, state, { ...cookieOptions(settings.secure), maxAge });
  return adsAuthorizationUrl(settings, state).href;
}

export async function finishMetaAds(request: Request) {
  const redirect = (result: string) =>
    new Response(null, {
      status: 303,
      headers: {
        Location: "/vendas/conexoes?meta=" + result,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  const settings = config();
  if (!settings) return redirect("configuration");
  const params = new URL(request.url).searchParams;
  const stored = getCookie(cookie);
  const state = params.get("state");
  if (
    !state ||
    !stored ||
    !trackingToken.test(state) ||
    !trackingToken.test(stored) ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(stored))
  )
    return redirect("session");
  deleteCookie(cookie, cookieOptions(settings.secure));
  try {
    const stateHash = hashSalesKey(state);
    const pending = await salesService.rpc("sales_meta_ads_claim_state", { p_hash: stateHash });
    if (pending.error || !pending.data) return redirect("session");
    if (params.has("error")) return redirect("denied");
    const code = params.get("code");
    if (!code || code.length > 4096) return redirect("session");
    const grant = await exchangeMetaAdsGrant(settings, code);
    const accounts = await listMetaAdAccounts(settings, grant.token);
    if (!accounts.length) return redirect("empty");
    const saved = await salesService.rpc("sales_meta_ads_finish_state", {
      p_owner: pending.data,
      p_hash: stateHash,
      p_app: settings.appId,
      p_token: sealMetaAdsToken(grant.token, settings.key, pending.data + ":" + settings.appId),
      p_expiry: grant.expiresAt,
      p_accounts: accounts,
    });
    return redirect(!saved.error && saved.data ? "connected" : "session");
  } catch (error) {
    return redirect(
      error instanceof Error && error.message === "permission" ? "denied" : "unavailable",
    );
  }
}

async function storedConnection(userId: string, includeToken = false) {
  const fields = "app_id,token_expires_at,accounts,connected_at";
  const { data, error } = await salesService
    .from("sales_meta_ads_connections")
    .select(includeToken ? fields + ",token_ciphertext" : fields)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar a conexão de anúncios.");
  return data as {
    app_id: string | null;
    token_ciphertext?: string | null;
    token_expires_at: string | null;
    accounts: MetaAdAccount[];
    connected_at: string | null;
  } | null;
}

export async function metaAdsStatus(userId: string) {
  const settings = config();
  if (!settings) return { status: "unconfigured", accounts: [] } as const;
  const row = await storedConnection(userId);
  if (!row?.connected_at) return { status: "disconnected", accounts: [] } as const;
  if (
    row.app_id !== settings.appId ||
    !row.token_expires_at ||
    Date.parse(row.token_expires_at) <= Date.now()
  ) {
    return { status: "expired", accounts: [] } as const;
  }
  return { status: "connected", accounts: row.accounts } as const;
}

export async function removeMetaAds(userId: string) {
  const { error } = await salesService
    .from("sales_meta_ads_connections")
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error("Não foi possível desconectar a Meta.");
  return true;
}

export async function metaAdsReport(userId: string, accountId: string, days: number) {
  const settings = config();
  if (!settings) throw new Error("A conexão de anúncios ainda não foi configurada.");
  const row = await storedConnection(userId, true);
  const account = row?.accounts.find(({ id }) => id === accountId);
  if (
    !account ||
    !row?.token_ciphertext ||
    row.app_id !== settings.appId ||
    !row.token_expires_at ||
    Date.parse(row.token_expires_at) <= Date.now()
  ) {
    throw new Error("Reconecte a Meta para consultar esta conta.");
  }
  try {
    const localToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: account.timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    const [year, month, day] = ["year", "month", "day"].map((part) =>
      Number(localToday.formatToParts().find(({ type }) => type === part)?.value),
    );
    // Use the last complete dates in the ad account's own calendar.
    const since = new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10);
    const until = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
    const token = openMetaAdsToken(
      row.token_ciphertext,
      settings.key,
      userId + ":" + settings.appId,
    );
    return {
      account,
      since,
      until,
      totals: await readMetaAdSpend(settings, token, account.id, { since, until }),
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "permission" || code === "expired")
      throw new Error("A Meta retirou o acesso a esta conta. Reconecte para continuar.");
    if (code === "rate_limit")
      throw new Error("A Meta limitou a consulta agora. Tente novamente mais tarde.");
    throw new Error("Não foi possível consultar os gastos da Meta.");
  }
}
