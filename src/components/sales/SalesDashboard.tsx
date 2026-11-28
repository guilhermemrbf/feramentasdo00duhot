import { MetaSalesSummary } from "./MetaSalesSummary";
import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  CircleCheck,
  Landmark,
  Megaphone,
  Percent,
  RotateCcw,
  ShieldAlert,
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
import { canExecuteTools } from "@/lib/platform-access";
import { readMouseHotSettings } from "@/lib/mousehot-settings";
import type { DashboardMetric } from "@/components/DashboardMetrics";
import { SalesPageHeader } from "@/components/sales/SalesLayout";
import { SalesGoal } from "@/components/sales/SalesGoal";
import { useSalesOverview } from "@/components/sales/SalesSummary";
import {
  SALES_PERIODS,
  SALES_PROVIDERS,
  salesDashboardAmounts,
  salesMoney,
  type SalesPeriod,
} from "@/lib/sales-events";
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
  const { user, status } = usePlatformAccess();
  const canExecute = canExecuteTools(status);
  const [chosenPeriod, setPeriod] = useState<SalesPeriod>();
  const period = chosenPeriod ?? readMouseHotSettings(user?.user_metadata).period ?? "month";
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
          <Link to="/vendas/conexoes" className="sales-button sales-button-outline mb-6">
            Integrações
          </Link>
        </div>
      )}
      {canExecute && query.isPending && (
        <p
          className={embedded ? "sr-only" : "sales-panel p-6 text-sm text-muted-foreground"}
          role="status"
        >
          Carregando vendas…
        </p>
      )}
      {canExecute && query.isError && (
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
      {!embedded && <DashboardCards data={data} />}
      {(data || !embedded) && (
        <SalesCharts data={data} period={period} embedded={embedded} failed={query.isError} />
      )}
      <LiveSales events={data?.recent} embedded={embedded} failed={query.isError} />
      {!embedded && <MetaSalesSummary period={period} />}
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
              className="sales-period-button min-h-11 min-w-21 flex-1 rounded-lg px-3 text-xs font-semibold text-muted-foreground hover:text-foreground aria-pressed:text-foreground sm:text-sm"
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
  const amounts = data ? salesDashboardAmounts(data) : null;
  const deductions = amounts?.deductions ?? null;
  const beforeCosts = amounts?.beforeCosts ?? null;
  return [
    {
      label: "Faturamento",
      value: data ? salesMoney(data.gross_cents) : "—",
      hint: "",
      icon: Wallet,
      iconColor: "text-sky-300",
    },
    {
      label: "Lucro",
      value: beforeCosts === null ? "—" : salesMoney(beforeCosts),
      hint: "",
      icon: Trophy,
      iconColor: "text-success",
      valueColor:
        beforeCosts === null ? undefined : beforeCosts < 0 ? "text-destructive" : "text-success",
    },
    {
      label: "Taxas e descontos",
      value: deductions === null ? "—" : salesMoney(deductions),
      hint: "",
      icon: Percent,
      iconColor: "text-amber-300",
    },
    {
      label: "Vendas Reembolsadas",
      value: data ? String(data.refund_or_dispute_count ?? data.reversed) : "—",
      hint: "",
      title: "Vendas com estorno, chargeback ou MED no período. Cada venda conta uma vez.",
      icon: RotateCcw,
      iconColor: "text-rose-300",
    },
  ];
}

function DashboardCards({ data }: { data?: SalesOverview }) {
  const [revenue, profit, fees, refunds] = salesMetricCards(data);
  const unavailable = "Sem dados no Mousefy";
  const cards: DashboardMetric[] = [
    revenue,
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
      {cards.map(({ label, value, hint, title, icon: Icon, iconColor, valueColor }) => (
        <div
          key={label}
          className="sales-panel flex min-h-29 items-start justify-between gap-3 p-5"
        >
          <div className="min-w-0 space-y-1">
            <p
              title={title}
              className="text-xs font-medium tracking-wider text-muted-foreground uppercase"
            >
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
  failed,
}: {
  failed: boolean;
  data?: SalesOverview;
  period: SalesPeriod;
  embedded: boolean;
}) {
  const color = "var(--primary-glow)";
  return (
    <div className={cn("grid min-w-0 gap-4", embedded ? "mt-4" : "lg:grid-cols-2")}>
      <section className="sales-panel min-w-0 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className={cn("font-display font-semibold", embedded && "text-lg")}>
              Evolução diária do faturamento
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
            !data?.series.length ? "h-32" : embedded ? "h-64 sm:h-80" : "h-52 sm:h-72",
          )}
        >
          {data?.series.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.series}
                margin={{ left: 4, top: 10, right: 10 }}
                accessibilityLayer
              >
                <defs>
                  <linearGradient id="scalehot-daily" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.24} />
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
                  dot={data?.series.length === 1}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty
              status={
                data
                  ? "Sem registros ainda."
                  : failed
                    ? "Dados indisponíveis."
                    : "Carregando vendas…"
              }
            />
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
            {data?.monthly.length ? (
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
              <ChartEmpty
                status={
                  data
                    ? "Sem registros ainda."
                    : failed
                      ? "Dados indisponíveis."
                      : "Carregando vendas…"
                }
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function ChartEmpty({ status }: { status: string }) {
  return <p className="grid h-full place-items-center text-sm text-muted-foreground">{status}</p>;
}

function WeeklySales() {
  const { status } = usePlatformAccess();
  const canExecute = canExecuteTools(status);
  const query = useSalesOverview(7, null);
  const week = query.data;
  return (
    <section className="sales-panel mt-4 p-5" aria-labelledby="weekly-sales-title">
      <h2 id="weekly-sales-title" className="font-display text-lg font-bold">
        Resumo da semana
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Últimos 7 dias, incluindo hoje.</p>
      {week ? (
        <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            ["Vendas aprovadas", week.approved],
            ["Faturamento bruto", salesMoney(week.gross_cents)],
            ["Valor estornado", salesMoney(week.reversed_cents)],
            ["Bruto após estornos", salesMoney(week.gross_cents - week.reversed_cents)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      ) : !canExecute ? (
        <p className="mt-4 text-sm text-muted-foreground">Ainda sem vendas nesta operação.</p>
      ) : query.isError ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span>Dados da semana indisponíveis.</span>
          <button
            className="sales-button sales-button-outline"
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <p role="status" className="mt-4">
          Carregando a semana…
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
        Vendas, estornos e contestações recebidos no período.
      </p>
      {!events ? (
        <p className="py-6 text-sm text-muted-foreground" role="status">
          {failed
            ? "Histórico indisponível. Tente carregar as vendas novamente."
            : "Carregando últimas vendas…"}
        </p>
      ) : events.length === 0 ? (
        <p className="grid min-h-28 place-items-center text-sm text-muted-foreground">
          Nenhuma transação recebida neste período.
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((event) => {
            const {
              icon: Icon,
              label,
              color,
              prefix,
            } = {
              approved: {
                icon: CircleCheck,
                label: "Venda aprovada",
                color: "text-success",
                prefix: "",
              },
              reversed: {
                icon: RotateCcw,
                label: "Estorno",
                color: "text-destructive",
                prefix: "− ",
              },
              disputed: {
                icon: ShieldAlert,
                label: "MED em contestação",
                color: "text-amber-300",
                prefix: "",
              },
            }[event.kind];
            return (
              <li
                key={event.id}
                className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {SALES_PROVIDERS[event.provider]} · {label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {event.external_id} · {date.format(new Date(event.occurred_at))}
                    </p>
                  </div>
                </div>
                <p className={cn("shrink-0 text-sm font-bold tabular-nums", color)}>
                  {prefix}
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
