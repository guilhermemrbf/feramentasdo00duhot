import {
  matches,
  identifier,
  object,
  records,
  sha,
  syncpay,
  SyncPayError,
  unwrap,
  verifiesWebhook,
} from "./syncpay-client.server";
import { billingDb, reconcile, result } from "./syncpay-subscriptions.server";

const events = [
  "cobranca_paga",
  "assinatura_renovada",
  "assinatura_ativada",
  "assinatura_cancelada",
  "assinatura_em_atraso",
  "assinatura_suspensa",
  "assinatura_reativada",
  "assinatura_expirada",
  "assinatura_inadimplente",
];
const path = "/api/webhooks/syncpay";
const titlePrefix = "Mousefy Recorrência · ";
const hooks = () => billingDb.from("syncpay_webhooks");
const queue = () => billingDb.from("syncpay_events");
const state = () => billingDb.from("syncpay_worker_state");
const later = (ms: number) => new Date(Date.now() + ms).toISOString();

async function bodyBytes(request: Request) {
  const limit = 256 * 1024;
  if (!request.body || Number(request.headers.get("Content-Length")) > limit) return null;
  const reader = request.body.getReader();
  const bytes = new Uint8Array(limit);
  let count = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) return bytes.subarray(0, count);
      if (count + part.value.length > limit) {
        await reader.cancel();
        return null;
      }
      bytes.set(part.value, count);
      count += part.value.length;
    }
  } finally {
    reader.releaseLock();
  }
}

async function receive(request: Request) {
  const event = request.headers.get("X-Subscription-Event");
  if (!event || !events.includes(event)) return new Response(null, { status: 401 });
  const hook = result(await hooks().select("signing_secret").eq("event", event).maybeSingle());
  if (!hook) return new Response(null, { status: 401 });
  const bytes = await bodyBytes(request);
  if (!bytes) return new Response(null, { status: 413 });
  if (!verifiesWebhook(bytes, request.headers.get("X-Webhook-Signature"), hook.signing_secret))
    return new Response(null, { status: 401 });

  const body = await new Response(bytes)
    .json()
    .then(object)
    .catch(() => null);
  if (!body) return new Response(null, { status: 400 });
  const data = object(body.data);
  const subscription = object(data.subscription ?? body.subscription);
  const charge = object(data.charge ?? body.charge);
  const token = [
    data.subscription_token,
    body.subscription_token,
    subscription.token,
    subscription.subscription_token,
    charge.subscription_token,
    ...(event.startsWith("assinatura_") ? [data.token, body.token] : []),
  ].find(identifier);
  if (!token) {
    console.warn("[SyncPay] Evento assinado sem token da assinatura.", event);
    return new Response(null, { status: 422 });
  }
  const eventId = body.event_id ?? data.event_id;
  const fingerprint =
    typeof eventId === "string" || typeof eventId === "number"
      ? sha(event + ":" + token + ":" + eventId)
      : sha(event + ":" + sha(bytes));
  result(
    await queue().upsert(
      { fingerprint, event, subscription_token: token },
      {
        onConflict: "fingerprint",
        ignoreDuplicates: true,
      },
    ),
  );
  return new Response(null, { status: 204 });
}

async function listHooks() {
  const remote: ReturnType<typeof records> = [];
  let page = 1;
  for (;;) {
    const response = await syncpay("/webhooks?per_page=100&page=" + page);
    if (!Array.isArray(response.data)) throw new Error("Lista SyncPay de webhooks inválida.");
    remote.push(...records(response.data));
    if (!object(response.meta).has_more_pages) return remote;
    page++;
  }
}

function providerId(value: unknown) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

