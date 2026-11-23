import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CalendarDays, Check, Clock3, Eye, Instagram, Trophy } from "lucide-react";
import { DashboardMetrics, type DashboardMetric } from "@/components/DashboardMetrics";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import {
  readPostkitDashboardWorkspace,
  readPostkitPerformance,
  readPostkitQueue,
  type UpcomingPostkitPublication,
} from "@/lib/postkit-dashboard-data";
import { postkitOverviewPeriod } from "@/lib/postkit-overview-period";
import type { SalesPeriod } from "@/lib/sales-events";

const numbers = new Intl.NumberFormat("pt-BR");
const displayNumber = (value: number | null | undefined) =>
  value == null ? "—" : numbers.format(value);

export function AutomaticPostOverview({
  period,
  salesMetrics,
}: {
  period: SalesPeriod;
  salesMetrics: DashboardMetric[];
}) {
  const { user } = usePlatformAccess();
  const workspaceQuery = useQuery({
    queryKey: ["mousehot-postkit-workspace", user?.id],
    queryFn: readPostkitDashboardWorkspace,
    enabled: Boolean(user),
  });
  const workspace = workspaceQuery.data;
  const queued = useQuery({
    queryKey: ["mousehot-postkit-queue", user?.id, workspace?.id],
    queryFn: () => (workspace ? readPostkitQueue(workspace.id) : null),
    enabled: Boolean(workspace),
    refetchInterval: 30_000,
  });
  const performance = useQuery({
    queryKey: [
      "mousehot-postkit-performance",
      user?.id,
      workspace?.id,
      workspace?.timezone,
      period,
    ],
    queryFn: () =>
      workspace
        ? readPostkitPerformance(workspace.id, postkitOverviewPeriod(workspace.timezone, period))
        : null,
    enabled: Boolean(workspace),
    refetchInterval: 30_000,
  });
  const data = performance.data;
  const queue = queued.data;
  const noWorkspace = workspaceQuery.isSuccess && !workspace;
  const waiting = workspaceQuery.isPending || (Boolean(workspace) && performance.isPending);
  const retry = () => {
    void workspaceQuery.refetch();
    if (workspace) {
      void performance.refetch();
      void queued.refetch();
    }
  };
  const metrics = [
    {
      label: "Visualizações de Reels",
      value: displayNumber(data?.views),
      hint:
        data?.views == null
          ? waiting
            ? "Carregando métricas…"
            : performance.isError || workspaceQuery.isError
              ? "Coleta indisponível"
              : "Sem visualizações coletadas no período"
          : `${displayNumber(data.measured)} de ${displayNumber(data.reels)} Reels com dados`,
      title: "Visualizações acumuladas até a última coleta dos Reels publicados no período.",
      icon: Eye,
    },
    {
      label: "Reels publicados",
      value: displayNumber(noWorkspace ? 0 : data?.published),
      hint: "Publicados pelo Automatic Post",
      icon: Check,
    },
    {
      label: period === "today" ? "Contas ativas hoje" : "Contas ativas",
      value: displayNumber(noWorkspace ? 0 : data?.active),
      hint:
        data?.connected == null && !noWorkspace
          ? "Contas com publicações no período"
          : `De ${displayNumber(noWorkspace ? 0 : data?.connected)} conectadas`,
      title: "Contas atualmente conectadas que publicaram pelo Automatic Post no período.",
      icon: Instagram,
    },
    {
      label: "Posts na fila",
      value: displayNumber(noWorkspace ? 0 : queue?.queued),
      hint: "Fila atual · agendados ou em processamento",
      icon: Clock3,
    },
  ];

  return (
    <section className="space-y-4" aria-labelledby="overview-postkit">
      <header>
        <h2
          id="overview-postkit"
          className="font-display text-xl font-bold tracking-tight sm:text-2xl"
        >
          Indicadores da operação
        </h2>
        {workspace && <p className="mt-1 text-sm text-muted-foreground">{workspace.name}</p>}
      </header>
      <DashboardMetrics metrics={[...salesMetrics, ...metrics]} />
      {waiting && (
        <p className="sr-only" role="status">
          Atualizando métricas do Automatic Post…
        </p>
      )}
      {(workspaceQuery.isError ||
        performance.isError ||
        queued.isError ||
        queue?.scheduleUnavailable) && (
        <p
          role="status"
          className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground"
        >
          Não foi possível atualizar todos os dados.{" "}
          <button
            type="button"
            onClick={retry}
            className="min-h-10 font-semibold text-brand-red underline underline-offset-4"
          >
            Tentar novamente
          </button>
        </p>
      )}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section
          className="min-w-0 rounded-xl border border-border bg-card"
          aria-labelledby="overview-postkit-queue"
        >
          <header className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 border-b border-border px-4">
            <h3
              id="overview-postkit-queue"
              className="flex items-center gap-2 text-sm font-bold sm:text-base"
            >
              <CalendarDays className="size-4 text-brand-red" aria-hidden /> Próximas publicações
            </h3>
            <Link
              to="/automacao-instagram"
              search={{ tab: "publicacoes" }}
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-red hover:underline"
            >
              Ver fila <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </header>
          {queue?.upcoming.length ? (
            <UpcomingRows
              entries={queue.upcoming}
              timezone={workspace?.timezone ?? "America/Sao_Paulo"}
              accounts={data?.accountNames}
            />
          ) : (
            <div className="grid min-h-36 content-center justify-items-center px-4 py-6 text-center text-sm text-muted-foreground">
              {workspaceQuery.isPending || (workspace && queued.isPending)
                ? "Carregando a fila…"
                : workspaceQuery.isError || queued.isError || queue?.scheduleUnavailable
                  ? "A fila está indisponível agora."
                  : "Nenhuma publicação pendente na fila."}
              {(noWorkspace || (queue && !queue.scheduleUnavailable)) && (
                <Link
                  to="/automacao-instagram"
                  search={{ tab: noWorkspace ? "contas" : "fila" }}
                  className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold text-foreground hover:bg-muted"
                >
                  {noWorkspace ? "Abrir Automatic Post" : "Nova publicação"}
                </Link>
              )}
            </div>
          )}
          {queue && (queue.reminderCount ?? 0) > 0 && (
            <Link
              to="/automacao-instagram"
              search={{ tab: "stories" }}
              className="flex min-h-11 items-center border-t border-border px-4 text-xs font-semibold text-brand-red hover:underline"
            >
              Ver lembretes de Stories
            </Link>
          )}
        </section>
        <section
          className="min-w-0 rounded-xl border border-border bg-card"
          aria-labelledby="overview-postkit-rank"
        >
          <header className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 border-b border-border px-4">
            <h3
              id="overview-postkit-rank"
              className="flex items-center gap-2 text-sm font-bold sm:text-base"
            >
              <Trophy className="size-4 text-brand-red" aria-hidden /> Top contas
            </h3>
            <Link
              to="/automacao-instagram"
              search={{ tab: "analytics" }}
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-red hover:underline"
            >
              Ver métricas <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </header>
          {data?.ranking.length ? (
            <>
              <p className="px-4 pt-3 text-xs text-muted-foreground">
                Visualizações acumuladas dos Reels publicados no período
              </p>
              <ol className="max-h-72 divide-y divide-border overflow-y-auto px-4">
                {data.ranking.map(({ id, username, views }, index) => (
                  <li
                    key={id}
                    className="grid min-h-11 grid-cols-[2ch_minmax(0,1fr)_auto] items-center gap-2 py-2 text-sm"
                  >
                    <span className="text-xs text-muted-foreground">{index + 1}</span>
                    <span className="truncate font-semibold" title={"@" + username}>
                      @{username}
                    </span>
                    <span className="font-semibold tabular-nums">{displayNumber(views)}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="grid min-h-36 place-items-center px-4 py-6 text-center text-sm text-muted-foreground">
              {waiting
                ? "Carregando métricas…"
                : workspaceQuery.isError || performance.isError
                  ? "Métricas indisponíveis agora."
                  : "Nenhuma conta com visualizações coletadas no período."}
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

function UpcomingRows({
  entries,
  timezone,
  accounts,
}: {
  entries: UpcomingPostkitPublication[];
  timezone: string;
  accounts?: Record<string, string>;
}) {
  const when = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <ul className="divide-y divide-border">
      {entries.map((entry) => {
        const account =
          entry.username ?? (entry.accountId ? accounts?.[entry.accountId] : undefined);
        const late = entry.scheduledAt && Date.parse(entry.scheduledAt) < Date.now();
        const state = entry.isReminder
          ? late
            ? "Lembrete em atraso"
            : "Lembrete"
          : entry.processing
            ? "Em processamento"
            : late
              ? "Em atraso"
              : "Agendado";
        return (
          <li
            key={entry.key}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-3 text-sm"
          >
            <p className="truncate font-medium" title={account ? "@" + account : entry.filename}>
              {account ? "@" + account : entry.filename || entry.kind}
            </p>
            <span className="text-right text-xs text-muted-foreground">{state}</span>
            <p className="col-span-2 truncate text-xs text-muted-foreground">
              {entry.kind}
              {entry.scheduledAt ? " · " + when.format(new Date(entry.scheduledAt)) : ""}
              {account && entry.filename ? " · " + entry.filename : ""}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
