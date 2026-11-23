import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  allowedPage,
  buildPurchase,
  decode,
  digest,
  opaqueToken,
  parseMetaClick,
  parseSyncpayTransaction,
  randomToken,
  seal,
  unseal,
  uuid,
  verifySyncpay,
  type ConversionRecord,
} from "./contract";

export const metaDb = supabaseAdmin as unknown as SupabaseClient;

export function encryptionKey() {
  try {
    const key = decode(process.env.SCALEHOT_META_ENCRYPTION_KEY ?? "");
    if (key.length === 32) return key;
  } catch {
    // Report missing configuration without exposing the configured value.
  }
  throw new Error("Configure a chave de criptografia do ScaleHot no servidor.");
}

export function scalehotOrigin() {
  const publicOrigin = process.env.APP_BASE_URL ?? "";
  const url = allowedPage(publicOrigin);
  if (!url || url.href !== url.origin + "/") {
    throw new Error("Configure a origem pública HTTPS do ScaleHot no servidor.");
  }
  return url.origin;
}

export function pixelEndpoints(origin: string, id: string) {
  return {
    checkoutUrl: origin + "/api/public/meta-checkout/" + id,
    webhookUrl: origin + "/api/public/meta-syncpay/" + id,
  };
}

export function sealCredential(id: string, purpose: "meta" | "syncpay", value: string) {
  return seal(value, encryptionKey(), id + ":" + purpose);
}

function reply(status: number, body: object) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function requestBytes(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit || !request.body) return null;
  const reader = request.body.getReader();
  const buffer = new Uint8Array(limit);
  let length = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) return buffer.slice(0, length);
      if (length + part.value.length > limit) {
        await reader.cancel();
        return null;
      }
      buffer.set(part.value, length);
      length += part.value.length;
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

function jsonObject(bytes: Uint8Array): Record<string, unknown> | null {
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export async function receiveMetaCheckout(request: Request, id: string) {
  const key = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!uuid.test(id) || !key || !opaqueToken.test(key))
    return reply(401, { error: "unauthorized" });
  const keyHash = await digest(key);
  const { data: source, error } = await metaDb
    .from("scalehot_meta_pixels")
    .select("checkout_origin")
    .eq("id", id)
    .eq("checkout_key_hash", keyHash)
    .eq("active", true)
    .maybeSingle();
  if (error) return reply(503, { error: "unavailable" });
  if (!source) return reply(401, { error: "unauthorized" });
  const bytes = await requestBytes(request, 8192);
  if (!bytes) return reply(413, { error: "invalid_body" });
  const data = jsonObject(bytes);
  if (!data) return reply(400, { error: "invalid_json" });

  if (data.action === "click" && typeof data.landingUrl === "string") {
    const click = parseMetaClick(
      data.landingUrl,
      source.checkout_origin,
      data.advertisingConsent === true,
    );
    if (!click) return reply(422, { error: "invalid_click" });
    const clickToken = randomToken();
    const stored = await metaDb.rpc("scalehot_meta_capture", {
      p_pixel: id,
      p_key: keyHash,
      p_hash: await digest(clickToken),
      p_campaign: click.campaign,
      p_adset: click.adset,
      p_ad: click.ad,
      p_fbc: click.fbc,
    });
    if (stored.error) return reply(503, { error: "unavailable" });
    return stored.data ? reply(201, { clickToken }) : reply(401, { error: "unauthorized" });
  }

  if (
    data.action === "bind" &&
    typeof data.clickToken === "string" &&
    opaqueToken.test(data.clickToken) &&
    typeof data.referenceId === "string" &&
    uuid.test(data.referenceId) &&
    typeof data.checkoutUrl === "string"
  ) {
    const checkout = allowedPage(data.checkoutUrl, source.checkout_origin);
    const sourceUrl = checkout ? checkout.origin + checkout.pathname : "";
    if (!sourceUrl || sourceUrl.length > 2048) return reply(422, { error: "invalid_checkout_url" });
    const result = await metaDb.rpc("scalehot_meta_bind", {
      p_pixel: id,
      p_key: keyHash,
      p_hash: await digest(data.clickToken),
      p_reference: data.referenceId,
      p_url: sourceUrl,
    });
    if (result.error) return reply(503, { error: "unavailable" });
    if (result.data === "bound") return reply(200, { status: "bound" });
    if (result.data === "unauthorized") return reply(401, { error: "unauthorized" });
    return reply(result.data === "conflict" ? 409 : 422, { error: result.data });
  }
  return reply(422, { error: "invalid_request" });
}

