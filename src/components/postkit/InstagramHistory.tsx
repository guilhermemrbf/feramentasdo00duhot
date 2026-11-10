import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { PostkitDatabase } from "@/lib/postkit-database";

const labels = {
  scheduled: "Agendado",
  processing: "Preparando publicação",
  published: "Publicado",
  failed: "Precisa de correção",
  needs_review: "Conferir no Instagram",
  cancelled: "Cancelado",
  draft: "Rascunho",
  paused: "Pausado",
} as const;
type Status = keyof typeof labels;
const commentLabels: Record<string, string> = {
  sending: "Enviando primeiro comentário",
  published: "Primeiro comentário publicado",
  failed: "Primeiro comentário não enviado. Confira a autorização de comentários na Meta.",
  needs_review: "Confirmação do comentário pendente. Confira o Reel no Instagram.",
};
type HistoryRow = {
  id: string;
  status: string;
  caption: string;
  scheduled_at: string | null;
  published_at: string | null;
  meta_media_id: string | null;
  last_error_message: string | null;
  first_comment: string | null;
  first_comment_status: string | null;
  instagram_accounts: { username: string } | null;
  media_assets: { original_filename: string } | null;
};

export function InstagramHistory({
  workspaceId,
  timezone,
  refreshKey,
  mode,
  accounts,
  onSchedule,
}: {
  workspaceId: string;
  timezone: string;
  refreshKey: number;
  mode: "queue" | "history";
  accounts: Array<{ id: string; username: string }>;
  onSchedule: () => void;
}) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [account, setAccount] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    const load = async () => {
      const client = supabase as unknown as SupabaseClient<PostkitDatabase>;
      let query = client
        .from("posts")
        .select(
          "id,status,caption,scheduled_at,published_at,meta_media_id,last_error_message,first_comment,first_comment_status,instagram_accounts(username),media_assets!posts_media_asset_id_workspace_id_fkey(original_filename)",
        )
        .eq("workspace_id", workspaceId);
      if (account) query = query.eq("instagram_account_id", account);
      if (filter !== "all") query = query.eq("status", filter);
      else if (mode === "queue") query = query.in("status", ["scheduled", "processing"]);
      const result = await query
        .order(mode === "queue" ? "scheduled_at" : "created_at", {
          ascending: mode === "queue",
          nullsFirst: false,
        })
        .limit(100);
      if (!active) return;
      setLoading(false);
      if (result.error) setError("Não foi possível atualizar o histórico. Tente novamente.");
      else {
        setRows(result.data ?? []);
        setError("");
      }
    };
    void load().catch(() => {
      if (active) {
        setLoading(false);
        setError("Sem conexão para atualizar o histórico.");
      }
    });
    const timer = window.setInterval(() => {
      void load().catch(() => {
        if (active) setError("Sem conexão para atualizar o histórico.");
      });
    }, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [workspaceId, refreshKey, refresh, mode, filter, account]);

  const cancel = async (id: string) => {
    if (cancelling) return;
    setCancelling(id);
    setMessage("");
    try {
      const client = supabase as unknown as SupabaseClient<PostkitDatabase>;
      const result = await client.rpc("cancel_scheduled_instagram_post", { p_post_id: id });
      if (result.error) throw result.error;
      setMessage(
        result.data
          ? "Agendamento cancelado. O arquivo continua na biblioteca."
          : "O post já começou a ser processado ou você não tem permissão para cancelar.",
      );
      setRefresh((value) => value + 1);
    } catch {
      setMessage(
        "Não foi possível confirmar o cancelamento. Atualize o histórico antes de tentar novamente.",
      );
    } finally {
      setCancelling(null);
    }
  };
  const filters: Status[] =
    mode === "queue" ? ["scheduled", "processing"] : (Object.keys(labels) as Status[]);
  return (
    <section
      className="mt-6 rounded-lg border border-border bg-card p-5"
      aria-label="Histórico de publicações"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">
            {mode === "queue" ? "O que vai sair a seguir" : "Acompanhe suas publicações"}
          </h2>
          <p className="text-xs text-muted-foreground">
            Até 100 resultados · horários em {timezone} · atualização a cada 30 segundos
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Filtrar por conta"
            value={account}
            onChange={(event) => {
              setLoading(true);
              setAccount(event.target.value);
            }}
            className="rounded-md border border-border bg-background p-2 text-sm"
          >
            <option value="">Todas as contas</option>
            {accounts.map((item) => (
              <option value={item.id} key={item.id}>
                @{item.username}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar histórico"
            value={filter}
            onChange={(event) => {
              setLoading(true);
              setFilter(event.target.value as "all" | Status);
            }}
            className="rounded-md border border-border bg-background p-2 text-sm"
          >
            <option value="all">Todos os estados</option>
            {filters.map((value) => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </select>
          <button
            onClick={() => setRefresh((value) => value + 1)}
            className="rounded-md border border-border px-3 text-xs"
          >
            Atualizar
          </button>
        </div>
      </div>
      {(error || message) && (
        <p role="status" className="mt-3 text-sm text-amber-500">
          {error || message}
        </p>
      )}
      {loading ? (
        <p className="py-8 text-sm">Carregando histórico…</p>
      ) : rows.length === 0 ? (
        <div className="py-8 text-sm text-muted-foreground">
          <p>
            {mode === "queue" && !account && filter === "all"
              ? "A fila está vazia."
              : "Nenhuma publicação encontrada neste filtro."}
          </p>
          {mode === "queue" && !account && filter === "all" && (
            <button type="button" className="mt-3 font-semibold text-primary" onClick={onSchedule}>
              Agendar um Reel
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 divide-y divide-border">
          {rows.map((row) => (
            <article key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium">
                  {row.media_assets?.original_filename ?? "Vídeo"} · @
                  {row.instagram_accounts?.username ?? "Conta"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.scheduled_at
                    ? new Intl.DateTimeFormat("pt-BR", {
                        timeZone: timezone,
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(row.scheduled_at))
                    : "Sem horário"}
                </p>
                {row.caption && (
                  <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs">{row.caption}</p>
                )}
                {row.last_error_message && (
                  <p className="mt-2 text-xs text-amber-500">{row.last_error_message}</p>
                )}
                {row.first_comment &&
                  (row.status === "published" ||
                    row.status === "scheduled" ||
                    row.status === "processing") && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {row.first_comment_status
                        ? commentLabels[row.first_comment_status]
                        : row.status === "published"
                          ? "Primeiro comentário na fila"
                          : "Primeiro comentário preparado para após a publicação"}
                    </p>
                  )}
                {row.status === "published" && row.meta_media_id && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Confirmação Instagram: {row.meta_media_id}
                  </p>
                )}
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs">
                {labels[row.status as Status] ?? row.status}
              </span>
              {row.status === "scheduled" && (
                <button
                  disabled={!!cancelling}
                  onClick={() => void cancel(row.id)}
                  className="rounded-md border border-border px-3 py-1 text-xs disabled:opacity-50"
                >
                  {cancelling === row.id ? "Cancelando…" : "Cancelar agendamento"}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
