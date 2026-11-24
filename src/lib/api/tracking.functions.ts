import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requirePlatformAccess } from "@/integrations/supabase/platform-middleware";
import { trackingOrigin } from "@/lib/tracking/attribution";

export type TrackingOverview = {
  approved: number;
  attributed: number;
  unattributed: number;
  gross_cents: number;
  gross_attributed_cents: number;
  reversed_attributed_cents: number;
  series: {
    day: string;
    gross_attributed_cents: number;
    gross_unattributed_cents: number;
    attributed: number;
  }[];
  campaigns: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    campaign_id: string | null;
    ad_id: string | null;
    sales: number;
    gross_cents: number;
    reversed_cents: number;
  }[];
  sources: {
    id: string;
    origin: string;
    label: string;
    gateway_active: boolean;
    active: boolean;
    last_click_at: string | null;
  }[];
};

export const trackingOverview = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(
    z.object({
      days: z.union([z.literal(7), z.literal(14), z.literal(30)]),
      breakdown: z.enum(["campaign", "ad"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const result = await db.rpc("sales_tracking_report", {
      p_days: data.days,
      p_breakdown: data.breakdown,
    });
    if (result.error || !result.data) throw new Error("Não foi possível carregar o rastreamento.");
    return result.data as unknown as TrackingOverview;
  });

export const createTrackingSource = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(z.object({ gateway: z.string().uuid(), origin: z.string().trim().max(255) }))
  .handler(async ({ context, data }) => {
    const origin = trackingOrigin(data.origin);
    if (!origin) throw new Error("Informe apenas o domínio HTTPS, sem o caminho da página.");
    const base = new URL(process.env.APP_BASE_URL ?? "http://127.0.0.1:5173");
    if (base.protocol !== "https:" && process.env.VERCEL === "1") {
      throw new Error("O domínio HTTPS do Mousefy precisa estar configurado.");
    }
    const [{ hashSalesKey, salesService }, { randomBytes }] = await Promise.all([
      import("@/lib/sales.server"),
      import("node:crypto"),
    ]);
    const gateway = await salesService
      .from("sales_webhook_links")
      .select("id")
      .eq("id", data.gateway)
      .eq("user_id", context.userId)
      .eq("active", true)
      .maybeSingle();
    if (gateway.error || !gateway.data) throw new Error("Selecione um gateway ativo da sua conta.");

    const key = randomBytes(32).toString("base64url");
    const source = await salesService
      .from("sales_tracking_sources")
      .insert({
        user_id: context.userId,
        link_id: data.gateway,
        origin,
        secret_hash: hashSalesKey(key),
      })
      .select("id")
      .single();
    if (source.error?.code === "23505")
      throw new Error("Este domínio já está ativo para o gateway escolhido.");
    if (source.error || !source.data) throw new Error("Não foi possível configurar este domínio.");
    return {
      id: source.data.id as string,
      key,
      endpoint: new URL("/api/vendas/tracking/" + source.data.id, base.origin).href,
    };
  });

export const disableTrackingSource = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { salesService } = await import("@/lib/sales.server");
    const result = await salesService
      .from("sales_tracking_sources")
      .update({ active: false })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id")
      .maybeSingle();
    if (result.error || !result.data) throw new Error("Não foi possível desativar o rastreamento.");
    return true;
  });

export const getMetaAdsStatus = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .handler(async ({ context }) => {
    const { metaAdsStatus } = await import("@/lib/tracking/meta-oauth.server");
    return metaAdsStatus(context.userId);
  });

export const beginMetaAdsConnection = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .handler(async ({ context }) => {
    const { startMetaAds } = await import("@/lib/tracking/meta-oauth.server");
    return startMetaAds(context.userId);
  });

export const disconnectMetaAds = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .handler(async ({ context }) => {
    const { removeMetaAds } = await import("@/lib/tracking/meta-oauth.server");
    return removeMetaAds(context.userId);
  });

export const getMetaAdSpend = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(
    z.object({
      account: z.string().regex(/^act_[0-9]{1,32}$/),
      days: z.union([z.literal(7), z.literal(30)]),
    }),
  )
  .handler(async ({ context, data }) => {
    const { metaAdsReport } = await import("@/lib/tracking/meta-oauth.server");
    return metaAdsReport(context.userId, data.account, data.days);
  });
