import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Instagram, Video } from "lucide-react";
import { InstagramAccountCards } from "./InstagramAccountCards";
import { InstagramFirstSteps, instagramOnboardingSteps } from "./InstagramWorkspaceSetup";
import type { InstagramConnectionDetailsAccount } from "./InstagramConnectionDetails";
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
  status: string;
  content_type: string;
  instagram_accounts: { username: string } | null;
  media_assets: { original_filename: string } | null;
};
type DashboardData = {
  period: (typeof periods)[number]["id"];
  upcoming: UpcomingPost[];
  queued: number;
  published: number;
  allPublished: number;
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
  accounts,
  videoCounts,
  onOpenAccount,
  refreshKey,
  onAccounts,
  onLibrary,
  onSchedule,
  onQueue,
  onHistory,
  ownApp,
}: {
  workspaceId: string;
  timezone: string;
  accountCount: number | null;
  videoCount: number | null;
  accounts: InstagramConnectionDetailsAccount[];
  videoCounts?: ReadonlyMap<string, number>;
  onOpenAccount: (id: string) => void;
  refreshKey: number;
  onAccounts: () => void;
  onLibrary: () => void;
  onSchedule: () => void;
  onQueue: () => void;
  onHistory: () => void;
  ownApp: boolean;
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
            "id,scheduled_at,status,content_type,instagram_accounts!posts_instagram_account_id_workspace_id_fkey(username),media_assets!posts_media_asset_id_workspace_id_fkey(original_filename)",
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
        allPublished: allPublished.count ?? 0,
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
    ...(ownApp ? [{ title: "Configure seu app Meta", done: true }] : []),
    {
      title: instagramOnboardingSteps[0],
      done: !!accountCount,
      action: "Conectar Instagram",
      run: onAccounts,
    },
    {
      title: instagramOnboardingSteps[1],
      done: !!videoCount,
      action: "Adicionar vídeo",
      run: accountCount ? onLibrary : undefined,
    },
    {
      title: instagramOnboardingSteps[2],
      done: !!data && (data.queued > 0 || data.allPublished > 0),
      action: "Agendar Reel",
      run: accountCount && videoCount ? onSchedule : undefined,
    },
    {
      title: instagramOnboardingSteps[3],
      done: !!data?.allPublished,
      action: "Ver fila",
      run: accountCount && data?.queued ? onQueue : undefined,
    },
  ];
  const metrics = [
    {
      label: "Publicações no ar",
      value: data?.allPublished,
      note: periodData ? periodData.published + " no período" : "Total publicado pela plataforma",
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
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  const timeFormat = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-4">
      {(ownApp ? !data?.allPublished : accountCount === 0) && <InstagramFirstSteps steps={steps} />}
      {ownApp && !accountCount ? null : (
        <>
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
                  <Icon className="mb-2 size-4 text-brand-red" aria-hidden />
                  <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
                  <p className="mt-1 font-display text-2xl font-semibold">{value ?? "—"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{note}</p>
                </article>
              ))}
            </div>
          </section>

          {accounts.length > 0 && (
            <section className="space-y-3" aria-labelledby="dashboard-instagram-accounts">
              <h2 id="dashboard-instagram-accounts" className="font-semibold">
                Contas conectadas
              </h2>
              <InstagramAccountCards
                accounts={accounts}
                videoCounts={videoCounts}
                onSelect={onOpenAccount}
              />
            </section>
          )}

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
                  <CalendarDays className="size-4 text-brand-red" /> Próximas publicações
                </h2>
                <button
                  type="button"
                  onClick={onQueue}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-brand-red"
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
              <ul className="mt-3 space-y-2">
                {data?.upcoming.map((post) => {
                  const planned = post.scheduled_at ? new Date(post.scheduled_at) : undefined;
                  const isLate = planned && planned.getTime() < Date.now();
                  const status =
                    post.status === "processing"
                      ? "Em processamento"
                      : isLate
                        ? "Em atraso"
                        : "Agendado";
                  const kind = post.content_type === "story" ? "Story" : "Reel";
                  return (
                    <li
                      key={post.id}
                      className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-lg border border-border bg-background/40 p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                    >
                      <div className="min-w-20 rounded-lg bg-secondary/60 px-2 py-1.5 text-center">
                        <p className="text-sm font-semibold tabular-nums">
                          {planned ? timeFormat.format(planned) : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {planned ? dateFormat.format(planned) : "Sem data"}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {post.instagram_accounts?.username
                            ? "@" + post.instagram_accounts.username
                            : "Conta indisponível"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {kind}
                          {post.media_assets?.original_filename
                            ? " · " + post.media_assets.original_filename
                            : ""}
                        </p>
                      </div>
                      <span className="col-start-2 justify-self-start rounded-md border border-border px-2 py-1 text-xs font-medium sm:col-start-auto">
                        {status}
                      </span>
                    </li>
                  );
                })}
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
                className="mt-3 text-sm font-semibold text-brand-red"
              >
                Abrir histórico
              </button>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
