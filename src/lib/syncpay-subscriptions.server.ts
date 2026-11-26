import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  identifier,
  isMethod,
  listPlans,
  object,
  records,
  sellerSplit,
  sha,
  syncpay,
  SyncPayError,
  unwrap,
  type BillingMethod,
} from "./syncpay-client.server";

export const billingDb = supabaseAdmin as unknown as SupabaseClient;
const table = () => billingDb.from("syncpay_subscriptions");

type Payment = { code?: string; image?: string; expiresAt?: string };
type Row = {
  id: string;
  plan_token: string;
  billing_method: BillingMethod;
  request_hash: string;
  subscription_token: string | null;
  status: string;
  payment_status: string;
  next_charge_at: string | null;
  payment: Payment | null;
  manually_suspended: boolean;
  closed_at: string | null;
  checked_at: string | null;
  command: string | null;
  command_key: string | null;
  command_reason: string | null;
  command_lease_until: string | null;
};

type Command = "cancel" | "suspend" | "reactivate";
export type Enrollment = {
  plan: string;
  method: BillingMethod;
  name: string;
  document: string;
  amount: number;
  days: number;
};

export function result<T>(response: { data: T; error: unknown }): T {
  if (response.error) throw new Error("Não foi possível consultar a assinatura no Mousefy.");
  return response.data;
}

function text(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

const inlineQr = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i;
const providerQr = /^https:\/\/(?:[a-z0-9-]+\.)*syncpayments\.com\.br\//i;
const qrImageLimit = 256 * 1024;

async function inlinePaymentImage(image: string | undefined) {
  if (!image) return undefined;
  if (inlineQr.test(image)) return image.length <= qrImageLimit * 1.4 ? image : undefined;
  if (!providerQr.test(image)) return undefined;

  try {
    const response = await fetch(image, { redirect: "error", signal: AbortSignal.timeout(5000) });
    if (!response.body) return undefined;
    const mime = response.headers.get("Content-Type")?.split(";")[0].toLowerCase();
    if (
      !response.ok ||
      !mime ||
      !["image/png", "image/jpeg", "image/webp"].includes(mime) ||
      Number(response.headers.get("Content-Length")) > qrImageLimit
    ) {
      await response.body.cancel();
      return undefined;
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > qrImageLimit) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(part.value);
    }
    return size
      ? "data:" + mime + ";base64," + Buffer.concat(chunks, size).toString("base64")
      : undefined;
  } catch {
    return undefined;
  }
}

function payment(value: unknown, method: BillingMethod): Payment {
  const source = object(value);
  const qr = text(source.qr_code);
  const isImage = qr && (inlineQr.test(qr) || providerQr.test(qr));
  return {
    code:
      method === "pix_automatico"
        ? isImage
          ? undefined
          : qr
        : (text(source.qr_code_pix) ?? text(source.pix_code)),
    image: isImage ? qr : undefined,
    expiresAt: text(source.expires_at),
  };
}

async function current(user: string): Promise<Row | null> {
  return result(await table().select("*").eq("user_id", user).is("closed_at", null).maybeSingle());
}

