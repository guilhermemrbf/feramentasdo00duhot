import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { PostkitDatabase } from "@/lib/postkit-database";

const labels: Record<string, string> = {
  scheduled: "Agendado",
  processing: "Preparando publicação",
  published: "Publicado",
  failed: "Precisa de correção",
  needs_review: "Conferir no Instagram",
  cancelled: "Cancelado",
  draft: "Rascunho",
  paused: "Pausado",
};
type HistoryRow = {
  id: string;
  status: string;
  caption: string;
  scheduled_at: string | null;
  published_at: string | null;
  meta_media_id: string | null;
  last_error_message: string | null;
  instagram_accounts: { username: string } | null;
  media_assets: { original_filename: string } | null;
};

export function InstagramHistory({
  workspaceId,
  timezone,
  refreshKey,
}: {
  workspaceId: string;
  timezone: string;
  refreshKey: number;
}) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    const load = async () => {
      const result = await supabase
        .from("posts")
        .select(
          "id,status,caption,scheduled_at,published_at,meta_media_id,last_error_message,instagram_accounts(username),media_assets(original_filename)",
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
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
  }, [workspaceId, refreshKey, refresh]);

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
  const visible = rows.filter((row) => filter === "all" || row.status === filter);
  return (
    <section
      className="mt-6 rounded-lg border border-border bg-card p-5"
      aria-label="Histórico de publicações"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Agendamentos e histórico</h2>
          <p className="text-xs text-muted-foreground">
            Últimos 100 registros · horários em {timezone} · atualização a cada 30 segundos
          </p>
        </div>
        <div className="flex gap-2">
          <select
            aria-label="Filtrar histórico"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-md border border-border bg-background p-2 text-xs"
          >
            <option value="all">Todos os estados</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
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
      ) : visible.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">
          Nenhuma publicação encontrada neste filtro.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-border">
          {visible.map((row) => (
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
                {row.status === "published" && row.meta_media_id && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Confirmação Instagram: {row.meta_media_id}
                  </p>
                )}
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs">
                {labels[row.status] ?? row.status}
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
