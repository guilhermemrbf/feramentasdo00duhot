import { createMiddleware } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "./auth-middleware";

export const requirePlatformAccess = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const db = context.supabase as unknown as SupabaseClient;
    const { data, error } = await db.rpc("platform_is_approved");
    if (error || data !== true) throw new Error("O acesso à plataforma ainda não foi aprovado.");
    return next();
  });
