import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requirePlatformAccess } from "@/integrations/supabase/platform-middleware";

export type MetaReport = {
  approved: number;
  attributed: number;
  revenue: number;
  sent: number;
  test_sent: number;
  failed: number;
  campaigns: { campaign_id: string | null; ad_id: string | null; sales: number; gross: number }[];
};

const pixelId = z.string().uuid();
const testCode = z
  .string()
  .trim()
  .max(32)
  .regex(/^[a-z0-9]*$/i);

export const listMetaPixels = createServerFn({ method: "GET" })
  .middleware([requirePlatformAccess])
  .handler(async ({ context }) => {
    const { metaDb, pixelEndpoints, scalehotOrigin } = await import("./service.server");
    const { data, error } = await metaDb
      .from("scalehot_meta_pixels")
      .select("id,label,dataset_id,checkout_origin,syncpay_secret,test_event_code,active")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Não foi possível carregar os Pixels.");
    const origin = data.length ? scalehotOrigin() : null;
    return data.map((row) => ({
      id: row.id as string,
      label: row.label as string,
      dataset: row.dataset_id as string,
      domain: row.checkout_origin as string,
      signatureReady: Boolean(row.syncpay_secret),
      testCode: (row.test_event_code ?? "") as string,
      active: row.active as boolean,
      webhookUrl: origin ? pixelEndpoints(origin, row.id).webhookUrl : "",
    }));
  });

export const createMetaPixel = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(
    z.object({
      label: z.string().trim().min(1).max(80),
      dataset: z
        .string()
        .trim()
        .regex(/^\d{1,32}$/),
      domain: z.string().trim().max(255),
      token: z.string().trim().min(24).max(4096),
      testCode,
    }),
  )
  .handler(async ({ context, data }) => {
    const { metaDb, pixelEndpoints, scalehotOrigin, sealCredential } =
      await import("./service.server");
    const { allowedPage, digest, randomToken } = await import("./contract");
    const domain = allowedPage(data.domain);
    if (!domain || domain.href !== domain.origin + "/")
      throw new Error("Informe o domínio HTTPS da loja, sem o caminho da página.");
    const origin = scalehotOrigin();
    const id = crypto.randomUUID();
    const key = randomToken();
    const result = await metaDb.from("scalehot_meta_pixels").insert({
      id,
      user_id: context.userId,
      label: data.label,
      dataset_id: data.dataset,
      checkout_origin: domain.origin,
      meta_token: await sealCredential(id, "meta", data.token),
      checkout_key_hash: await digest(key),
      test_event_code: data.testCode || null,
    });
    if (result.error) throw new Error("Não foi possível cadastrar o Pixel.");
    return { id, key, ...pixelEndpoints(origin, id) };
  });

export const configureMetaPixel = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(
    z.object({
      id: pixelId,
      secret: z.string().trim().max(1024),
      testCode,
    }),
  )
  .handler(async ({ context, data }) => {
    const { metaDb, sealCredential } = await import("./service.server");
    if (data.secret && data.secret.length < 16)
      throw new Error("Confira o segredo do webhook no painel da Syncpay.");
    const result = await metaDb
      .from("scalehot_meta_pixels")
      .update({
        test_event_code: data.testCode || null,
        ...(data.secret
          ? { syncpay_secret: await sealCredential(data.id, "syncpay", data.secret) }
          : {}),
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .eq("active", true)
      .select("id")
      .maybeSingle();
    if (result.error || !result.data) throw new Error("Não foi possível salvar a configuração.");
    return true;
  });

export const disconnectMetaPixel = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(z.object({ id: pixelId }))
  .handler(async ({ context, data }) => {
    const { metaDb } = await import("./service.server");
    const result = await metaDb
      .from("scalehot_meta_pixels")
      .update({ active: false, syncpay_secret: null })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id")
      .maybeSingle();
    if (result.error || !result.data) throw new Error("Não foi possível desativar o Pixel.");
    return true;
  });

export const getMetaAdsReport = createServerFn({ method: "GET" })
  .middleware([requirePlatformAccess])
  .validator(
    z.object({
      from: z.string().datetime({ offset: true }).nullable(),
      until: z.string().datetime({ offset: true }).nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const result = await db.rpc("scalehot_meta_report", { p_from: data.from, p_until: data.until });
    if (result.error || !result.data)
      throw new Error("Não foi possível carregar as vendas atribuídas.");
    return result.data as MetaReport;
  });
