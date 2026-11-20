import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostkitDatabase } from "./postkit-database";
import {
  decryptInstagramToken,
  getInstagramOAuthBaseConfig,
  getInstagramOAuthConfig,
} from "./instagram-oauth.server";
import { getMetaGraphBaseUrl } from "./social-publishing.server";

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

export function workspaceAppSecretBinding(workspaceId: string, appId: string, configId: string) {
  return ["instagram-workspace-app", workspaceId, appId, configId].join(":");
}

export async function workspaceAppForCallback(workspaceId: string, revision?: string) {
  const failure = "Instagram workspace app changed or is unavailable.";
  if (!revision) throw new Error(failure);
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
