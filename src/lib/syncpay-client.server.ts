import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const base = "https://api.syncpayments.com.br/api/partner/v1";
export const methods = ["pix_automatico", "qr_code"] as const;
export type BillingMethod = (typeof methods)[number];

const mousefyTokens = [
  "66b2964c-c281-4c8c-b902-ced6d567bcbd",
  "44aa1915-be2f-4b0c-b386-7b75181c23eb",
  "26a29855-68aa-4a80-bd53-2200ce44c471",
  "b51f6f0f-4d23-48c8-a2e7-1037849aa8a9",
];

type ObjectValue = Record<string, unknown>;
export function object(value: unknown): ObjectValue {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as ObjectValue) : {};
}

export function records(value: unknown) {
  return Array.isArray(value) ? value.map(object) : [];
}

export function unwrap(value: unknown) {
  const data = object(value);
  return object(data.data ?? data);
}

export function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
}

export function isMethod(value: unknown): value is BillingMethod {
  return value === "qr_code" || value === "pix_automatico";
}

export function sha(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function matches(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifiesWebhook(raw: Uint8Array, signature: string | null, secret: string) {
  if (!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}

export class SyncPayError extends Error {
  constructor(
    readonly status: number,
    readonly payload: ObjectValue,
  ) {
    super("A SyncPay recusou a operação.");
  }

  get reason() {
    return this.payload.reason ?? unwrap(this.payload).reason;
  }
}

let cached: { token: string; expiresAt: number } | undefined;
let refreshing: Promise<string> | undefined;

async function authenticate() {
  const client_id = process.env.SYNCPAY_CLIENT_ID?.trim();
  const client_secret = process.env.SYNCPAY_CLIENT_SECRET?.trim();
  if (!client_id || !client_secret) throw new Error("Credenciais SyncPay ausentes no servidor.");
  const response = await fetch(base + "/auth-token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id, client_secret }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Autenticação SyncPay indisponível.");
  const body = unwrap(await response.json());
  if (typeof body.access_token !== "string" || !body.access_token)
    throw new Error("Resposta de autenticação SyncPay inválida.");
  const expiresAt = Date.parse(String(body.expires_at ?? ""));
  const expiresIn = Number(body.expires_in) || 3600;
  cached = {
    token: body.access_token,
    expiresAt: Math.min(Date.now() + expiresIn * 1000, expiresAt || Infinity) - 10_000,
  };
  return cached.token;
}

function token(rejected?: string) {
  if (cached && cached.expiresAt > Date.now() && cached.token !== rejected) return cached.token;
  refreshing ??= authenticate().finally(() => {
    refreshing = undefined;
  });
  return refreshing;
}

export async function syncpay(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: object,
  idempotencyKey?: string,
) {
  function send(bearer: string) {
    return fetch(base + path, {
      method,
      headers: {
        Authorization: "Bearer " + bearer,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000),
    });
  }
  const first = await token();
  let response = await send(first);
  if (response.status === 401) {
    await response.body?.cancel();
    response = await send(await token(first));
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new SyncPayError(response.status, object(result));
  return object(result);
}

export async function listPlans() {
  const available = new Map<
    string,
    {
      token: string;
      name: string;
      amount: number;
      days: number;
      methods: BillingMethod[];
    }
  >();
  let page = 1;
  let lastPage = 1;
  do {
    const result = await syncpay("/subscription-products?per_page=50&page=" + page);
    const meta = object(result.meta);
    const integration = object(meta.integration);
    const plans = [
      ...records(integration.plans),
      ...records(result.data).flatMap((product) => records(product.plans)),
    ];
    for (const plan of plans) {
      const { token, name, periodicity_days } = plan;
      const amount = Number(plan.amount);
      const accepted = Array.isArray(plan.billing_methods)
        ? plan.billing_methods.filter(isMethod)
        : [];
      if (
        identifier(token) &&
        mousefyTokens.includes(token) &&
        typeof name === "string" &&
        Number.isFinite(amount) &&
        amount > 0 &&
        typeof periodicity_days === "number" &&
        periodicity_days > 0 &&
        accepted.length &&
        !available.has(token)
      ) {
        available.set(token, { token, name, amount, days: periodicity_days, methods: accepted });
      }
    }
    lastPage = Number(meta.last_page) || 1;
    page++;
  } while (page <= lastPage && available.size < mousefyTokens.length);
  return [...available.values()].sort((a, b) => a.amount - b.amount);
}

export function sellerSplit() {
  const config = process.env.SYNCPAY_SPLIT;
  if (!config) return undefined;
  const parsed: unknown = JSON.parse(config);
  const split = records(parsed);
  if (!Array.isArray(parsed) || split.length > 5) throw new Error("Split SyncPay inválido.");
  const receivers = new Set<string>();
  let total = 0;
  for (const { user_id, percentage } of split) {
    if (
      !identifier(user_id) ||
      receivers.has(user_id.toLowerCase()) ||
      typeof percentage !== "number" ||
      !Number.isFinite(percentage) ||
      percentage <= 0 ||
      Math.abs(percentage * 100 - Math.round(percentage * 100)) > 0.0000001
    ) {
      throw new Error("Split SyncPay inválido.");
    }
    receivers.add(user_id.toLowerCase());
    total += Math.round(percentage * 100);
  }
  if (total >= 10_000) throw new Error("Split SyncPay inválido.");
  return split.length
    ? split.map(({ user_id, percentage }) => ({ user_id, percentage }))
    : undefined;
}
