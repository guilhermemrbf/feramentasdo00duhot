import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PostkitDatabase } from "@/lib/postkit-database";
import type { InstagramConnectionProfile } from "@/lib/instagram-connection-profile";

const accountInput = z.object({ workspaceId: z.string().uuid(), accountId: z.string().uuid() });
export type InstagramConnectionCheck = {
  outcome: "verified" | "reconnect_required" | "unavailable";
  message: string;
  checkedAt: string | null;
  profile: InstagramConnectionProfile | null;
};

async function requireAccount(
  client: SupabaseClient<PostkitDatabase>,
  data: z.infer<typeof accountInput>,
) {
  const { data: allowed, error: roleError } = await client.rpc("has_workspace_role", {
    target_workspace: data.workspaceId,
    allowed_roles: ["owner", "admin", "editor"],
  });
  if (roleError || !allowed) throw new Error("Você não tem permissão para gerenciar esta conta.");
  const { data: account, error } = await client
    .from("instagram_accounts")
    .select("id,instagram_user_id,auth_mode,connection_status,token_expires_at")
    .eq("id", data.accountId)
    .eq("workspace_id", data.workspaceId)
    .maybeSingle();
  if (error || !account) throw new Error("Conta indisponível nesta operação.");
  return account;
}

export const verifyInstagramConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(accountInput)
  .handler(async ({ data, context }): Promise<InstagramConnectionCheck> => {
    const client = context.supabase as unknown as SupabaseClient<PostkitDatabase>;
    const account = await requireAccount(client, data);
    const unavailable = (message: string, reconnect = false): InstagramConnectionCheck => ({
      outcome: reconnect ? "reconnect_required" : "unavailable",
      message,
      checkedAt: null,
      profile: null,
    });
    if (account.connection_status !== "connected")
      return unavailable("Esta conta precisa ser conectada novamente.", true);
    const mode = account.auth_mode;
    if (!["instagram_login", "facebook_login", "instagram_unified_login"].includes(mode))
      return unavailable(
        "O método de autorização desta conta não é compatível. Reconecte-a.",
        true,
      );
    const { InstagramConnectionError, readInstagramConnectionProfile } =
      await import("@/lib/instagram-connection-profile");
    try {
      const { getInstagramAccountAccessToken } = await import("@/lib/instagram-oauth.server");
      const { getMetaGraphBaseUrl } = await import("@/lib/social-publishing.server");
      const profile = await readInstagramConnectionProfile({
        instagramUserId: account.instagram_user_id,
        accessToken: await getInstagramAccountAccessToken(account.id),
        graphBaseUrl: getMetaGraphBaseUrl(
          mode as "instagram_login" | "facebook_login" | "instagram_unified_login",
        ),
      });
      const checkedAt = new Date().toISOString();
      const { data: updated, error } = await client
        .from("instagram_accounts")
        .update({
          username: profile.username,
          display_name: profile.name,
          profile_picture_url: profile.pictureUrl,
          last_verified_at: checkedAt,
          last_error_code: null,
          last_error_message: null,
        })
        .eq("id", account.id)
        .eq("workspace_id", data.workspaceId)
        .eq("connection_status", "connected")
        .select("id")
        .maybeSingle();
      if (error || !updated)
        return unavailable("A consulta terminou, mas a conexão mudou. Atualize a lista.");
      return {
        outcome: "verified",
        message: "Acesso confirmado pela API oficial da Meta.",
        checkedAt,
        profile,
      };
    } catch (error) {
      const expired =
        error instanceof Error && error.message === "Instagram account authorization expired.";
      if (
        expired ||
        (error instanceof InstagramConnectionError && error.reason === "authorization_invalid")
      ) {
        await client
          .from("instagram_accounts")
          .update({
            connection_status: "expired",
            last_error_code: "authorization_invalid",
            last_error_message: "Reconecte esta conta na Meta.",
          })
          .eq("id", account.id)
          .eq("workspace_id", data.workspaceId)
          .eq("connection_status", "connected");
        return unavailable(
          "A autorização expirou ou foi retirada na Meta. Reconecte esta conta.",
          true,
        );
      }
      if (error instanceof InstagramConnectionError) return unavailable(error.message);
      return unavailable("Não foi possível verificar o acesso agora. Tente novamente mais tarde.");
    }
  });

export const disconnectInstagramConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(accountInput)
  .handler(async ({ data, context }) => {
    const client = context.supabase as unknown as SupabaseClient<PostkitDatabase>;
    await requireAccount(client, data);
    const { data: result, error } = await client.rpc("disconnect_instagram_account", {
      p_account_id: data.accountId,
    });
    if (error) {
      if (error.message.includes("account_publish_in_progress"))
        throw new Error(
          "Há um Reel em processamento nesta conta. Tente novamente quando o processamento terminar.",
        );
      if (error.code === "PGRST202")
        throw new Error(
          "A atualização de conexão ainda não foi aplicada no servidor. Avise o administrador.",
        );
      throw new Error(
        "Não foi possível desconectar. Sua biblioteca e seu histórico foram preservados.",
      );
    }
    if (
      !result ||
      typeof result !== "object" ||
      Array.isArray(result) ||
      result.disconnected !== true
    )
      throw new Error(
        "O servidor não confirmou a desconexão. Atualize a lista antes de tentar novamente.",
      );
    return { disconnected: true };
  });
