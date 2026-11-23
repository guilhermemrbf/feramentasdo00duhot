import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  CircleCheck,
  Landmark,
  Megaphone,
  Percent,
  RotateCcw,
  Trophy,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import type { DashboardMetric } from "@/components/DashboardMetrics";
import { SalesPageHeader } from "@/components/sales/SalesLayout";
import { SalesGoal } from "@/components/sales/SalesGoal";
import { useSalesOverview } from "@/components/sales/SalesSummary";
import { SALES_PERIODS, SALES_PROVIDERS, salesMoney, type SalesPeriod } from "@/lib/sales-events";
import type { SalesOverview } from "@/lib/api/sales.functions";
import { cn } from "@/lib/utils";
import "./scalehot.css";

const dayLabel = (day: string) => day.slice(8, 10) + "/" + day.slice(5, 7);
const date = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
const chartAxis = (cents: number) =>
  "R$ " + (cents / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const tooltip = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
};
const green = "#41cf9a";
const blue = "#5b9aea";

export function SalesDashboard({
  embedded = false,
  children,
  renderOverview,
}: {
  embedded?: boolean;
  children?: ReactNode;
  renderOverview?: (period: SalesPeriod, metrics: DashboardMetric[]) => ReactNode;
}) {
  const { user } = usePlatformAccess();
  const [period, setPeriod] = useState<SalesPeriod>("month");
  const query = useSalesOverview(30, null, period);
  const fullName = user?.user_metadata.full_name;
  const name = typeof fullName === "string" ? fullName.trim().split(/\s+/)[0] : "";
  const data = query.data;

  return (
    <div className={embedded ? "mousehot-finance" : undefined}>
      {embedded ? (
        renderOverview?.(period, salesMetricCards(data))
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-0">
          <SalesPageHeader
            title={name ? "Olá, " + name : "Dashboard"}
            subtitle="Gerencie suas vendas e acompanhe o faturamento em tempo real."
          />
          <Link to="/vendas/rastreamento" className="sales-button sales-button-outline mb-6">
            <Megaphone size={17} aria-hidden="true" />
            Rastreamento de vendas
          </Link>
        </div>
      )}
      {query.isPending && (
        <p
          className={embedded ? "sr-only" : "sales-panel p-6 text-sm text-muted-foreground"}
          role="status"
        >
          Carregando vendas…
        </p>
      )}
      {query.isError && (
        <div
          className={cn(
            "sales-panel flex flex-wrap items-center justify-between gap-3 p-5",
            embedded && "mt-4",
          )}
          role="alert"
        >
          Não foi possível carregar as vendas.
          <button
            className="sales-button sales-button-outline"
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {embedded && <WeeklySales />}
      {data && (
        <>
          {!embedded && <DashboardCards data={data} />}
          <SalesCharts data={data} period={period} embedded={embedded} />
        </>
      )}
      <LiveSales events={data?.recent} embedded={embedded} failed={query.isError} />
      {children}
      {data && <SalesGoal current={data.month_gross_cents} target={data.goal_cents} />}
      <section
        id="periodo-vendas"
        className="mt-6 scroll-mt-24"
        aria-labelledby={embedded ? "periodo-vendas-titulo" : undefined}
      >
        {embedded && (
          <div className="mb-3">
            <h2 id="periodo-vendas-titulo" className="font-display text-lg font-bold">
              Período do Dashboard
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Filtra as vendas e o desempenho do Automatic Post. A fila mostra o que está pendente
              agora.
            </p>
          </div>
        )}
        <div
          className="flex flex-wrap gap-1 rounded-xl bg-muted p-1.5"
          role="group"
          aria-label="Período das vendas"
        >
          {SALES_PERIODS.map(({ key, label }) => (
            <button
              type="button"
              key={key}
              aria-pressed={period === key}
              onClick={() => setPeriod(key)}
              className="sales-period-button min-h-11 min-w-21 flex-1 rounded-lg px-3 text-xs font-bold tracking-wider text-muted-foreground uppercase hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground sm:text-sm"
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function salesMetricCards(data?: SalesOverview): DashboardMetric[] {
  const approved = data?.approved ?? 0;
  const net = data && data.with_net === approved ? data.reported_net_cents : null;
  const fees = data && net !== null ? data.gross_cents - net : null;
  const received = Boolean(
    approved || data?.reversed || data?.links.some(({ last_event_at }) => last_event_at),
  );
  const empty = received && approved === 0;
  const waiting = data?.links.some(({ active }) => active)
    ? "Aguardando eventos do gateway"
    : "Sem dados de vendas";
  return [
    {
      label: "Faturamento Líquido",
      value: net !== null ? salesMoney(net) : empty ? salesMoney(0) : "—",
      hint: net !== null ? "Informado pelos gateways" : empty ? "Sem vendas no período" : waiting,
      icon: Wallet,
      iconColor: "text-sky-300",
    },
    {
      label: "Lucro",
      value: "—",
      hint: "Depende dos custos da operação",
      icon: Trophy,
      iconColor: "text-success",
      valueColor: "text-success",
    },
    {
      label: "Total de Taxas",
      value: fees !== null && fees >= 0 ? salesMoney(fees) : empty ? salesMoney(0) : "—",
      hint:
        fees !== null && fees >= 0
          ? "Diferença entre bruto e líquido"
          : empty
            ? "Sem vendas no período"
            : waiting,
      icon: Percent,
      iconColor: "text-amber-300",
    },
    {
      label: "Vendas Reembolsadas",
      value: received && data ? String(data.reversed) : "—",
      hint: received ? "Total no período" : waiting,
      icon: RotateCcw,
      iconColor: "text-rose-300",
    },
  ];
}

function DashboardCards({ data }: { data: SalesOverview }) {
  const [net, profit, fees, refunds] = salesMetricCards(data);
  const unavailable = "Sem dados na MouseHot";
  const cards: DashboardMetric[] = [
    net,
    profit,
    { label: "ROI", value: "—", hint: unavailable, icon: Activity, iconColor: "text-emerald-400" },
    {
      label: "Gastos c/ Anúncios",
      value: "—",
      hint: unavailable,
      icon: Megaphone,
      iconColor: "text-rose-400",
    },
    fees,
    {
      label: "Impostos",
      value: "—",
      hint: unavailable,
      icon: Landmark,
      iconColor: "text-cyan-300",
    },
    refunds,
  ];
  return (
    <section
      aria-label="Indicadores de vendas"
      className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {cards.map(({ label, value, hint, icon: Icon, iconColor, valueColor }) => (
        <div
          key={label}
          className="sales-panel flex min-h-29 items-start justify-between gap-3 p-5"
        >
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              {label}
            </p>
            <p
              className={cn(
                "font-display text-xl font-bold tracking-tight break-words tabular-nums sm:text-2xl",
                valueColor,
              )}
            >
              {value}
            </p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl bg-muted",
              iconColor,
            )}
          >
            <Icon className="size-5" aria-hidden />
          </div>
        </div>
      ))}
    </section>
  );
}

function SalesCharts({
  data,
  period,
  embedded,
}: {
  data: SalesOverview;
  period: SalesPeriod;
  embedded: boolean;
}) {
  const color = embedded ? "var(--brand-red)" : green;
  return (
    <div className={cn("grid min-w-0 gap-4", embedded ? "mt-4" : "lg:grid-cols-2")}>
      <section className="sales-panel min-w-0 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className={cn("font-display font-semibold", embedded && "text-lg")}>
              Evolução Diária do Faturamento
            </h2>
            {embedded && (
              <p className="mt-1 text-sm text-muted-foreground">
                Faturamento bruto diário após estornos.
              </p>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {SALES_PERIODS.find((item) => item.key === period)?.label}
          </span>
        </div>
        <div
          className={cn(
            "min-w-0 overflow-hidden",
            !data.series.length ? "h-32" : embedded ? "h-64 sm:h-80" : "h-52 sm:h-72",
          )}
        >
          {data.series.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.series}
                margin={{ left: 4, top: 10, right: 10 }}
                accessibilityLayer
              >
                <defs>
                  <linearGradient id="scalehot-daily" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={embedded ? 0.28 : 0.5} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="day"
                  tickFormatter={dayLabel}
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                />
                <YAxis
                  tickFormatter={chartAxis}
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  width={65}
                />
                <Tooltip
                  contentStyle={tooltip}
                  labelFormatter={dayLabel}
                  formatter={(cents: number) => salesMoney(cents)}
                />
                <Area
                  type="monotone"
                  dataKey="cents"
                  name="Faturamento após estornos"
                  stroke={color}
                  strokeWidth={2}
                  fill="url(#scalehot-daily)"
                  dot={data.series.length === 1}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty />
          )}
        </div>
      </section>
      {!embedded && (
        <section className="sales-panel min-w-0 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display font-semibold">Comparativo Mensal</h2>
            <span className="text-xs text-muted-foreground">Bruto vs líquido informado</span>
          </div>
          <div className="h-52 min-w-0 overflow-hidden sm:h-72">
            {data.monthly.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.monthly}
                  margin={{ left: 4, top: 10, right: 10 }}
                  accessibilityLayer
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(month) => month.slice(5, 7) + "/" + month.slice(2, 4)}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                  />
                  <YAxis
                    tickFormatter={chartAxis}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    width={65}
                  />
                  <Tooltip
                    contentStyle={tooltip}
                    formatter={(cents: number) => salesMoney(cents)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="gross"
                    name="Bruto após estornos"
                    fill={blue}
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="net"
                    name="Líquido informado"
                    fill={green}
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function ChartEmpty() {
  return (
    <p className="grid h-full place-items-center text-sm text-muted-foreground">
      Sem registros ainda.
    </p>
  );
}

function WeeklySales() {
  const query = useSalesOverview(7, null);
  const week = query.data;
  return (
    <section className="sales-panel mt-4 p-5" aria-labelledby="weekly-sales-title">
      <h2 id="weekly-sales-title" className="font-display text-lg font-bold">
        Resumo da semana
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">�ltimos 7 dias, incluindo hoje.</p>
      {week ? (
        <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            ["Vendas aprovadas", week.approved],
            ["Faturamento bruto", salesMoney(week.gross_cents)],
            ["Valor estornado", salesMoney(week.reversed_cents)],
            ["Bruto ap�s estornos", salesMoney(week.gross_cents - week.reversed_cents)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      ) : query.isError ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span>Dados da semana indispon�veis.</span>
          <button
            className="sales-button sales-button-outline"
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <p role="status" className="mt-4">
          Carregando a semana�
        </p>
      )}
    </section>
  );
}

function LiveSales({
  events,
  embedded,
  failed,
}: {
  events?: SalesOverview["recent"];
  embedded: boolean;
  failed: boolean;
}) {
  return (
    <section className={cn("sales-panel p-5", embedded ? "mt-4" : "mt-8")}>
      <h2 className="flex items-center gap-2 font-display text-xl font-bold">
        <Activity className="size-5 text-primary" aria-hidden />{" "}
        {embedded ? "Últimas transações" : "Últimas Transmissões"}
      </h2>
      <p className="mt-1 mb-4 text-xs text-muted-foreground">
        Vendas e reembolsos recebidos no período.
      </p>
      {!events ? (
        <p className="py-6 text-sm text-muted-foreground" role="status">
          {failed
            ? "Hist�rico indispon�vel. Tente carregar as vendas novamente."
            : "Carregando �ltimas vendas� "}
        </p>
      ) : events.length === 0 ? (
        <p className="grid min-h-28 place-items-center text-sm text-muted-foreground">
          Nenhuma transação recebida neste período.
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((event) => {
            const approved = event.kind === "approved";
            const Icon = approved ? CircleCheck : RotateCcw;
            return (
              <li
                key={event.id}
                className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {SALES_PROVIDERS[event.provider]} · {approved ? "Venda aprovada" : "Estorno"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {event.external_id} · {date.format(new Date(event.occurred_at))}
                    </p>
                  </div>
                </div>
                <p
                  className={cn(
                    "shrink-0 text-sm font-bold tabular-nums",
                    approved ? "text-success" : "text-destructive",
                  )}
                >
                  {approved ? "" : "− "}
                  {salesMoney(event.amount_cents)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
