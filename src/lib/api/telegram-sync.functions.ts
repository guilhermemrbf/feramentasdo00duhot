import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const telegramSyncAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.record(z.unknown()))
  .handler(async ({ data }) => {
    const base = process.env.TELEGRAM_SYNC_SERVICE_URL;
    if (!base) throw new Error("Telegram Sync ainda não foi configurado pelo administrador.");
    const response = await fetch(`${base.replace(/\/$/, "")}/command`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getRequest().headers.get("authorization") ?? "",
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(60000),
      redirect: "error",
    });
    const value = await response.json();
    if (!response.ok)
      throw new Error(
        typeof value.detail === "string" ? value.detail : "Confira os campos e tente novamente.",
      );
    return JSON.stringify(value);
  });
