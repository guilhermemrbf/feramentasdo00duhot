import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requirePlatformAccess } from "@/integrations/supabase/platform-middleware";
import {
  SALES_CONNECTION_PROVIDERS,
  SALES_PERIODS,
  SALES_PROVIDERS,
  type SaleKind,
  type SalesPeriod,
  type SalesProvider,
} from "@/lib/sales-events";
import { validPushEndpoint } from "@/lib/sales-push";

type LinkRow = {
  id: string;
  provider: SalesProvider;
  label: string;
  active: boolean;
  created_at: string;
  last_event_at: string | null;
};

export type SalesOverview = {
  approved: number;
  gross_cents: number;
  reported_net_cents: number | null;
  reversed_cents: number;
  reversed: number;
  refund_or_dispute_count: number;
  with_net: number;
  devices: number;
  series: { day: string; cents: number }[];
  monthly: { month: string; gross: number; net: number | null }[];
  goal_cents: number | null;
  month_gross_cents: number;
  recent: {
    id: string;
    provider: SalesProvider;
    external_id: string;
    kind: SaleKind;
    amount_cents: number;
    occurred_at: string;
  }[];
  links: LinkRow[];
};

const provider = z.enum(Object.keys(SALES_PROVIDERS) as [SalesProvider, ...SalesProvider[]]);
const endpoint = z.string().refine(validPushEndpoint, "Serviço de push incompatível.");
const setupFailure = "Não foi possível acessar o módulo de vendas.";

export const salesOverview = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(
    z.object({
      days: z.union([z.literal(7), z.literal(30), z.literal(90)]),
      provider: provider.nullable(),
      period: z
        .enum(SALES_PERIODS.map(({ key }) => key) as [SalesPeriod, ...SalesPeriod[]])
        .optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: snapshot, error } = await context.supabase.schema("public").rpc(
      "sales_overview" as never,
      {
        p_days: data.days,
        p_provider: data.provider,
        ...(data.period ? { p_period: data.period } : {}),
      } as never,
    );
    if (error || !snapshot) throw new Error(setupFailure);
    return snapshot as unknown as SalesOverview;
  });

export const createSalesWebhook = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(
    z.object({
      provider: z.enum(SALES_CONNECTION_PROVIDERS),
      label: z.string().trim().min(1).max(80),
    }),
  )
  .handler(async ({ data, context }) => {
    const [{ hashSalesKey, salesService }, { randomBytes }] = await Promise.all([
      import("@/lib/sales.server"),
      import("node:crypto"),
    ]);
    const baseUrl = new URL(process.env.APP_BASE_URL ?? "http://127.0.0.1:5173");
    if (baseUrl.protocol !== "https:" && process.env.VERCEL === "1") throw new Error(setupFailure);
    const token = randomBytes(32).toString("base64url");
    const { error } = await salesService.from("sales_webhook_links").insert({
      user_id: context.userId,
      provider: data.provider,
      label: data.label,
      secret_hash: hashSalesKey(token),
    });
    if (error) throw new Error("Não foi possível criar o endereço de webhook.");
    return {
      url: new URL("/api/vendas/webhook/" + token, baseUrl.origin).href,
      endpoint: new URL("/api/vendas/webhook", baseUrl.origin).href,
      token,
    };
  });

export const saveSalesGoal = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(z.object({ cents: z.number().int().min(0).max(1_000_000_000_000) }))
  .handler(async ({ data, context }) => {
    const { salesService } = await import("@/lib/sales.server");
    const { error } = await salesService
      .from("sales_goals")
      .upsert({ user_id: context.userId, monthly_cents: data.cents }, { onConflict: "user_id" });
    if (error) throw new Error("Não foi possível salvar a meta mensal.");
    return true;
  });

export const disableSalesWebhook = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { salesService } = await import("@/lib/sales.server");
    const { error, data: updated } = await salesService
      .from("sales_webhook_links")
      .update({ active: false })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id")
      .maybeSingle();
    if (error || !updated) throw new Error("Não foi possível desativar a conexão.");
    return true;
  });

export const salesPushStatus = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(z.object({ endpoint: endpoint.optional() }))
  .handler(async ({ data, context }) => {
    const { salesPushConfig, salesService } = await import("@/lib/sales.server");
    const publicKey = salesPushConfig()?.publicKey ?? null;
    if (!data.endpoint) return { publicKey, active: false, notifyApproved: false };
    const { data: active, error } = await salesService
      .from("sales_push_devices")
      .select("id,notify_approved")
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(setupFailure);
    return { publicKey, active: Boolean(active), notifyApproved: Boolean(active?.notify_approved) };
  });

export const setSalesPushPreference = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(z.object({ endpoint, enabled: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { salesService } = await import("@/lib/sales.server");
    const { data: changed, error } = await salesService
      .from("sales_push_devices")
      .update({ notify_approved: data.enabled, notify_since: new Date().toISOString() })
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId)
      .select("id")
      .maybeSingle();
    if (error || !changed) throw new Error("Não foi possível salvar a preferência.");
    return true;
  });

export const registerSalesPush = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(
    z.object({
      endpoint,
      p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
      auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
    }),
  )
  .handler(async ({ data, context }) => {
    const { salesPushConfig, salesService } = await import("@/lib/sales.server");
    if (!salesPushConfig()) throw new Error("Notificações indisponíveis neste ambiente.");
    const { data: existing, error: loadError } = await salesService
      .from("sales_push_devices")
      .select("id,user_id")
      .eq("endpoint", data.endpoint)
      .maybeSingle();
    if (loadError) throw new Error(setupFailure);
    if (existing && existing.user_id !== context.userId)
      throw new Error(
        "Este navegador já está vinculado a outra conta. Use um perfil de navegador separado.",
      );
    const values = {
      public_key: data.p256dh,
      auth_key: data.auth,
      registered_at: new Date().toISOString(),
    };
    const update = existing
      ? salesService
          .from("sales_push_devices")
          .update(values)
          .eq("id", existing.id)
          .eq("user_id", context.userId)
      : salesService
          .from("sales_push_devices")
          .insert({ ...values, endpoint: data.endpoint, user_id: context.userId });
    const { error } = await update;
    if (error) throw new Error("Não foi possível ativar este dispositivo.");
    return true;
  });

export const disableSalesPush = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(z.object({ endpoint }))
  .handler(async ({ data, context }) => {
    const { salesService } = await import("@/lib/sales.server");
    const { error } = await salesService
      .from("sales_push_devices")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível desativar os alertas.");
    return true;
  });

export const testSalesPush = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(z.object({ endpoint }))
  .handler(async ({ data, context }) => {
    const { deliverSalesPush, salesService } = await import("@/lib/sales.server");
    const cutoff = new Date(Date.now() - 30_000).toISOString();
    const { data: device, error } = await salesService
      .from("sales_push_devices")
      .update({
        last_test_at: new Date().toISOString(),
      })
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId)
      .or("last_test_at.is.null,last_test_at.lt." + cutoff)
      .select("id,endpoint,public_key,auth_key")
      .maybeSingle();
    if (error || !device)
      throw new Error(
        "Ative os alertas neste aparelho ou aguarde 30 segundos antes de testar novamente.",
      );
    const result = await deliverSalesPush(device);
    if (result === "expired")
      await salesService
        .from("sales_push_devices")
        .delete()
        .eq("id", device.id)
        .eq("user_id", context.userId);
    if (result !== "sent")
      throw new Error(
        "O serviço de push não aceitou o teste. Confira a permissão e tente novamente.",
      );
    return true;
  });
