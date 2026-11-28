import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  Instagram,
  Video,
  Activity,
  Trophy,
} from "lucide-react";
import { InstagramAccountCards } from "./InstagramAccountCards";
import type { InstagramAnalyticsReport } from "./InstagramAnalytics";
import { getInstagramWorkspaceApp } from "@/lib/api/instagram-workspace-app.functions";
import type { InstagramConnectionDetailsAccount } from "./InstagramConnectionDetails";
import { supabase } from "@/integrations/supabase/client";
import { calendarDateInZone, zonedDateTimeToIso } from "@/lib/scheduling";
import type { PostkitDatabase } from "@/lib/postkit-database";
import { readPostkitQueue } from "@/lib/postkit-dashboard-data";

const database = supabase as unknown as SupabaseClient<PostkitDatabase>;

type WorkspaceAppStatus = Awaited<ReturnType<typeof getInstagramWorkspaceApp>>;
const instagramOnboardingSteps = [
  "Conecte uma conta profissional do Instagram",
  "Adicione seu primeiro vídeo",
  "Agende uma publicação",
  "Confira a primeira publicação no ar",
] as const;

function InstagramFirstSteps({
  steps,
  onHide,
}: {
  steps: Array<{
    title: string;
    done: boolean;
    description?: string;
    action?: string;
    run?: () => void;
    onGuide?: () => void;
  }>;
  onHide: () => void;
}) {
  const completed = steps.filter((step) => step.done).length;

  return (
    <section
      aria-labelledby="instagram-first-steps"
      className="rounded-2xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="instagram-first-steps" className="font-display text-lg font-semibold">
            Primeiros passos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Conecte sua conta, publique o primeiro conteúdo e acompanhe a operação no Mousefy.
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
          <button
            type="button"
            onClick={onHide}
            className="min-h-10 rounded-md px-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Ocultar primeiros passos
          </button>
        </div>
      </div>
      <ol className="mt-3 divide-y divide-border">
        {steps.map(({ title, done, description, action, run, onGuide }, index) => (
          <li
            key={title}
            className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
          >
            <span
              className={
                done
                  ? "grid size-7 place-items-center rounded-full bg-emerald-500/10 text-emerald-300"
                  : "grid size-7 place-items-center rounded-full border border-border text-xs text-muted-foreground"
              }
            >
              {done ? <Check className="size-4" role="img" aria-label="Concluído" /> : index + 1}
            </span>
            <div>
              <p className="text-sm font-medium">{title}</p>
              {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
            </div>
            {((!done && action) || onGuide) && (
              <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-auto sm:justify-end">
                {onGuide && (
                  <button
                    type="button"
                    onClick={onGuide}
                    className="min-h-10 rounded-md px-2 text-sm font-medium text-brand-red hover:bg-primary/10"
                  >
                    Ver guia
                  </button>
                )}
                {!done && action && (
                  <button
                    type="button"
                    onClick={run}
                    disabled={!run}
                    className="min-h-10 rounded-lg border border-primary/40 bg-primary/10 px-3 text-sm font-semibold text-brand-red hover:bg-primary/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-muted-foreground"
                  >
                    {action}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
const numbers = new Intl.NumberFormat("pt-BR");
const showNumber = (value: number | null | undefined) =>
  value == null ? "—" : numbers.format(value);

const periods = [
  { id: "today", label: "Hoje", days: 0 },
  { id: "yesterday", label: "Ontem", days: 1 },
  { id: "week", label: "7 dias", days: 6 },
  { id: "month", label: "30 dias", days: 29 },
] as const;
type Period = (typeof periods)[number] | { id: "custom"; start: string; end: string };

function periodBounds(timezone: string, period: Period) {
  if (period.id === "custom") {
    const tomorrow = new Date(period.end + "T00:00:00Z");
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return {
      start: zonedDateTimeToIso(period.start, "00:00", timezone),
      end: zonedDateTimeToIso(tomorrow.toISOString().slice(0, 10), "00:00", timezone),
    };
  }
  const now = new Date();
  const boundary = (offset: number) =>
    zonedDateTimeToIso(calendarDateInZone(timezone, offset, now), "00:00", timezone);
  return { start: boundary(-period.days), end: boundary(period.id === "yesterday" ? 0 : 1) };
}

export function InstagramDashboard({
  workspaceId,
  timezone,
  accounts,
  videoCounts,
  onOpenAccount,
  refreshKey,
  onAccounts,
  onLibrary,
  onSchedule,
  onQueue,
  onStories,
  onHistory,
  onAnalytics,
  appMode,
  platformAppConfigured,
  onAppSetup,
  visiting = false,
}: {
  workspaceId: string;
  timezone: string;
  accounts: InstagramConnectionDetailsAccount[];
  videoCounts?: ReadonlyMap<string, number>;
  onOpenAccount?: (id: string) => void;
  refreshKey: number;
  onAccounts?: () => void;
  onLibrary?: () => void;
  onSchedule?: () => void;
  onQueue?: () => void;
  onStories?: () => void;
  onHistory?: () => void;
  onAnalytics?: () => void;
  appMode: WorkspaceAppStatus["mode"];
  platformAppConfigured?: boolean;
  onAppSetup?: (guideStep?: number) => void;
  visiting?: boolean;
}) {
  const [period, setPeriod] = useState<Period>(periods[0]);
  const [choosingDates, setChoosingDates] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const preferenceKey = "mousehot.instagram.first-steps:" + workspaceId;
  const periodKey = period.id === "custom" ? period.start + "/" + period.end : period.id;
  const today = calendarDateInZone(timezone);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(preferenceKey) === "hidden");
    } catch {
      setDismissed(false);
    }
  }, [preferenceKey]);

  const toggleFirstSteps = () => {
    const next = !dismissed;
    setDismissed(next);
    try {
      window.localStorage.setItem(preferenceKey, next ? "hidden" : "shown");
    } catch {
      // This preference still applies until the page closes.
    }
  };

  const report = useQuery({
    enabled: !visiting,
    queryKey: ["mousehot-instagram-dashboard", workspaceId, timezone, periodKey, refreshKey],
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    retry: false,
    queryFn: async () => {
      const { start, end } = periodBounds(timezone, period);
      const posts = () => supabase.from("posts");
      const publishedInPeriod = () =>
        posts()
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("status", "published")
          .gte("published_at", start)
          .lt("published_at", end);
      const [
        schedule,
        published,
        allPublished,
        reelsPublished,
        attention,
        accountInventory,
        reelInventory,
        analytics,
      ] = await Promise.all([
        readPostkitQueue(workspaceId),
        publishedInPeriod(),
        posts()
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("status", "published"),
        publishedInPeriod().eq("content_type", "reel"),
        posts()
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .in("status", ["failed", "needs_review"])
          .gte("updated_at", start)
          .lt("updated_at", end),
        database
          .from("instagram_accounts")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("connection_status", "connected"),
        database
          .from("media_assets")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .is("archived_at", null)
          .in("mime_type", ["video/mp4", "video/quicktime"])
          .in("status", ["uploaded", "ready"]),
        database.rpc("get_instagram_analytics", {
          p_workspace: workspaceId,
          p_account: null,
          p_start: start,
          p_end: end,
          p_page: 0,
        }),
      ]);
      const incomplete =
        [
          published,
          allPublished,
          reelsPublished,
          attention,
          accountInventory,
          reelInventory,
          analytics,
        ].some(({ error }) => Boolean(error)) || schedule.scheduleUnavailable;
      return {
        period: periodKey,
        ...schedule,
        published: published.count,
        allPublished: allPublished.count,
        reelsPublished: reelsPublished.count,
        needsAttention: attention.count,
        accountCount: accountInventory.count,
        videoCount: reelInventory.count,
        analytics: analytics.data
          ? (analytics.data as unknown as InstagramAnalyticsReport)
          : undefined,
        analyticsUnavailable: Boolean(analytics.error),
        incomplete,
      };
    },
  });
  const data = report.data;
  const periodData = data?.period === periodKey ? data : undefined;
  const error = report.isError || Boolean(periodData?.incomplete);
  const { accountCount, videoCount } = data ?? (visiting ? { accountCount: 0, videoCount: 0 } : {});

  const steps = [
    ...(appMode === "missing" || appMode === "own"
      ? [
          {
            title: "Cadastre seu aplicativo da Meta",
            done: appMode === "own",
            description: "Siga o tutorial com capturas para vincular o app da sua operação.",
            action: visiting ? "Ver passo a passo" : "Cadastrar app Meta",
            run: onAppSetup,
            onGuide: appMode === "own" ? onAppSetup : undefined,
          },
        ]
      : []),
    {
      title: instagramOnboardingSteps[0],
      done: !!accountCount,
      description:
        accountCount === 0
          ? "Siga o passo a passo para escolher o perfil e confirmar a conexão."
          : undefined,
      action: "Conectar Instagram",
      run: appMode === "missing" && !visiting ? undefined : onAccounts,
    },
    {
      title: instagramOnboardingSteps[1],
      done: !!videoCount,
      description: videoCount === 0 ? "Envie seus Reels para a biblioteca do Mousefy." : undefined,
      action: "Adicionar vídeo",
      run: accountCount ? onLibrary : undefined,
    },
    {
      title: instagramOnboardingSteps[2],
      done: (data?.queued ?? 0) > 0 || (data?.allPublished ?? 0) > 0,
      description:
        (data?.queued ?? 0) === 0 && (data?.allPublished ?? 0) === 0
          ? "Escolha os vídeos e defina quando o Mousefy deve publicar."
          : undefined,
      action: "Agendar Reel",
      run: accountCount && videoCount ? onSchedule : undefined,
    },
    {
      title: instagramOnboardingSteps[3],
      done: !!data?.allPublished,
      description:
        !data?.allPublished
          ? "Acompanhe o resultado da publicação pela fila e pelo histórico."
          : undefined,
      action: "Ver fila",
      run: onQueue,
    },
  ];
  const reelMetrics = periodData?.analytics?.totals.find(({ kind }) => kind === "reel");
  const rankedAccounts = (periodData?.analytics?.profiles ?? [])
    .flatMap(({ id, username, reel_views, measured, reels }) =>
      reel_views == null || !accounts.some((account) => account.id === id)
        ? []
        : [{ id, username, views: reel_views, measured, reels }],
    )
    .sort((a, b) => b.views - a.views || a.username.localeCompare(b.username, "pt-BR"))
    .slice(0, 4);
  const metrics = [
    {
      label: "Visualizações de Reels",
      value: reelMetrics?.views,
      note:
        reelMetrics?.views != null
          ? `${reelMetrics.measured} de ${reelMetrics.publications} Reels publicados no período com dados`
          : periodData?.analyticsUnavailable
            ? "Falha ao ler as métricas"
            : "Sem visualizações coletadas para este período",
      icon: Eye,
      tone: "coral",
    },
    {
      label: "Publicações no período",
      value: periodData?.published,
      note:
        data?.allPublished != null
          ? `${showNumber(data.allPublished)} publicadas pelo Mousefy no total`
          : "Publicações pelo Mousefy",
      detail: `${showNumber(periodData?.reelsPublished)} Reels publicados no período`,
      icon: CheckCircle2,
      tone: "success",
    },
    {
      label: "Contas conectadas",
      value: accountCount,
      note: "Disponíveis para publicar",
      icon: Instagram,
      tone: "violet",
    },
    {
      label: "Publicações na fila",
      value: data?.queued,
      note: "Agendadas ou em processamento",
      icon: Clock3,
      tone: "info",
    },
    {
      label: "Vídeos na biblioteca",
      value: videoCount,
      note: "Vídeos de Reels disponíveis",
      icon: Video,
      tone: "coral",
    },
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
      {appMode === "legacy" && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <Instagram className="size-4 shrink-0 text-brand-red" aria-hidden />
          {platformAppConfigured
            ? "Conexão Instagram usando a integração oficial do Mousefy."
            : "A configuração da conexão do Instagram está incompleta no servidor."}
        </div>
      )}
      {(appMode === "missing" || accountCount === 0 || (data && !steps.every(({ done }) => done))) &&
        (dismissed ? (
          <button
            type="button"
            onClick={toggleFirstSteps}
            className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-secondary"
          >
            Mostrar primeiros passos
          </button>
        ) : (
          <InstagramFirstSteps steps={steps} onHide={toggleFirstSteps} />
        ))}
      <section aria-labelledby="instagram-overview-summary" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="instagram-overview-summary" className="font-display text-lg font-semibold">
              Resumo da operação
            </h2>
            {data && !error && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Activity className="size-3.5 text-emerald-400" aria-hidden /> Atualiza a cada 30 s
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Período do resumo">
            {periods.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={period.id === item.id}
                onClick={() => {
                  setChoosingDates(false);
                  if (period.id !== item.id) {
                    setPeriod(item);
                  }
                }}
                className="filter-chip"
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              aria-expanded={choosingDates}
              aria-controls="instagram-custom-period"
              aria-pressed={period.id === "custom"}
              onClick={() => setChoosingDates((value) => !value)}
              className="filter-chip"
            >
              Personalizado
            </button>
          </div>
        </div>
        {choosingDates && (
          <form
            id="instagram-custom-period"
            className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3"
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              const start = String(values.get("start"));
              const end = String(values.get("end"));
              if (start > end) {
                const input = event.currentTarget.elements.namedItem("end") as HTMLInputElement;
                input.setCustomValidity("Informe uma data final igual ou posterior à inicial.");
                input.reportValidity();
                return;
              }
              setPeriod({ id: "custom", start, end });
              setChoosingDates(false);
            }}
            onInput={(event) => {
              const input = event.currentTarget.elements.namedItem("end") as HTMLInputElement;
              input.setCustomValidity("");
            }}
          >
            <label className="grid gap-1 text-sm">
              Data inicial
              <input
                type="date"
                name="start"
                required
                max={today}
                defaultValue={period.id === "custom" ? period.start : today}
                className="min-h-10 rounded-md border border-border bg-background px-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Data final
              <input
                type="date"
                name="end"
                required
                max={today}
                defaultValue={period.id === "custom" ? period.end : today}
                className="min-h-10 rounded-md border border-border bg-background px-2"
              />
            </label>
            <button
              type="submit"
              className="min-h-10 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
            >
              Aplicar período
            </button>
          </form>
        )}
        {period.id === "custom" && (
          <p className="text-xs text-muted-foreground">
            {period.start.split("-").reverse().join("/")} a{" "}
            {period.end.split("-").reverse().join("/")}
          </p>
        )}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3">
          {metrics.map(({ label, value, note, detail, icon: Icon, tone }) => (
            <article
              key={label}
              data-tone={tone}
              className="metric-card min-w-0 rounded-xl border border-border p-3 sm:p-4"
            >
              <div className="flex items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-background/70 text-brand-red">
                  <Icon className="size-4" aria-hidden />
                </span>
                <h3 className="text-xs font-semibold">{label}</h3>
              </div>
              <p className="mt-3 font-display text-2xl font-semibold tabular-nums">
                {showNumber(value)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</p>
              {detail && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
              )}
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
            onClick={() => void report.refetch()}
          >
            Tentar novamente
          </button>
        </p>
      )}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="dashboard-upcoming"
          className="min-w-0 rounded-xl border border-border bg-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 id="dashboard-upcoming" className="flex items-center gap-2 font-semibold">
              <CalendarDays className="size-4 text-brand-red" /> Próximas publicações
            </h2>
            {onQueue && (
              <button
                type="button"
                onClick={onQueue}
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-red"
              >
                Ver fila <ArrowRight className="size-3.5" />
              </button>
            )}
          </div>
          {!data && !error && (
            <p role="status" className="p-4 text-sm text-muted-foreground">
              Carregando a fila…
            </p>
          )}
          {data?.scheduleUnavailable && (
            <p role="status" className="px-4 py-3 text-sm text-muted-foreground">
              Não foi possível carregar toda a programação.
            </p>
          )}
          {data && (data.reminderCount ?? 0) > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
              <p>
                {showNumber(data.reminderCount)}{" "}
                {data.reminderCount === 1
                  ? "lembrete de Story pendente"
                  : "lembretes de Stories pendentes"}
              </p>
              {onStories && (
                <button
                  type="button"
                  onClick={onStories}
                  className="min-h-8 font-semibold text-brand-red"
                >
                  Ver lembretes
                </button>
              )}
            </div>
          )}
          {data?.upcoming.length === 0 && !data.scheduleUnavailable && (
            <div className="grid justify-items-center px-4 py-7 text-center">
              <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-brand-red">
                <CalendarDays className="size-5" aria-hidden />
              </span>
              <p className="mt-3 text-sm font-semibold">Nenhuma publicação na fila</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {onSchedule
                  ? "Agende um Reel para vê-lo aqui."
                  : "Conclua a configuração para agendar."}
              </p>
              {onSchedule && (
                <button
                  type="button"
                  onClick={onSchedule}
                  className="mt-3 min-h-10 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-secondary"
                >
                  Agendar Reel
                </button>
              )}
            </div>
          )}
          <ul className="divide-y divide-border">
            {data?.upcoming.map((post) => {
              const planned = post.scheduledAt ? new Date(post.scheduledAt) : undefined;
              const isLate = planned && planned.getTime() < Date.now();
              const status = post.isReminder
                ? isLate
                  ? "Lembrete em atraso"
                  : "Publicação manual"
                : post.processing
                  ? "Em processamento"
                  : isLate
                    ? "Em atraso"
                    : "Agendado";
              const username =
                post.username ?? accounts.find(({ id }) => id === post.accountId)?.username;
              return (
                <li
                  key={post.key}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
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
                      {username ? "@" + username : "Conta indisponível"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {post.kind}
                      {post.filename ? " · " + post.filename : ""}
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
        <section
          aria-labelledby="dashboard-top-accounts"
          className="min-w-0 rounded-xl border border-border bg-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 id="dashboard-top-accounts" className="flex items-center gap-2 font-semibold">
              <Trophy className="size-4 text-brand-red" aria-hidden /> Contas com mais views
            </h2>
            {onAnalytics && (
              <button
                type="button"
                onClick={onAnalytics}
                className="min-h-8 text-sm font-semibold text-brand-red"
              >
                Ver métricas
              </button>
            )}
          </div>
          {rankedAccounts.length > 0 ? (
            <>
              <p className="px-4 pt-3 text-xs text-muted-foreground">
                Visualizações de Reels no histórico coletado
              </p>
              <ol className="divide-y divide-border px-4">
                {rankedAccounts.map(({ id, username, views, measured, reels }, index) => (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => onOpenAccount?.(id)}
                      className="grid min-h-12 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 py-2 text-left hover:text-brand-red"
                    >
                      <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-xs font-semibold text-brand-red">
                        {index + 1}
                      </span>
                      <span className="truncate text-sm font-medium" title={`@${username}`}>
                        @{username}
                      </span>
                      <span className="text-right text-sm font-semibold tabular-nums">
                        {showNumber(views)}
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {measured}/{reels} Reels medidos
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="px-4 py-7 text-center text-sm text-muted-foreground">
              {!periodData
                ? "Carregando métricas…"
                : periodData.analyticsUnavailable
                  ? "As métricas estão indisponíveis agora."
                  : "Nenhuma conta com visualizações coletadas."}
            </p>
          )}
        </section>
      </div>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Precisa de atenção</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {periodData?.needsAttention != null
              ? periodData.needsAttention === 0
                ? "Nenhuma falha ou revisão no período selecionado."
                : `${periodData.needsAttention} ${periodData.needsAttention === 1 ? "publicação precisa" : "publicações precisam"} de atenção neste período.`
              : "Confira o histórico para acompanhar o resultado de cada publicação."}
          </p>
        </div>
        {onHistory && (
          <button
            type="button"
            onClick={onHistory}
            className="min-h-10 text-sm font-semibold text-brand-red"
          >
            Abrir histórico
          </button>
        )}
      </section>
      {onOpenAccount && accounts.length > 0 && (
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
    </div>
  );
}
