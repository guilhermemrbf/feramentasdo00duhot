import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Notification = Pick<
  Database["public"]["Tables"]["notifications"]["Row"],
  "id" | "title" | "body" | "created_at" | "read_at" | "user_id"
>;

export function InstagramNotifications({
  workspaceId,
  timezone,
}: {
  workspaceId: string;
  timezone: string;
}) {
  const [notifications, setNotifications] = useState<Notification[]>();
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const dates = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: timezone,
  });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await supabase
          .from("notifications")
          .select("id,title,body,created_at,read_at,user_id")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(30);
        if (result.error) throw result.error;
        if (active) setNotifications(result.data ?? []);
      } catch {
        if (active) setError("Não foi possível carregar os avisos.");
      }
    })();
    return () => {
      active = false;
    };
  }, [workspaceId, refresh]);

  async function markRead(id: string) {
    setError("");
    try {
      const readAt = new Date().toISOString();
      const result = await supabase
        .from("notifications")
        .update({ read_at: readAt })
        .eq("workspace_id", workspaceId)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (result.error || !result.data) throw new Error("Aviso indisponível.");
      setNotifications((items) =>
        items?.map((item) => (item.id === id ? { ...item, read_at: readAt } : item)),
      );
    } catch {
      setError("Não foi possível marcar o aviso como lido.");
    }
  }
  return (
    <section className="postkit-card space-y-3 p-4" aria-label="Avisos da operação">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Notificações na plataforma</h2>
        <button
          type="button"
          className="postkit-outlined"
          onClick={() => {
            setError("");
            setRefresh((value) => value + 1);
          }}
        >
          Atualizar avisos
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {!notifications && !error && <p role="status">Carregando avisos…</p>}
      {notifications?.length === 0 && <p className="postkit-muted">Nenhum aviso na operação.</p>}
      {!!notifications?.length && (
        <ul className="divide-y divide-border">
          {notifications.map((item) => (
            <li className="flex flex-wrap items-center justify-between gap-2 py-3" key={item.id}>
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p>{item.body}</p>
                <p className="postkit-muted">
                  {dates.format(new Date(item.created_at))}
                  {item.read_at ? " · Lido" : ""}
                </p>
              </div>
              {!item.read_at && item.user_id && (
                <button
                  type="button"
                  className="postkit-text-button"
                  onClick={() => void markRead(item.id)}
                >
                  Marcar como lido
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="postkit-muted">
        Notificações push e widget do iPhone ainda não estão integrados.
      </p>
    </section>
  );
}