async function registerHook() {
  const now = new Date().toISOString();
  const recent = result(
    await state()
      .select("name,available_at")
      .in("name", ["register", ...events])
      .gt("available_at", now),
  );
  if (recent?.some((entry) => entry.name === "register")) return;
  const app = new URL(process.env.APP_BASE_URL ?? "");
  if (app.protocol !== "https:" || app.href !== app.origin + "/") {
    throw new Error("Origem HTTPS da SyncPay não configurada.");
  }
  const url = app.origin + path;
  const local = result(await hooks().select("event,provider_id"));
  const remote = await listHooks();
  const event = events.find((name) => {
    if (recent?.some((entry) => entry.name === name)) return false;
    const registered = local?.find((entry) => entry.event === name);
    return !remote.some(
      (entry) =>
        entry.event === name &&
        entry.url === url &&
        entry.trigger_all_products === true &&
        providerId(entry.id) === Number(registered?.provider_id),
    );
  });
  if (!event) {
    result(
      await state().upsert({
        name: "register",
        available_at: later(15 * 60_000),
        provider_error: null,
      }),
    );
    return;
  }

  const existing = remote.find((entry) => entry.event === event && entry.url === url);
  let newHook;
  try {
    if (existing) {
      const id = providerId(existing.id);
      // A webhook without its stored secret cannot authenticate deliveries.
      // Recover only our own webhook, never another integration's endpoint.
      if (!id || existing.title !== titlePrefix + event || existing.trigger_all_products !== true) {
        result(
          await state().upsert({
            name: event,
            available_at: later(60 * 60_000),
            provider_error: "conflito_de_webhook",
          }),
        );
        console.warn("[SyncPay] Conflito de cadastro de webhook.", event);
        return;
      }
      newHook = unwrap(await syncpay("/webhooks/" + id + "/rotate-secret", "POST"));
      newHook.id ??= id;
    } else {
      newHook = unwrap(
        await syncpay("/webhooks", "POST", {
          title: titlePrefix + event,
          url,
          event,
          trigger_all_products: true,
        }),
      );
    }
  } catch (error) {
    if (!(error instanceof SyncPayError)) throw error;
    const detail = JSON.stringify(error.payload);
    const limit = /maximum number of webhooks/i.test(detail);
    if (limit) {
      const retired = remote.find(
        (entry) =>
          entry.url === url &&
          typeof entry.event === "string" &&
          typeof entry.title === "string" &&
          entry.title === titlePrefix + entry.event &&
          !events.includes(entry.event) &&
          providerId(entry.id),
      );
      if (retired) await syncpay("/webhooks/" + providerId(retired.id), "DELETE");
    }
    const status = limit
      ? "limite_de_webhooks"
      : error.status === 429
        ? "limite_de_frequencia"
        : "cadastro_recusado";
    const next = error.status === 429 || limit ? "register" : event;
    const wait = error.status === 429 ? 65_000 : limit ? 120_000 : 60 * 60_000;
    result(await state().upsert({ name: next, available_at: later(wait), provider_error: status }));
    console.warn("[SyncPay] Cadastro de webhook pendente.", event, status);
    return;
  }

  const id = providerId(newHook.id);
  if (!id || typeof newHook.token !== "string" || !newHook.token) {
    throw new Error("Cadastro de webhook SyncPay sem segredo.");
  }
  result(await hooks().upsert({ event, provider_id: id, signing_secret: newHook.token }));
  result(await state().upsert({ name: event, available_at: later(0), provider_error: null }));
}

async function processQueue() {
  const now = new Date().toISOString();
  const pending = result(
    await queue()
      .select("fingerprint,subscription_token,received_at")
      .is("processed_at", null)
      .lte("next_attempt_at", now)
      .order("received_at")
      .limit(60),
  );
  const tokens = [
    ...new Set<string>((pending ?? []).map((entry) => entry.subscription_token)),
  ].slice(0, 10);
  const subscriptions = billingDb.from("syncpay_subscriptions");
  const periodic = result(
    await subscriptions
      .select("subscription_token")
      .not("subscription_token", "is", null)
      .is("closed_at", null)
      .lte("next_check_at", now)
      .order("next_check_at")
      .limit(10),
  );
  const batch = [
    ...new Set(tokens.concat((periodic ?? []).map((entry) => entry.subscription_token))),
  ];
  await Promise.allSettled(
    batch.map(async (token) => {
      const ids = (pending ?? [])
        .filter((entry) => entry.subscription_token === token)
        .map((entry) => entry.fingerprint);
      try {
        const known = result(
          await subscriptions.select("id").eq("subscription_token", token).maybeSingle(),
        );
        if (known) await reconcile(token);
        const retry =
          !known &&
          pending?.some(
            (entry) =>
              entry.subscription_token === token &&
              Date.parse(entry.received_at) >= Date.now() - 60 * 60_000,
          );
        if (ids.length)
          result(
            await queue()
              .update(
                retry
                  ? { next_attempt_at: later(120_000) }
                  : {
                      processed_at: new Date().toISOString(),
                    },
              )
              .in("fingerprint", ids),
          );
      } catch {
        if (ids.length)
          result(
            await queue()
              .update({ next_attempt_at: later(120_000) })
              .in("fingerprint", ids),
          );
        result(
          await subscriptions
            .update({ next_check_at: later(120_000) })
            .eq("subscription_token", token),
        );
        console.warn("[SyncPay] Reconciliação pendente.");
      }
    }),
  );
}

async function work(authorization: string) {
  const workerSecret = result(await billingDb.rpc("syncpay_worker_secret"));
  if (typeof workerSecret !== "string" || !matches("Bearer " + workerSecret, authorization))
    return new Response(null, { status: 401 });
  const now = new Date().toISOString();
  const lease = later(57_000);
  const claimed = result(
    await state()
      .update({ available_at: lease })
      .eq("name", "tick")
      .lte("available_at", now)
      .select("name")
      .maybeSingle(),
  );
  if (!claimed) return new Response(null, { status: 204 });
  try {
    const outcomes = await Promise.allSettled([processQueue(), registerHook()]);
    if (outcomes.some((outcome) => outcome.status === "rejected")) {
      console.warn("[SyncPay] Processamento agendado pendente.");
      return new Response(null, { status: 503 });
    }
    return new Response(null, { status: 204 });
  } finally {
    await state().update({ available_at: now }).eq("name", "tick").eq("available_at", lease);
  }
}

export async function handleSyncpayWebhook(request: Request) {
  try {
    const authorization = request.headers.get("Authorization");
    if (authorization && !request.headers.has("X-Subscription-Event"))
      return await work(authorization);
    return await receive(request);
  } catch {
    console.warn("[SyncPay] Endpoint temporariamente indisponível.");
    return new Response(null, { status: 503 });
  }
}
