import { createHash, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import webPush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseSaleEvent, type SalesProvider } from "./sales-events";
import { validPushEndpoint } from "./sales-push";

export const salesService = supabaseAdmin as unknown as SupabaseClient;
export const hashSalesKey = (value: string) => createHash("sha256").update(value).digest("hex");

export function salesKeyMatches(value: string | null, digest: string) {
  return Boolean(
    value &&
    /^[a-f0-9]{64}$/.test(digest) &&
    timingSafeEqual(Buffer.from(hashSalesKey(value), "hex"), Buffer.from(digest, "hex")),
  );
}

export function salesPushConfig() {
  const publicKey = process.env.SALES_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.SALES_PUSH_PRIVATE_KEY?.trim();
  const subject = process.env.SALES_PUSH_SUBJECT?.trim();
  return publicKey &&
    /^[A-Za-z0-9_-]{87}$/.test(publicKey) &&
    privateKey &&
    /^[A-Za-z0-9_-]{43}$/.test(privateKey) &&
    subject &&
    (/^mailto:[^\s@]+@[^\s@]+$/.test(subject) || /^https:\/\/[^\s]+$/.test(subject))
    ? { publicKey, privateKey, subject }
    : null;
}

type PushDevice = { endpoint: string; public_key: string; auth_key: string };
type PushJob = PushDevice & { job_id: string; lease: string; sale_id: string };

export async function deliverSalesPush(device: PushDevice, saleId?: string) {
  const vapidDetails = salesPushConfig();
  if (!vapidDetails) return "retry";
  if (!validPushEndpoint(device.endpoint)) return "expired";
  const topic = saleId ? saleId.replaceAll("-", "") : undefined;
  try {
    const request = webPush.generateRequestDetails(
      { endpoint: device.endpoint, keys: { p256dh: device.public_key, auth: device.auth_key } },
      JSON.stringify(
        saleId
          ? {
              title: "Nova venda aprovada",
              body: "Confira a venda no Dashboard da MouseHot.",
              tag: saleId,
            }
          : {
              title: "Notificações da MouseHot",
              body: "Este dispositivo está pronto para receber alertas de vendas.",
              tag: "mousehot-sales-test",
            },
      ),
      { vapidDetails, TTL: 3600, urgency: "high", topic },
    );
    const response = await fetch(request.endpoint, {
      method: "POST",
      headers: request.headers,
      body: request.body ? new Uint8Array(request.body) : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(4500),
    });
    await response.body?.cancel();
    if (response.ok) return "sent";
    if (response.status === 404 || response.status === 410) return "expired";
    if (response.status === 429 || response.status >= 500) return "retry";
    return "failed";
  } catch {
    return "retry";
  }
}

export async function processSalesPush(event?: string) {
  if (!salesPushConfig()) return 0;
  const { data, error } = await salesService.rpc("sales_claim_push", { p_event: event ?? null });
  if (error) throw new Error("Não foi possível acessar a fila de notificações.");
  const jobs = data as PushJob[];
  for (let offset = 0; offset < jobs.length; offset += 5) {
    await Promise.all(
      jobs.slice(offset, offset + 5).map(async (job) => {
        const delivery = await deliverSalesPush(job, job.sale_id);
        await salesService.rpc("sales_finish_push", {
          p_job: job.job_id,
          p_lease: job.lease,
          p_result: delivery,
        });
      }),
    );
  }
  return jobs.length;
}

export async function limitedJson(request: Request, maxBytes = 128 * 1024) {
  if (Number(request.headers.get("content-length")) > maxBytes) return { error: 413 } as const;
  const reader = request.body?.getReader();
  if (!reader) return { error: 400 } as const;
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.length;
      if (bytes > maxBytes) {
        await reader.cancel();
        return { error: 413 } as const;
      }
      chunks.push(part.value);
    }
    return { value: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown };
  } catch {
    return { error: 400 } as const;
  } finally {
    reader.releaseLock();
  }
}

export async function receiveSalesWebhook(request: Request, key: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(key))
    return Response.json({ error: "Invalid connection" }, { status: 401 });
  const hash = hashSalesKey(key);
  const { data: link, error } = await salesService
    .from("sales_webhook_links")
    .select("id,provider,provider_hash")
    .eq("secret_hash", hash)
    .eq("active", true)
    .maybeSingle();
  if (error) return Response.json({ error: "Unavailable" }, { status: 503 });
  if (
    !link ||
    (link.provider_hash &&
      !salesKeyMatches(request.headers.get("x-hotmart-hottok"), link.provider_hash))
  )
    return Response.json({ error: "Invalid connection" }, { status: 401 });
  const payload = await limitedJson(request);
  if (payload.error)
    return Response.json({ error: "Invalid request body" }, { status: payload.error });
  const parsed = parseSaleEvent(link.provider as SalesProvider, payload.value);
  if (parsed.result === "ignored") return Response.json({ status: "ignored" });
  if (parsed.result !== "event") return Response.json({ error: "Invalid event" }, { status: 422 });
  const { event } = parsed;
  const saved = await salesService.rpc("sales_record_event", {
    p_connection: link.id,
    p_hash: hash,
    p_external_id: event.externalId,
    p_kind: event.kind,
    p_amount: event.amountCents,
    p_net: event.netCents,
    p_occurred: event.occurredAt,
  });
  const row = saved.data?.[0];
  if (saved.error || !row) return Response.json({ error: "Unavailable" }, { status: 503 });
  if (row.outcome === "unauthorized")
    return Response.json({ error: "Invalid connection" }, { status: 401 });
  if (event.kind === "approved")
    await processSalesPush(row.event_id).catch(() =>
      console.error("[sales] push processing unavailable"),
    );
  return Response.json({ status: row.outcome }, { status: row.outcome === "recorded" ? 201 : 200 });
}
