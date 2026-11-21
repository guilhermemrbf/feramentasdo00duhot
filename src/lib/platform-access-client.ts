import { supabase } from "@/integrations/supabase/client";
import type { PlatformAccess } from "@/lib/platform-access";

export type Lead = {
  id: string;
  email: string | null;
  name: string;
  decision: "pending" | "approved" | "denied";
  verified_at: string | null;
  created_at: string;
  decided_at: string | null;
  trial_expires_at: string | null;
};

export type TrialInvite = {
  id: string;
  email: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
};

type RpcResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

type PlatformRpc = {
  rpc(name: "platform_access_status"): RpcResult<PlatformAccess>;
  rpc(name: "platform_admin_leads"): RpcResult<Lead[]>;
  rpc(name: "platform_admin_invites"): RpcResult<TrialInvite[]>;
  rpc(name: "platform_admin_create_invite", params: { p_email: string }): RpcResult<string>;
  rpc(
    name: "platform_admin_decide",
    params: { p_user: string; p_decision: "approved" | "denied" },
  ): RpcResult<null>;
  rpc(name: "platform_admin_revoke_invite", params: { p_id: string }): RpcResult<null>;
  rpc(name: "platform_start_trial", params: { p_token: string }): RpcResult<PlatformAccess>;
};

export const platformRpc = supabase as unknown as PlatformRpc;

export async function rpcData<T>(query: RpcResult<T>): Promise<T | null> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}
