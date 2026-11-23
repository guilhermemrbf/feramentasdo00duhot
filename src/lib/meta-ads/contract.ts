const encoder = new TextEncoder();
const decoder = new TextDecoder();
export const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const opaqueToken = /^[A-Za-z0-9_-]{43}$/;
export const metaUrlParameters =
  "utm_source=meta&utm_medium=paid_social&mh_campaign_id={{campaign.id}}&mh_adset_id={{adset.id}}&mh_ad_id={{ad.id}}";
const attributionWindow = 7 * 86_400_000;

function encode(value: Uint8Array) {
  return btoa(String.fromCharCode(...value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decode(value: string) {
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (part) =>
    part.charCodeAt(0),
  );
}

export function randomToken() {
  return encode(crypto.getRandomValues(new Uint8Array(32)));
}

export async function digest(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function seal(value: string, key: Uint8Array<ArrayBuffer>, binding: string) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const imported = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt"]);
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: encoder.encode(binding) },
    imported,
    encoder.encode(value),
  );
  return "v1." + encode(nonce) + "." + encode(new Uint8Array(data));
}

export async function unseal(value: string, key: Uint8Array<ArrayBuffer>, binding: string) {
  const [version, nonce, data, extra] = value.split(".");
  if (version !== "v1" || !nonce || !data || extra !== undefined)
    throw new Error("invalid_ciphertext");
  const imported = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decode(nonce), additionalData: encoder.encode(binding) },
    imported,
    decode(data),
  );
  return decoder.decode(plaintext);
}

export async function verifySyncpay(
  header: string | null,
  body: Uint8Array<ArrayBuffer>,
  secret: string,
  now = Date.now(),
) {
  const match = /^t=(\d{10}),\s*v1=([a-f0-9]{64})$/i.exec(header?.trim() || "");
  if (!match || Math.abs(Math.floor(now / 1000) - Number(match[1])) > 300) return false;
  const signature = Uint8Array.from(match[2].match(/../g) ?? [], (byte) =>
    Number.parseInt(byte, 16),
  );
  const prefix = encoder.encode(match[1] + ".");
  const signed = new Uint8Array(prefix.length + body.length);
  signed.set(prefix);
  signed.set(body, prefix.length);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, signature, signed);
}

function object(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

export function parseSyncpayTransaction(input: unknown, now = Date.now()) {
  const body = object(input);
  if (body.event !== "transaction.updated") return null;
  const transaction = object(body.transaction);
  const status = transaction.status;
  const reference = transaction.reference_id;
  const amount = transaction.amount;
  const net = transaction.net_amount;
  if (
    (status !== "completed" &&
      status !== "refunded" &&
      status !== "chargeback" &&
      status !== "med") ||
    transaction.origin !== "checkout" ||
    transaction.currency !== "BRL" ||
    typeof reference !== "string" ||
    !uuid.test(reference) ||
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 10_000_000 ||
    typeof body.occurred_at !== "string"
  )
    return null;
  const effectiveAt =
    status === "completed"
      ? transaction.paid_at
      : status === "refunded"
        ? transaction.refunded_at
        : null;
  const occurredAt = typeof effectiveAt === "string" ? effectiveAt : body.occurred_at;
  const millis = Date.parse(occurredAt);
  if (!Number.isFinite(millis) || millis > now + 300_000 || !/(Z|[+-]\d\d:\d\d)$/i.test(occurredAt))
    return null;
  return {
    reference: reference.toLowerCase(),
    type:
      status === "completed"
        ? ("cashin" as const)
        : status === "med"
          ? ("dispute" as const)
          : ("refund" as const),
    amount,
    net:
      status !== "med" &&
      typeof net === "number" &&
      Number.isFinite(net) &&
      net >= 0 &&
      net <= amount
        ? net
        : null,
    occurredAt: new Date(Math.min(millis, now)).toISOString(),
  };
}

export function allowedPage(input: string, origin?: string) {
  if (input.length > 4096) return null;
  try {
    const url = new URL(input);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (origin && url.origin !== origin)
    )
      return null;
    return url;
  } catch {
    return null;
  }
}

export function parseMetaClick(input: string, origin: string, consent: boolean, now = Date.now()) {
  if (!consent) return null;
  const url = allowedPage(input, origin);
  if (!url) return null;
  const keys = ["utm_source", "mh_campaign_id", "mh_adset_id", "mh_ad_id", "fbclid"];
  if (keys.some((key) => url.searchParams.getAll(key).length > 1)) return null;
  const [source, campaign, adset, ad, fbclid] = keys.map((key) => url.searchParams.get(key));
  const clickId = fbclid && /^[a-zA-Z0-9._-]{1,512}$/.test(fbclid) ? fbclid : null;
  if (!clickId && (source !== "meta" || !campaign)) return null;
  if ([campaign, adset, ad].some((id) => id !== null && !/^\d{1,32}$/.test(id))) return null;
  return { campaign, adset, ad, fbc: clickId ? "fb.1." + now + "." + clickId : null };
}

export type ConversionRecord = {
  id: string;
  source_url: string;
  fbc: string | null;
  paid_at: string;
  amount: number;
};

export function buildPurchase(record: ConversionRecord, now = Date.now()) {
  const paidAt = Date.parse(record.paid_at);
  if (
    !record.fbc ||
    !Number.isFinite(paidAt) ||
    paidAt > now ||
    now - paidAt >= attributionWindow ||
    !Number.isFinite(record.amount) ||
    record.amount <= 0
  )
    return null;
  return {
    event_name: "Purchase",
    event_id: record.id,
    event_time: Math.floor(paidAt / 1000),
    action_source: "website",
    event_source_url: record.source_url,
    user_data: { fbc: record.fbc },
    custom_data: { currency: "BRL", value: record.amount },
  };
}