export async function receiveMetaSyncpay(request: Request, id: string) {
  const signature = request.headers.get("x-syncpay-signature");
  if (!uuid.test(id) || !signature) return reply(401, { error: "unauthorized" });
  const { data: source, error } = await metaDb
    .from("scalehot_meta_pixels")
    .select("syncpay_secret")
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();
  if (error) return reply(503, { error: "unavailable" });
  if (!source?.syncpay_secret) return reply(401, { error: "unauthorized" });
  const body = await requestBytes(request, 64 * 1024);
  if (!body) return reply(413, { error: "invalid_body" });
  try {
    const secret = await unseal(source.syncpay_secret, encryptionKey(), id + ":syncpay");
    if (!(await verifySyncpay(signature, body, secret)))
      return reply(401, { error: "unauthorized" });
  } catch {
    return reply(503, { error: "unavailable" });
  }
  const payload = jsonObject(body);
  if (!payload) return reply(400, { error: "invalid_json" });
  const paid = parseSyncpayTransaction(payload);
  if (!paid) return reply(200, { status: "ignored" });
  const result = await metaDb.rpc("scalehot_meta_record_syncpay", {
    p_pixel: id,
    p_secret: source.syncpay_secret,
    p_reference: paid.reference,
    p_type: paid.type,
    p_amount: paid.amount,
    p_net: paid.net,
    p_at: paid.occurredAt,
  });
  if (result.error) return reply(503, { error: "unavailable" });
  if (result.data === "unauthorized") return reply(401, { error: "unauthorized" });
  return reply(200, { status: result.data });
}

type ConversionJob = ConversionRecord & {
  lease: string;
  pixel_id: string;
  dataset_id: string;
  meta_token: string;
  test_event_code: string | null;
};

async function deliver(job: ConversionJob, version: string, key: Uint8Array<ArrayBuffer>) {
  const purchase = buildPurchase({ ...job, amount: Number(job.amount) });
  if (!purchase) return "failed";
  try {
    const token = await unseal(job.meta_token, key, job.pixel_id + ":meta");
    const response = await fetch(
      new URL("/" + version + "/" + job.dataset_id + "/events", "https://graph.facebook.com"),
      {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [purchase],
          ...(job.test_event_code ? { test_event_code: job.test_event_code } : {}),
        }),
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      },
    );
    if (response.status === 429 || response.status >= 500) return "retry";
    if (!response.ok) return "failed";
    const receipt: { events_received?: number } = await response.json();
    if (receipt.events_received !== 1) return "failed";
    return job.test_event_code ? "test_sent" : "sent";
  } catch {
    return "retry";
  }
}

export async function processMetaQueue(request: Request) {
  const secret = process.env.SCALEHOT_META_WORKER_SECRET;
  const version = process.env.META_GRAPH_API_VERSION;
  if (!secret || !opaqueToken.test(secret) || !version || !/^v\d+\.\d+$/.test(version)) {
    return reply(503, { error: "not_configured" });
  }
  const provided = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (
    !provided ||
    !opaqueToken.test(provided) ||
    (await digest(provided)) !== (await digest(secret))
  ) {
    return reply(401, { error: "unauthorized" });
  }
  try {
    const key = encryptionKey();
    const claimed = await metaDb.rpc("scalehot_meta_claim");
    if (claimed.error) return reply(503, { error: "unavailable" });
    const jobs = (claimed.data ?? []) as ConversionJob[];
    const outcomes = await Promise.all(
      jobs.map(async (job) => {
        const state = await deliver(job, version, key);
        return metaDb.rpc("scalehot_meta_finish", {
          p_id: job.id,
          p_lease: job.lease,
          p_state: state,
        });
      }),
    );
    if (outcomes.some(({ error }) => error)) return reply(503, { error: "unavailable" });
    return reply(200, { processed: jobs.length });
  } catch {
    return reply(503, { error: "unavailable" });
  }
}
