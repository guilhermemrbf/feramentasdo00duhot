import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const getViewer = async (context: { userId: string }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(context.userId);
  if (error || !data.user?.email || !data.user.email_confirmed_at || data.user.is_anonymous)
    throw new Error("Confirme o e-mail da sua conta Mousefy para continuar.");
  return { id: data.user.id, email: data.user.email };
};

export const getMousefyPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listPlans } = await import("@/lib/syncpay-client.server");
    const { billingDb, result } = await import("@/lib/syncpay-subscriptions.server");
    const ready = result(await billingDb.rpc("syncpay_checkout_ready"));
    return ready === true ? listPlans() : [];
  });

export const getMousefySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { subscriptionView } = await import("@/lib/syncpay-subscriptions.server");
    return subscriptionView(context.userId);
  });

export const getMousefyCharges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.number().int().positive())
  .handler(async ({ data, context }) => {
    const { chargesView } = await import("@/lib/syncpay-subscriptions.server");
    return chargesView(context.userId, data);
  });

export const enrollMousefy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      plan: z.string().uuid(),
      method: z.enum(["pix_automatico", "qr_code"]),
      name: z.string().trim().min(3).max(150),
      amount: z.number().positive(),
      days: z.number().int().positive(),
      document: z
        .string()
        .transform((value) => value.replace(/[.\-/\s]/g, ""))
        .pipe(z.string().regex(/^(?:\d{11}|\d{14})$/, "Informe um CPF ou CNPJ válido.")),
    }),
  )
  .handler(async ({ data, context }) => {
    const viewer = await getViewer(context);
    const { data: allowed, error } = await context.supabase.rpc("platform_access_status" as never);
    const status = (allowed as { status?: string } | null)?.status;
    if (error || !status || status === "denied")
      throw new Error("Cadastro indisponível para adesão.");
    const { enroll } = await import("@/lib/syncpay-subscriptions.server");
    return enroll(viewer.id, viewer.email, data);
  });

export const changeMousefySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.discriminatedUnion("action", [
      z.object({ action: z.literal("cancel"), reason: z.string().trim().min(3).max(250) }),
      z.object({ action: z.literal("suspend") }),
      z.object({ action: z.literal("reactivate") }),
    ]),
  )
  .handler(async ({ data, context }) => {
    const viewer = await getViewer(context);
    const { changeSubscription } = await import("@/lib/syncpay-subscriptions.server");
    return changeSubscription(viewer.id, data.action, "reason" in data ? data.reason : undefined);
  });
