import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Batch = {
  id: string;
  owner_id: string;
  name: string;
  profile_count: number;
  created_at: string;
};
type Profile = { batch_id: string; username: string; position: number };
type ReadOnlyTable<Row> = { Row: Row; Insert: never; Update: never; Relationships: [] };
type IntelligenceDatabase = {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Database["public"]["Tables"] & {
      instagram_intelligence_batches: ReadOnlyTable<Batch>;
      instagram_intelligence_profiles: ReadOnlyTable<Profile>;
    };
    Functions: Database["public"]["Functions"] & {
      create_instagram_intelligence_batch: {
        Args: { p_name: string; p_usernames: string[] };
        Returns: string;
      };
    };
  };
};

const client = () => supabase as unknown as SupabaseClient<IntelligenceDatabase>;
export const PAGE_SIZE = 25;

function serviceError(error: { code?: string }) {
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(error.code ?? "")) {
    return new Error("O banco desta ferramenta ainda precisa da configuração de importação.");
  }
  if (["42501", "PGRST301", "PGRST303"].includes(error.code ?? "")) {
    return new Error(
      "O acesso expirou ou não está autorizado. Entre com Google e tente novamente.",
    );
  }
  return new Error("Não foi possível concluir a operação. Tente novamente.");
}

export async function getIntelligenceBatches(page: number, signal: AbortSignal) {
  const offset = page * PAGE_SIZE;
  const { data, error } = await client()
    .from("instagram_intelligence_batches")
    .select("id,name,profile_count,created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + PAGE_SIZE)
    .abortSignal(signal);
  if (error) throw serviceError(error);
  return { items: data.slice(0, PAGE_SIZE), hasMore: data.length > PAGE_SIZE };
}

export async function getIntelligenceProfiles(batchId: string, page: number, signal: AbortSignal) {
  const offset = page * PAGE_SIZE;
  const { data, error } = await client()
    .from("instagram_intelligence_profiles")
    .select("position,username")
    .eq("batch_id", batchId)
    .order("position")
    .range(offset, offset + PAGE_SIZE)
    .abortSignal(signal);
  if (error) throw serviceError(error);
  return { items: data.slice(0, PAGE_SIZE), hasMore: data.length > PAGE_SIZE };
}

export async function createIntelligenceBatch(name: string, usernames: string[]) {
  const { data, error } = await client().rpc("create_instagram_intelligence_batch", {
    p_name: name,
    p_usernames: usernames,
  });
  if (error) throw serviceError(error);
  return data;
}