async function latest(user: string): Promise<Row | null> {
  return (
    (await current(user)) ??
    result(
      await table()
        .select("*")
        .eq("user_id", user)
        .not("subscription_token", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    )
  );
}

function date(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(" ", "T");
  const parsed = Date.parse(
    /(?:Z|[+-]\d\d:?\d\d)$/i.test(normalized) ? normalized : normalized + "-03:00",
  );
  if (!Number.isFinite(parsed)) throw new Error("Vencimento SyncPay inválido.");
  return new Date(parsed).toISOString();
}

export async function reconcile(subscriptionToken: string) {
  const startedAt = new Date().toISOString();
  const state = unwrap(await syncpay("/subscriptions/" + subscriptionToken));
  const status = text(state.status);
  const paymentStatus = text(state.payment_status);
  if (
    !status ||
    !paymentStatus ||
    !["aguardando", "em_dia", "pendente", "bloqueado"].includes(paymentStatus)
  ) {
    throw new Error("Estado SyncPay indisponível.");
  }
  const closed = ["cancelled", "expired", "completed"].includes(status);
  const nextChargeAt = date(state.next_charge_at);
  result(
    await table()
      .update({
        status,
        payment_status: paymentStatus,
        next_charge_at: nextChargeAt,
        checked_at: startedAt,
        next_check_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        ...(closed ? { closed_at: startedAt } : {}),
      })
      .eq("subscription_token", subscriptionToken)
      .or("checked_at.is.null,checked_at.lte." + startedAt),
  );
  return { status, paymentStatus };
}

async function view(row: Row | null) {
  if (!row) return null;
  const instruction = row.payment_status === "aguardando" ? row.payment : null;
  const qr =
    (await inlinePaymentImage(instruction?.image)) ??
    (row.billing_method === "pix_automatico" && instruction?.code
      ? await QRCode.toDataURL(instruction.code, { width: 256, margin: 2 })
      : undefined);
  return {
    status: row.status,
    paymentStatus: row.payment_status,
    nextChargeAt: row.next_charge_at,
    method: row.billing_method,
    manuallySuspended: row.manually_suspended,
    hasSubscription: !!row.subscription_token,
    closed: !!row.closed_at,
    payment: instruction && { ...instruction, image: qr },
  };
}

export async function subscriptionView(user: string) {
  return view(await latest(user));
}

export async function chargesView(user: string, page: number) {
  const row = await latest(user);
  if (!row?.subscription_token) return { charges: [], upcoming: [], lastPage: 1 };
  const data = await syncpay(
    "/subscriptions/" + row.subscription_token + "/charges?per_page=10&page=" + page,
  );
  const upcoming = object(data.upcoming);
  return {
    charges: records(data.data).map((charge) => ({
      cycle: typeof charge.cycle_number === "number" ? charge.cycle_number : undefined,
      amount: typeof charge.amount === "number" ? charge.amount : text(charge.amount),
      status: text(charge.status),
      chargeAt: text(charge.due_date),
      paidAt: text(charge.paid_at),
      payment:
        charge.status === "pending" || charge.status === "overdue"
          ? { ...payment(charge.payment, row.billing_method), image: undefined }
          : null,
    })),
    upcoming: records(upcoming.items ?? data.upcoming).map((charge) => ({
      cycle: typeof charge.cycle_number === "number" ? charge.cycle_number : undefined,
      date:
        text(charge.charge_date) ??
        text(charge.expected_at) ??
        text(charge.due_date) ??
        text(charge.estimated_charge_at) ??
        text(charge.scheduled_at) ??
        text(charge.expected_date),
      amount: typeof charge.amount === "number" ? charge.amount : text(charge.amount),
    })),
    lastPage: Number(object(data.meta).last_page) || 1,
  };
}

export async function enroll(user: string, email: string, input: Enrollment) {
  let row = await current(user);
  if (row?.subscription_token) return { subscription: await view(row) };

  const ready = result(await billingDb.rpc("syncpay_checkout_ready"));
  if (ready !== true) return { error: "Adesões temporariamente indisponíveis." };

  const plan = (await listPlans()).find(({ token }) => token === input.plan);
  if (!plan?.methods.includes(input.method)) {
    return {
      acceptedMethods: plan?.methods ?? [],
      error: "Escolha uma forma disponível neste plano.",
    };
  }

  if (!row && (plan.amount !== input.amount || plan.days !== input.days)) {
    return { error: "O preço ou a periodicidade mudou. Atualize os planos antes de assinar." };
  }

  const body = {
    name: input.name,
    email,
    document: input.document,
    billing_method: input.method,
    split: sellerSplit(),
  };
  const hash = sha(JSON.stringify({ plan: input.plan, body }));
  if (!row) {
    const created = await table()
      .insert({
        id: randomUUID(),
        user_id: user,
        plan_token: input.plan,
        billing_method: input.method,
        request_hash: hash,
      })
      .select()
      .single();
    row = created.error?.code === "23505" ? await current(user) : result(created);
  }
  if (!row) throw new Error("Não foi possível iniciar a adesão.");
  if (row.subscription_token) return { subscription: await view(row) };
  if (row.request_hash !== hash) {
    return { error: "Há uma adesão em andamento. Tente novamente com o mesmo plano e dados." };
  }

  const path = "/subscription-plans/" + row.plan_token + "/enroll";
  let enrolled;
  try {
    try {
      enrolled = unwrap(await syncpay(path, "POST", body, row.id));
    } catch (error) {
      if (
        !(error instanceof SyncPayError) ||
        error.status !== 409 ||
        error.reason !== "idempotency_key_reused"
      )
        throw error;
      const renamed = result(
        await table()
          .update({ id: randomUUID() })
          .eq("id", row.id)
          .is("subscription_token", null)
          .select("*")
          .maybeSingle(),
      );
      if (!renamed) throw new Error("Adesão em processamento.");
      row = renamed as Row;
      enrolled = unwrap(await syncpay(path, "POST", body, row.id));
    }
  } catch (error) {
    if (error instanceof SyncPayError && [400, 404, 422].includes(error.status)) {
      result(
        await table()
          .update({ status: "rejected", closed_at: new Date().toISOString() })
          .eq("id", row.id)
          .is("subscription_token", null),
      );
      if (error.reason === "method_not_accepted") {
        const accepted = error.payload.accepted_methods ?? unwrap(error.payload).accepted_methods;
        return {
          error: "A forma de pagamento não é aceita neste plano.",
          acceptedMethods: Array.isArray(accepted) ? accepted.filter(isMethod) : plan.methods,
        };
      }
      return { error: "A SyncPay recusou a adesão. Confira os dados e tente novamente." };
    }
    return { error: "Adesão em processamento. Tente novamente com os mesmos dados." };
  }

  if (!identifier(enrolled.subscription_token)) throw new Error("Adesão SyncPay em processamento.");
  let saved: Row | null = result(
    await table()
      .update({
        subscription_token: enrolled.subscription_token,
        status: "pending_first_payment",
        payment: payment(enrolled.payment, input.method),
      })
      .eq("id", row.id)
      .is("subscription_token", null)
      .select("*")
      .maybeSingle(),
  );
  saved ??= await current(user);
  return { subscription: await view(saved) };
}

function stableCommandKey(subscriptionToken: string, reason: string) {
  const hash = sha(subscriptionToken + "\0" + reason);
  return (
    hash.slice(0, 8) +
    "-" +
    hash.slice(8, 12) +
    "-4" +
    hash.slice(13, 16) +
    "-8" +
    hash.slice(17, 20) +
    "-" +
    hash.slice(20, 32)
  );
}

export async function changeSubscription(user: string, command: Command, reason?: string) {
  const row = await latest(user);
  if (!row?.subscription_token) throw new Error("Nenhuma assinatura encontrada.");
  if (row.closed_at) return view(row);
  const subscriptionToken = row.subscription_token;
  if (
    (command === "suspend" && row.status === "suspended" && row.manually_suspended) ||
    (command === "reactivate" &&
      row.status !== "suspended" &&
      !row.manually_suspended &&
      !row.command)
  ) {
    return view(row);
  }
  if (row.command && (row.command !== command || row.command_reason !== (reason ?? null))) {
    throw new Error("Conclua a solicitação anterior antes de alterar a assinatura.");
  }

  const now = new Date().toISOString();
  const key =
    row.command_key ??
    (command === "cancel" ? stableCommandKey(subscriptionToken, reason ?? "") : randomUUID());
  const lease = result(
    await table()
      .update({
        command_key: key,
        command,
        command_reason: reason ?? null,
        command_lease_until: new Date(Date.now() + 45_000).toISOString(),
      })
      .eq("id", row.id)
      .is("closed_at", null)
      .or("command_lease_until.is.null,command_lease_until.lte." + now)
      .select("id")
      .maybeSingle(),
  );
  if (!lease) throw new Error("Já existe uma alteração em andamento.");

  try {
    await syncpay(
      "/subscriptions/" + subscriptionToken + "/" + command,
      "PATCH",
      command === "cancel" ? { reason } : {},
      key,
    );
    await reconcile(subscriptionToken);
    result(
      await table()
        .update({
          command_key: null,
          command: null,
          command_reason: null,
          command_lease_until: null,
          manually_suspended: command === "suspend",
        })
        .eq("id", row.id)
        .eq("command_key", key),
    );
  } catch (error) {
    const rejected = error instanceof SyncPayError && [400, 404, 422].includes(error.status);
    const collision =
      error instanceof SyncPayError &&
      error.status === 409 &&
      error.reason === "idempotency_key_reused";
    const nextKey =
      command === "cancel"
        ? stableCommandKey(subscriptionToken, "\0" + (reason ?? ""))
        : randomUUID();
    result(
      await table()
        .update({
          command_lease_until: null,
          ...(collision && nextKey !== key ? { command_key: nextKey } : {}),
          ...(rejected ? { command_key: null, command: null, command_reason: null } : {}),
        })
        .eq("id", row.id)
        .eq("command_key", key),
    );
    throw new Error(
      rejected
        ? "A SyncPay recusou esta alteração."
        : "Alteração em processamento. Repita a mesma solicitação.",
    );
  }
  return subscriptionView(user);
}
