import type {
  Assessment,
  ImportItem,
  ReportDetail,
  ResultRow,
} from "@/lib/instagram-intelligence-report";
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
      list_instagram_intelligence_sources: {
        Args: Record<never, never>;
        Returns: { id: string; name: string }[];
      };
      enqueue_instagram_intelligence_connected: {
        Args: { p_batch: string; p_workspace: string };
        Returns: number;
      };
      enqueue_instagram_intelligence_import: {
        Args: { p_batch: string; p_label: string; p_items: ImportItem[] };
        Returns: number;
      };
      list_instagram_intelligence_results: { Args: { p_batch: string }; Returns: ResultRow[] };
      get_instagram_intelligence_report: { Args: { p_job: string }; Returns: ReportDetail | null };
      save_instagram_intelligence_review: {
        Args: { p_job: string; p_assessment: Assessment };
        Returns: unknown;
      };

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
    return new Error(
      "As migrations do Instagram Intelligence precisam estar aplicadas neste ambiente.",
    );
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

export async function createIntelligenceBatch(name: string, usernames: string[]) {
  const { data, error } = await client().rpc("create_instagram_intelligence_batch", {
    p_name: name,
    p_usernames: usernames,
  });
  if (error) throw serviceError(error);
  return data;
}

export async function getIntelligenceSources(signal: AbortSignal) {
  const { data, error } = await client()
    .rpc("list_instagram_intelligence_sources")
    .abortSignal(signal);
  if (error) throw serviceError(error);
  return data;
}

export async function enqueueIntelligenceConnected(batchId: string, workspaceId: string) {
  const { data, error } = await client().rpc("enqueue_instagram_intelligence_connected", {
    p_batch: batchId,
    p_workspace: workspaceId,
  });
  if (error) throw serviceError(error);
  return data;
}

export async function enqueueIntelligenceImport(
  batchId: string,
  filename: string,
  items: ImportItem[],
) {
  const { data, error } = await client().rpc("enqueue_instagram_intelligence_import", {
    p_batch: batchId,
    p_label: filename,
    p_items: items,
  });
  if (error?.code === "22023")
    throw new Error(
      "Confira se todos os perfis pertencem ao lote e se as datas e métricas são válidas.",
    );
  if (error) throw serviceError(error);
  return data;
}

export async function getIntelligenceResults(batchId: string, signal: AbortSignal) {
  const { data, error } = await client()
    .rpc("list_instagram_intelligence_results", { p_batch: batchId })
    .abortSignal(signal);
  if (error) throw serviceError(error);
  return data;
}

export async function getIntelligenceReport(id: string, signal: AbortSignal) {
  const { data, error } = await client()
    .rpc("get_instagram_intelligence_report", { p_job: id })
    .abortSignal(signal);
  if (error) throw serviceError(error);
  if (!data) throw new Error("O relatório não está disponível.");
  return data;
}

export async function saveIntelligenceReview(jobId: string, assessment: Assessment) {
  const { error } = await client().rpc("save_instagram_intelligence_review", {
    p_job: jobId,
    p_assessment: assessment,
  });
  if (error?.code === "22023")
    throw new Error(
      "Confira as notas, justificativas e evidências. Campos de justificativa das notas e do Status da Conta exigem ao menos 10 caracteres.",
    );
  if (error) throw serviceError(error);
}
