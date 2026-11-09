import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowRight, Pause, Play, Repeat2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { InstagramReelLoop, PostkitDatabase } from "@/lib/postkit-database";
import { zonedDateTimeToIso } from "@/lib/scheduling";

const client = supabase as unknown as SupabaseClient<PostkitDatabase>;
const frequencies = [
  { value: 1440, label: "A cada 24 horas" },
  { value: 720, label: "A cada 12 horas" },
  { value: 480, label: "A cada 8 horas" },
  { value: 360, label: "A cada 6 horas" },
  { value: 240, label: "A cada 4 horas" },
  { value: 120, label: "A cada 2 horas" },
];
const stateLabels = { active: "Ativo", paused: "Pausado", finished: "Concluído" };
const pauseLabels: Record<string, string> = {
  manual: "Pausado pela equipe.",
  account: "Reconecte a conta antes de retomar.",
  post: "O último Reel falhou ou precisa ser conferido no Instagram. Confira o histórico.",
};

export function InstagramLoops({
  workspaceId,
  timezone,
  accounts,
  videos,
  onAccounts,
  onLibrary,
}: {
  workspaceId: string;
  timezone: string;
  accounts: Array<{ id: string; username: string }>;
  videos: Array<{ id: string; name: string }>;
  onAccounts: () => void;
  onLibrary: () => void;
}) {
  const [rows, setRows] = useState<InstagramReelLoop[]>();
  const [canEdit, setCanEdit] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState("");
  const [name, setName] = useState("");
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(1440);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const activeAccounts = new Set(
    rows?.filter((row) => row.state === "active").map((row) => row.account_id),
  );
  const dateFormat = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    dateStyle: "short",
    timeStyle: "short",
  });

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const { data, error } = await client.rpc("list_instagram_reel_loops", {
          p_workspace_id: workspaceId,
        });
        if (!active) return;
        if (error) {
          setLoadError(
            error.code === "PGRST202"
              ? "Os loops aguardam a ativação no banco deste projeto."
              : "Não foi possível carregar os loops.",
          );
          return;
        }
        setRows(data ?? []);
        setLoadError("");
      } catch {
        if (active) setLoadError("Não foi possível carregar os loops.");
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [workspaceId, refreshKey]);

  useEffect(() => {
    let active = true;
    void supabase
      .rpc("has_workspace_role", {
        target_workspace: workspaceId,
        allowed_roles: ["owner", "admin", "editor"],
      })
      .then(({ data, error }) => {
        if (active) setCanEdit(!error && data === true);
      });
    return () => {
      active = false;
    };
  }, [workspaceId]);

  async function createLoop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !canEdit) return;
    setFormError("");
    setMessage("");
    if (!accountIds.length || !assetIds.length) {
      setFormError("Marque pelo menos uma conta e um vídeo.");
      return;
    }
    let start: string;
    try {
      start = zonedDateTimeToIso(date, time, timezone);
      if (Date.parse(start) <= Date.now()) throw new Error();
    } catch {
      setFormError("Escolha um dia e horário no futuro.");
      return;
    }
    setBusy("new");
    try {
      const { data, error } = await client.rpc("create_instagram_reel_loops", {
        p_workspace_id: workspaceId,
        p_name: name.trim(),
        p_account_ids: accountIds,
        p_asset_ids: assetIds,
        p_caption: caption.trim(),
        p_interval_minutes: intervalMinutes,
        p_start_at: start,
      });
      if (error) {
        setFormError(
          error.code === "23505"
            ? "Uma das contas já tem um loop ativo. Escolha outra conta ou pause o loop atual."
            : "Não foi possível salvar. Confira as contas, os vídeos e a data e tente de novo.",
        );
        return;
      }
      setName("");
      setAccountIds([]);
      setAssetIds([]);
      setCaption("");
      setEditing(false);
      setMessage(
        data === 1
          ? "Loop salvo. A primeira publicação seguirá o horário escolhido."
          : "Loops salvos. Você pode acompanhar cada conta abaixo.",
      );
      setRefreshKey((value) => value + 1);
    } catch {
      setFormError("Não foi possível confirmar. Confira a lista de loops antes de tentar de novo.");
      setRefreshKey((value) => value + 1);
    } finally {
      setBusy("");
    }
  }

  async function toggleLoop(row: InstagramReelLoop) {
    if (busy || !canEdit) return;
    const paused = row.state === "active";
    setBusy(row.id);
    setMessage("");
    try {
      const { data, error } = await client.rpc("set_instagram_reel_loop_paused", {
        p_id: row.id,
        p_paused: paused,
      });
      if (error || !data) {
        setMessage(
          error?.code === "23505"
            ? "Essa conta já tem outro loop ativo."
            : "Não foi possível alterar o loop. Confira a conexão da conta e o histórico.",
        );
      } else {
        setMessage(
          paused
            ? "Loop pausado. Publicações que já estão na fila continuam agendadas."
            : "Loop retomado.",
        );
      }
    } catch {
      setMessage(
        "Não foi possível confirmar a alteração. Confira a lista antes de tentar de novo.",
      );
    } finally {
      setRefreshKey((value) => value + 1);
      setBusy("");
    }
  }

  return (
    <section className="mt-4 space-y-4" aria-label="Loops de Reels">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Repeat2 className="size-5 text-primary" /> Uma sequência que se publica sozinha
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha os vídeos e a frequência. Cada conta avança na lista e o loop termina quando ela
            acabar.
          </p>
        </div>
        {canEdit && rows && !editing && accounts.length > 0 && videos.length > 0 && (
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            onClick={() => setEditing(true)}
          >
            Novo loop
          </button>
        )}
        {!accounts.length && (
          <button
            type="button"
            onClick={onAccounts}
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
          >
            Conectar conta <ArrowRight className="size-4" />
          </button>
        )}
        {!!accounts.length && !videos.length && (
          <button
            type="button"
            onClick={onLibrary}
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
          >
            Adicionar vídeos <ArrowRight className="size-4" />
          </button>
        )}
      </div>
      {loadError && (
        <p
          role="status"
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
        >
          {loadError}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-lg border border-border bg-card p-3 text-sm">
          {message}
        </p>
      )}

      {editing && (
        <form
          onSubmit={(event) => void createLoop(event)}
          className="rounded-xl border border-border bg-card p-4 sm:p-5"
        >
          <fieldset disabled={!!busy} className="space-y-4">
            <legend className="mb-3 font-semibold">Programar um novo loop</legend>
            <label className="block text-sm">
              Nome do loop
              <input
                className="field mt-1"
                value={name}
                maxLength={100}
                required
                placeholder="Ex.: Reels da campanha de verão"
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <fieldset className="rounded-lg border border-border p-3">
              <legend className="px-1 text-sm font-semibold">1. Em quais contas?</legend>
              <p className="mb-2 text-xs text-muted-foreground">
                Cada conta tem sua própria sequência. É possível manter um loop ativo por conta.
              </p>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {accounts.map((item) => (
                  <label
                    key={item.id}
                    className="flex gap-2 rounded-md p-1.5 text-sm hover:bg-secondary/30"
                  >
                    <input
                      type="checkbox"
                      checked={accountIds.includes(item.id)}
                      disabled={
                        activeAccounts.has(item.id) ||
                        (!accountIds.includes(item.id) && accountIds.length >= 20)
                      }
                      onChange={(event) =>
                        setAccountIds((ids) =>
                          event.target.checked
                            ? [...ids, item.id]
                            : ids.filter((id) => id !== item.id),
                        )
                      }
                    />
                    @{item.username}
                    {activeAccounts.has(item.id) ? " · Já tem loop ativo" : ""}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="rounded-lg border border-border p-3">
              <legend className="px-1 text-sm font-semibold">2. Quais vídeos?</legend>
              <p className="mb-2 text-xs text-muted-foreground">
                Marque até 100 vídeos na ordem desejada. O loop pula vídeos já publicados ou na fila
                daquela conta.
              </p>
              <div className="max-h-52 space-y-1 overflow-y-auto">
                {videos.map((item) => {
                  const index = assetIds.indexOf(item.id);
                  return (
                    <label
                      key={item.id}
                      className="flex gap-2 rounded-md p-1.5 text-sm hover:bg-secondary/30"
                    >
                      <input
                        type="checkbox"
                        checked={index >= 0}
                        disabled={index < 0 && assetIds.length >= 100}
                        onChange={(event) =>
                          setAssetIds((ids) =>
                            event.target.checked
                              ? [...ids, item.id]
                              : ids.filter((id) => id !== item.id),
                          )
                        }
                      />
                      <span className="min-w-0 break-words">
                        {index >= 0 ? `${index + 1}. ` : ""}
                        {item.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label className="block text-sm">
              Legenda e hashtags dos Reels (opcional)
              <textarea
                className="field mt-1 min-h-20"
                value={caption}
                maxLength={2200}
                onChange={(event) => setCaption(event.target.value)}
              />
            </label>
            <fieldset className="rounded-lg border border-border p-3">
              <legend className="px-1 text-sm font-semibold">3. Quando publicar?</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm">
                  Primeiro dia
                  <input
                    className="field mt-1"
                    type="date"
                    required
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Primeiro horário
                  <input
                    className="field mt-1"
                    type="time"
                    required
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Frequência
                  <select
                    className="field mt-1"
                    value={intervalMinutes}
                    onChange={(event) => setIntervalMinutes(Number(event.target.value))}
                  >
                    {frequencies.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Fuso da agenda: {timezone}.</p>
            </fieldset>
            {formError && (
              <p role="alert" className="text-sm text-amber-300">
                {formError}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                {busy ? "Salvando…" : "Confirmar e ativar loop"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Voltar
              </button>
              <p className="text-xs text-muted-foreground">
                {assetIds.length} vídeos escolhidos · {accountIds.length} contas
              </p>
            </div>
          </fieldset>
        </form>
      )}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="font-semibold">Seus loops</h2>
        {!rows && !loadError && (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            Carregando loops…
          </p>
        )}
        {rows?.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Seus loops aparecem aqui quando você cria uma sequência.
          </p>
        )}
        <div className="mt-2 divide-y divide-border">
          {rows?.map((row) => (
            <article
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <h3 className="break-words text-sm font-semibold">
                  {row.name} · @{row.username}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Posição na lista: {row.asset_index} de {row.total}
                  {row.state === "active"
                    ? ` · Próxima verificação: ${dateFormat.format(new Date(row.next_at))}`
                    : ""}
                </p>
                {row.pause_reason && (
                  <p className="mt-1 text-xs text-amber-300">{pauseLabels[row.pause_reason]}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${row.state === "active" ? "bg-emerald-500/10 text-emerald-300" : "bg-secondary text-muted-foreground"}`}
                >
                  {stateLabels[row.state]}
                </span>
                {canEdit && row.state !== "finished" && (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void toggleLoop(row)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    {row.state === "active" ? (
                      <Pause className="size-3.5" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                    {busy === row.id
                      ? "Atualizando…"
                      : row.state === "active"
                        ? "Pausar"
                        : "Retomar"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
