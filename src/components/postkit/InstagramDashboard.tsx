import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Instagram,
  Video,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calendarDateInZone, zonedDateTimeToIso } from "@/lib/scheduling";

const periods = [
  { id: "today", label: "Hoje", days: 0 },
  { id: "yesterday", label: "Ontem", days: 1 },
  { id: "week", label: "7 dias", days: 6 },
  { id: "month", label: "30 dias", days: 29 },
] as const;

type UpcomingPost = {
  id: string;
  scheduled_at: string | null;
  instagram_accounts: { username: string } | null;
  media_assets: { original_filename: string } | null;
};
type DashboardData = {
  period: (typeof periods)[number]["id"];
  upcoming: UpcomingPost[];
  queued: number;
  published: number;
  hasPublished: boolean;
  needsAttention: number;
};

function periodBounds(timezone: string, days: number, yesterday: boolean) {
  const now = new Date();
  const boundary = (offset: number) =>
    zonedDateTimeToIso(calendarDateInZone(timezone, offset, now), "00:00", timezone);
  return { start: boundary(-days), end: boundary(yesterday ? 0 : 1) };
}

export function InstagramDashboard({
  workspaceId,
  timezone,
  accountCount,
  videoCount,
  refreshKey,
  onAccounts,
  onLibrary,
  onSchedule,
  onQueue,
  onHistory,
}: {
  workspaceId: string;
  timezone: string;
  accountCount: number | null;
  videoCount: number | null;
  refreshKey: number;
  onAccounts: () => void;
  onLibrary: () => void;
  onSchedule: () => void;
  onQueue: () => void;
  onHistory: () => void;
}) {
  const [period, setPeriod] = useState<(typeof periods)[number]>(periods[0]);
  const [data, setData] = useState<DashboardData>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const periodData = data?.period === period.id ? data : undefined;

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { start, end } = periodBounds(timezone, period.days, period.id === "yesterday");
      const posts = () => supabase.from("posts");
      const [upcoming, published, allPublished, attention] = await Promise.all([
        posts()
          .select(
            "id,scheduled_at,instagram_accounts(username),media_assets!posts_media_asset_id_workspace_id_fkey(original_filename)",
            {
              count: "exact",
            },
          )
          .eq("workspace_id", workspaceId)
          .in("status", ["scheduled", "processing"])
          .order("scheduled_at", { ascending: true, nullsFirst: false })
          .limit(5),
        posts()
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("status", "published")
          .gte("published_at", start)
          .lt("published_at", end),
        posts()
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("status", "published"),
        posts()
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .in("status", ["failed", "needs_review"])
          .gte("updated_at", start)
          .lt("updated_at", end),
      ]);
      if (!active) return;
      if (upcoming.error || published.error || allPublished.error || attention.error) {
        setError(true);
        return;
      }
      setData({
        period: period.id,
        upcoming: upcoming.data ?? [],
        queued: upcoming.count ?? 0,
        published: published.count ?? 0,
        hasPublished: (allPublished.count ?? 0) > 0,
        needsAttention: attention.count ?? 0,
      });
      setError(false);
    };
    const refresh = () =>
      void load().catch(() => {
        if (active) setError(true);
      });
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [workspaceId, timezone, period, refreshKey, retry]);

  const steps = [
    {
      title: "Conecte uma conta do Instagram",
      done: !!accountCount,
      action: "Conectar conta",
      run: onAccounts,
    },
    {
      title: "Adicione seu primeiro vídeo",
      done: !!videoCount,
      action: "Adicionar vídeo",
      run: onLibrary,
    },
    {
      title: "Agende uma publicação",
      done: !!data && (data.queued > 0 || data.hasPublished),
      action: "Agendar Reel",
      run: onSchedule,
    },
    {
      title: "Confira a primeira publicação no ar",
      done: !!data?.hasPublished,
      action: "Ver fila",
      run: onQueue,
    },
  ];
  const completed = steps.filter((step) => step.done).length;
  const metrics = [
    {
      label: "Publicações no ar",
      value: periodData?.published,
      note: "Confirmadas no período",
      icon: CheckCircle2,
    },
    {
      label: "Contas conectadas",
      value: accountCount,
      note: "Disponíveis para publicar",
      icon: Instagram,
    },
    {
      label: "Publicações na fila",
      value: data?.queued,
      note: "Agendadas ou em processamento",
      icon: Clock3,
    },
    { label: "Vídeos na biblioteca", value: videoCount, note: "Arquivos disponíveis", icon: Video },
  ];
  const dateFormat = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="space-y-4">
      <section
        aria-labelledby="instagram-first-steps"
        className="rounded-2xl border border-border bg-card p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="instagram-first-steps" className="font-display text-lg font-semibold">
              Primeiros passos
            </h2>
            <p className="text-sm text-muted-foreground">
              Da primeira conexão à primeira publicação.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium">
            <progress
              value={completed}
              max={steps.length}
              aria-label="Progresso dos primeiros passos"
              className="h-2 w-24 accent-primary sm:w-36"
            />
            {completed} de {steps.length}
          </div>
        </div>
        <ol className="mt-3 divide-y divide-border">
          {steps.map(({ title, done, action, run }, index) => (
            <li key={title} className="flex flex-wrap items-center gap-3 py-3 last:pb-0">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${done ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-border text-muted-foreground"}`}
              >
                {done ? <Check className="size-4" aria-label="Concluído" /> : index + 1}
              </span>
              <span className="min-w-40 flex-1 text-sm font-medium">{title}</span>
              {!done && (
                <button
                  type="button"
                  onClick={run}
                  className="rounded-md px-2 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10"
                >
                  {action}
                </button>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Resumo da operação" className="space-y-3">
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Período do resumo"
        >
          <span className="mr-1 text-sm font-semibold">Período</span>
          {periods.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={period.id === item.id}
              onClick={() => {
                if (period.id !== item.id) {
                  setError(false);
                  setPeriod(item);
                }
              }}
              className="filter-chip"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {metrics.map(({ label, value, note, icon: Icon }) => (
            <article
              key={label}
              className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4"
            >
              <Icon className="mb-2 size-4 text-primary" aria-hidden />
              <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
              <p className="mt-1 font-display text-2xl font-semibold">{value ?? "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{note}</p>
            </article>
          ))}
        </div>
      </section>

      {error && (
        <p
          role="status"
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
        >
          O painel não conseguiu atualizar os dados.{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Tentar novamente
          </button>
        </p>
      )}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <CalendarDays className="size-4 text-primary" /> Próximas publicações
            </h2>
            <button
              type="button"
              onClick={onQueue}
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
            >
              Ver fila <ArrowRight className="size-3.5" />
            </button>
          </div>
          {!data && !error && (
            <p role="status" className="mt-4 text-sm text-muted-foreground">
              Carregando a fila…
            </p>
          )}
          {data?.upcoming.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              A fila está vazia. Agende um Reel para começar.
            </p>
          )}
          <ul className="mt-2 divide-y divide-border">
            {data?.upcoming.map((post) => (
              <li key={post.id} className="py-2.5">
                <p className="break-words text-sm font-medium">
                  {post.media_assets?.original_filename ?? "Reel"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {post.instagram_accounts?.username
                    ? `@${post.instagram_accounts.username}`
                    : "Conta indisponível"}{" "}
                  ·{" "}
                  {post.scheduled_at ? dateFormat.format(new Date(post.scheduled_at)) : "Sem data"}
                </p>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">Precisa de atenção</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {periodData
              ? periodData.needsAttention === 0
                ? "Nenhuma falha ou revisão no período selecionado."
                : `${periodData.needsAttention} ${periodData.needsAttention === 1 ? "publicação precisa" : "publicações precisam"} de atenção neste período.`
              : "Confira o histórico para acompanhar o resultado de cada publicação."}
          </p>
          <button
            type="button"
            onClick={onHistory}
            className="mt-3 text-sm font-semibold text-primary"
          >
            Abrir histórico
          </button>
        </section>
      </div>
    </div>
  );
}
