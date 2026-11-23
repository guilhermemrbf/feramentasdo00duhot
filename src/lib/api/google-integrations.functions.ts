import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requirePlatformAccess } from "@/integrations/supabase/platform-middleware";

export const getGoogleAdsStatus = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .handler(async ({ context }) => {
    const { googleAdsStatus } = await import("@/lib/tracking/google-oauth.server");
    return googleAdsStatus(context.userId);
  });

export const beginGoogleAdsConnection = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .handler(async ({ context }) => {
    const { startGoogleAds } = await import("@/lib/tracking/google-oauth.server");
    return startGoogleAds(context.userId);
  });

export const disconnectGoogleAds = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .handler(async ({ context }) => {
    const { removeGoogleAds } = await import("@/lib/tracking/google-oauth.server");
    return removeGoogleAds(context.userId);
  });

export const getGoogleAdSpend = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(
    z.object({
      account: z.string().regex(/^\d{10}$/),
      days: z.union([z.literal(7), z.literal(30)]),
    }),
  )
  .handler(async ({ context, data }) => {
    const { googleAdsReport } = await import("@/lib/tracking/google-oauth.server");
    return googleAdsReport(context.userId, data.account, data.days);
  });

export const listGooglePixels = createServerFn({ method: "GET" })
  .middleware([requirePlatformAccess])
  .handler(async ({ context }) => {
    const { salesService } = await import("@/lib/sales.server");
    const result = await salesService
      .from("sales_google_conversion_tags")
      .select("id,label,destination")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (result.error) throw new Error("Não foi possível carregar as tags do Google Ads.");
    return (result.data ?? []) as { id: string; label: string; destination: string }[];
  });

export const createGooglePixel = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(
    z.object({
      label: z.string().trim().min(1).max(80),
      tag: z
        .string()
        .trim()
        .regex(/^AW-[0-9]{1,20}$/),
      conversion: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_-]{1,100}$/),
    }),
  )
  .handler(async ({ context, data }) => {
    const { salesService } = await import("@/lib/sales.server");
    const result = await salesService.from("sales_google_conversion_tags").insert({
      user_id: context.userId,
      label: data.label,
      destination: data.tag + "/" + data.conversion,
    });
    if (result.error?.code === "23505") throw new Error("Esta conversão já está cadastrada.");
    if (result.error) throw new Error("Não foi possível cadastrar a tag do Google Ads.");
    return true;
  });

export const removeGooglePixel = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { salesService } = await import("@/lib/sales.server");
    const result = await salesService
      .from("sales_google_conversion_tags")
      .delete()
      .eq("user_id", context.userId)
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (result.error || !result.data)
      throw new Error("Não foi possível remover a tag do Google Ads.");
    return true;
  });
