import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requirePlatformAccess } from "@/integrations/supabase/platform-middleware";

const date = z.string().date();
const dates = z.object({ since: date, until: date }).refine(({ since, until }) => {
  const days = (Date.parse(until) - Date.parse(since)) / 86_400_000;
  return days >= 0 && days <= 92;
});

export type ScaleHotOperation = {
  approved: number;
  gross_cents: number;
  reversed_cents: number;
  paid_sales: number;
  paid_gross_cents: number;
  net_cents: number | null;
  expense_cents: number;
  fee_cents: number;
  tax_cents: number;
  meta_tax_cents: number;
  product_cost_cents: number;
  campaigns: { id: string; name: string; sales: number; gross_cents: number }[];
  products: { name: string | null; sales: number; gross_cents: number }[];
  series: { day: string; gross_cents: number }[];
};

export const readScaleHotOperation = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(z.object({ range: dates, campaign: z.string().max(400).optional() }))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const response = await db.rpc("scalehot_operation_report", {
      p_since: data.range.since,
      p_until: data.range.until,
      p_campaign: data.campaign ?? null,
    });
    if (response.error || !response.data) throw new Error("Relatório da operação indisponível.");
    return response.data as ScaleHotOperation;
  });

const adAccount = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("meta"), id: z.string().regex(/^act_[0-9]{1,32}$/) }),
  z.object({ provider: z.literal("google"), id: z.string().regex(/^\d{10}$/) }),
]);

export const readScaleHotAdAccount = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(z.object({ range: dates, accounts: z.array(adAccount).min(1).max(12) }))
  .handler(async ({ context, data }) => {
    const { accounts, range } = data;
    const reports = await Promise.all(
      accounts.map(async (account) => {
        if (account.provider === "meta") {
          const { metaAdsReport } = await import("@/lib/tracking/meta-oauth.server");
          return metaAdsReport(context.userId, account.id, range);
        }
        const { googleAdsReport } = await import("@/lib/tracking/google-oauth.server");
        return googleAdsReport(context.userId, account.id, range);
      }),
    );
    return reports.map(({ account, totals }) => ({ currency: account.currency, totals }));
  });
