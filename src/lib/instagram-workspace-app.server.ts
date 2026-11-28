import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostkitDatabase } from "./postkit-database";
import {
  decryptInstagramToken,
  getInstagramOAuthBaseConfig,
  getInstagramOAuthConfig,
} from "./instagram-oauth.server.ts";
import { getMetaGraphBaseUrl } from "./social-publishing.server.ts";

export async function workspaceAppDatabase() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient<PostkitDatabase>;
}

export async function readWorkspaceApp(workspaceId: string) {
  const db = await workspaceAppDatabase();
  const result = await db
    .from("instagram_workspace_apps")
    .select("revision,app_id,login_config_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (result.error) throw new Error("Não foi possível consultar o app Meta da operação.");
  return result.data;
}

// Preserve access for existing central workspaces and platform administrators.
export async function canUsePlatformInstagramApp(
  supabase: SupabaseClient,
  workspaceId: string,
  legacy: boolean,
) {
  if (legacy) return true;
  const { data, error } = await supabase.rpc("platform_access_status");
  if (error) throw new Error("Não foi possível confirmar o acesso à integração.");
  if (data?.status === "admin") return true;
  const accounts = await supabase
    .from("instagram_accounts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .limit(1);
  if (accounts.error) throw new Error("Não foi possível verificar as contas da operação.");
  return !!accounts.data.length;
}

export function workspaceAppSecretBinding(workspaceId: string, appId: string, configId: string) {
  return ["instagram-workspace-app", workspaceId, appId, configId].join(":");
}

export function platformInstagramAppRevision(appId: string, configId: string) {
  return ["platform", appId, configId].join(":");
}

export async function workspaceAppForCallback(workspaceId: string, revision?: string) {
  const failure = "Instagram workspace app changed or is unavailable.";
  if (!revision) throw new Error(failure);

  if (revision.startsWith("platform:")) {
    const [, appId, configId] = revision.split(":");
    const globalConfig = getInstagramOAuthConfig();
    const { getInstagramUnifiedConfigId } = await import("./instagram-unified-login.server");
    if (
      appId !== globalConfig.appId ||
      !configId ||
      configId !== getInstagramUnifiedConfigId(globalConfig.appId)
    ) {
      throw new Error(failure);
    }
    return { config: globalConfig, configId };
  }

  const db = await workspaceAppDatabase();
  const { data, error } = await db
    .from("instagram_workspace_apps")
    .select("app_id,login_config_id,secret_ciphertext")
    .eq("workspace_id", workspaceId)
    .eq("revision", revision)
    .maybeSingle();
  if (error || !data) throw new Error(failure);
  if (!data.app_id) return { config: getInstagramOAuthConfig(), configId: undefined };
  if (!data.login_config_id || !data.secret_ciphertext) throw new Error(failure);
  const appSecret = await decryptInstagramToken(
    data.secret_ciphertext,
    workspaceAppSecretBinding(workspaceId, data.app_id, data.login_config_id),
  );
  return {
    config: { ...getInstagramOAuthBaseConfig(), appId: data.app_id, appSecret },
    configId: data.login_config_id,
  };
}

export async function validateWorkspaceMetaApp(appId: string, appSecret: string) {
  const url = new URL(getMetaGraphBaseUrl("instagram_unified_login") + "/" + appId);
  url.searchParams.set("fields", "id");
  const response = await fetch(url, {
    headers: { Authorization: "Bearer " + appId + "|" + appSecret },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response || response.status === 429 || response.status >= 500) return "unavailable";
  if (!response.ok) return "credentials";
  const payload = (await response.json().catch(() => null)) as { id?: string } | null;
  return payload?.id === appId ? "valid" : "credentials";
}
