import { useEffect, useRef, useState } from "react";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import { readMouseHotSettings } from "@/lib/mousehot-settings";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Clock,
  CreditCard,
  Eye,
  FileText,
  Gauge,
  Info,
  LayoutGrid,
  MousePointerClick,
  Move,
  Percent,
  PiggyBank,
  Pointer,
  Receipt,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip as HelpTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getGoogleAdsStatus } from "@/lib/api/google-integrations.functions";
import { getMetaAdsStatus } from "@/lib/api/tracking.functions";
import {
  readScaleHotAdAccount,
  readScaleHotOperation,
  type ScaleHotOperation,
} from "@/lib/api/scalehot-operation.functions";
import { salesMoney, type SalesPeriod } from "@/lib/sales-events";
import { previousScaleHotRange, SCALEHOT_PERIODS } from "@/lib/scalehot-period";
import { metricChange } from "@/lib/scalehot-report-display";
import { useScaleHotOperation } from "./useScaleHotOperation";
import { ScaleHotAnalysis } from "./ScaleHotAnalysis";

const integer = new Intl.NumberFormat("pt-BR");
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });
const ratio = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const indicators = [
  [
    "spend",
    "Gastos em anúncios",
    "money",
    Wallet,
    "Valor investido nas contas de anúncios selecionadas.",
  ],
  [
    "net",
    "Faturamento líquido",
    "money",
    TrendingUp,
    "Valor líquido informado pelos gateways, descontados os estornos.",
  ],
  [
    "pendingRevenue",
    "Receita pendente",
    "money",
    Clock,
    "Valor de pedidos que aguardam confirmação do pagamento.",
  ],
  [
    "pendingSales",
    "Vendas pendentes",
    "number",
    Clock,
    "Quantidade de pedidos que aguardam pagamento.",
  ],
  [
    "profit",
    "Lucro",
    "money",
    PiggyBank,
    "Faturamento líquido após anúncios e custos registrados.",
  ],
  ["roi", "ROI", "percent", Percent, "Lucro dividido pelo total investido em anúncios e custos."],
  [
    "roas",
    "ROAS",
    "ratio",
    Gauge,
    "Receita bruta atribuída à mídia paga dividida pelo gasto em anúncios.",
  ],
  [
    "margin",
    "Margem",
    "percent",
    Percent,
    "Percentual do faturamento líquido que se converteu em lucro.",
  ],
  ["approved", "Vendas aprovadas", "number", ShoppingCart, "Pagamentos confirmados no período."],
  ["ctr", "CTR", "percent", MousePointerClick, "Cliques divididos pelas impressões dos anúncios."],
  ["cpm", "CPM", "money", Eye, "Custo a cada mil impressões."],
  ["cpa", "CPA", "money", Target, "Investimento dividido pelas vendas atribuídas à mídia paga."],
  ["cpc", "CPC", "money", Pointer, "Gasto em anúncios dividido pelos cliques."],
  ["impressions", "Impressões", "number", Eye, "Quantidade de exibições dos anúncios."],
  [
    "clicks",
    "Cliques",
    "number",
    MousePointerClick,
    "Cliques contabilizados pelas plataformas de anúncios.",
  ],
  ["reach", "Alcance", "number", Users, "Pessoas alcançadas segundo a plataforma de anúncios."],
  ["views", "Vis. de página", "number", FileText, "Visitas registradas nas páginas da operação."],
  ["leads", "Leads", "number", UserPlus, "Registros de lead atribuídos à campanha."],
  ["cart", "Add to Cart", "number", ShoppingBag, "Eventos de adição ao carrinho."],
  ["checkout", "Initiate Checkout", "number", CreditCard, "Eventos de início de checkout."],
  ["metaTax", "Imposto Meta", "money", Percent, "Impostos Meta registrados em Taxas."],
  ["tax", "Impostos", "money", Receipt, "Impostos operacionais registrados em Taxas."],
  ["fee", "Taxas", "money", Wallet, "Taxas operacionais registradas no módulo de traqueamento."],
  ["expense", "Despesas", "money", Wallet, "Despesas registradas para o período."],
] as const;
type Metric = (typeof indicators)[number];
type MetricKey = Metric[0];
export type ScaleHotMetrics = Partial<Record<MetricKey, number>>;
type Period = Exclude<SalesPeriod, "all">;
type Filters = { period: Period; selection: string; campaign: string };
type AdTotals = { spend: number; impressions: number; clicks: number };
const defaultFilters: Filters = { period: "today", selection: "", campaign: "" };
const metricByKey = new Map(indicators.map((metric) => [metric[0], metric]));
const metricOrder = indicators.map(([id]) => id);

function format(value: number, kind: Metric[2]) {
  switch (kind) {
    case "money":
      return salesMoney(value);
    case "percent":
      return percent.format(value);
    case "ratio":
      return ratio.format(value) + "x";
    case "number":
      return integer.format(value);
  }
}

function figures(operation: ScaleHotOperation | undefined, ads?: AdTotals): ScaleHotMetrics {
  const spend = ads && Math.round(ads.spend * 100);
  const net =
    operation?.net_cents == null ? undefined : operation.net_cents - operation.reversed_cents;
  const costs =
    operation &&
    operation.expense_cents +
      operation.fee_cents +
      operation.tax_cents +
      operation.meta_tax_cents +
      operation.product_cost_cents;
  const profit =
    net === undefined || costs === undefined || spend === undefined
      ? undefined
      : net - costs - spend;
  return {
    approved: operation?.approved,
    net,
    spend,
    profit,
    roi:
      profit !== undefined && spend !== undefined && costs !== undefined && spend + costs > 0
        ? profit / (spend + costs)
        : undefined,
    roas:
      operation && spend && operation.paid_sales ? operation.paid_gross_cents / spend : undefined,
    margin: profit !== undefined && net !== undefined && net > 0 ? profit / net : undefined,
    impressions: ads?.impressions,
    clicks: ads?.clicks,
    ctr: ads?.impressions ? ads.clicks / ads.impressions : undefined,
    cpm: ads?.impressions && spend !== undefined ? (spend * 1000) / ads.impressions : undefined,
    cpc: ads?.clicks && spend !== undefined ? spend / ads.clicks : undefined,
    cpa: operation?.paid_sales && spend !== undefined ? spend / operation.paid_sales : undefined,
    metaTax: operation?.meta_tax_cents,
    tax: operation?.tax_cents,
    fee: operation?.fee_cents,
    expense: operation?.expense_cents,
  };
}

function sumAdTotals(rows?: { currency: string; totals: AdTotals | null }[]): AdTotals | undefined {
  if (!rows?.length || rows.some(({ currency }) => currency !== "BRL")) return;
  return rows.reduce(
    (total, { totals }) => ({
      spend: total.spend + (totals?.spend ?? 0),
      impressions: total.impressions + (totals?.impressions ?? 0),
      clicks: total.clicks + (totals?.clicks ?? 0),
    }),
    { spend: 0, impressions: 0, clicks: 0 },
  );
}

function selectedAd(value: string) {
  if (value.startsWith("meta:")) return { provider: "meta" as const, id: value.slice(5) };
  if (value.startsWith("google:")) return { provider: "google" as const, id: value.slice(7) };
  return null;
}

export function ScaleHotOverview() {
  const { user: profile } = usePlatformAccess();
  const initialFilters = () => ({
    ...defaultFilters,
    period: readMouseHotSettings(profile?.user_metadata).period ?? defaultFilters.period,
  });
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [reorder, setReorder] = useState(false);
  const dragging = useRef<MetricKey | null>(null);
  const { operation, sales, range, user } = useScaleHotOperation(
    filters.period,
    filters.campaign || undefined,
  );
  const loadMeta = useServerFn(getMetaAdsStatus);
  const loadGoogle = useServerFn(getGoogleAdsStatus);
  const loadAds = useServerFn(readScaleHotAdAccount);
  const readOperation = useServerFn(readScaleHotOperation);
  const meta = useQuery({
    queryKey: ["scalehot-meta-ads", user?.id],
    queryFn: () => loadMeta(),
    enabled: Boolean(user),
    retry: false,
  });
  const google = useQuery({
    queryKey: ["scalehot-google-ads", user?.id],
    queryFn: () => loadGoogle(),
    enabled: Boolean(user),
    retry: false,
  });
  const accounts = [
    ...(meta.data?.accounts ?? []).map(({ id, name }) => ({
      id: "meta:" + id,
      name: "Meta · " + name,
    })),
    ...(google.data?.accounts ?? []).map(({ id, name }) => ({
      id: "google:" + id,
      name: "Google · " + name,
    })),
  ];
  const chosenAccounts = (
    filters.selection ? [filters.selection] : accounts.map(({ id }) => id)
  ).flatMap((id) => {
    const account = selectedAd(id);
    return account ? [account] : [];
  });
  const adReportAllowed =
    chosenAccounts.length > 0 &&
    chosenAccounts.length <= 12 &&
    !filters.campaign &&
    (Boolean(filters.selection) || (meta.isSuccess && google.isSuccess));
  const advertising = useQuery({
    queryKey: ["scalehot-operation-ads", user?.id, chosenAccounts, range],
    queryFn: () => loadAds({ data: { accounts: chosenAccounts, range } }),
    enabled: Boolean(user && adReportAllowed),
    retry: false,
    staleTime: 60_000,
  });
  const earlier = previousScaleHotRange(range);
  const priorAdvertising = useQuery({
    queryKey: ["scalehot-operation-ads", user?.id, chosenAccounts, earlier],
    queryFn: () => loadAds({ data: { accounts: chosenAccounts, range: earlier } }),
    enabled: Boolean(user && adReportAllowed && advertising.isSuccess),
    retry: false,
    staleTime: 60_000,
  });
  const comparison = useQuery({
    queryKey: ["scalehot-operation-comparison", user?.id, earlier, filters.campaign],
    queryFn: () =>
      readOperation({ data: { range: earlier, campaign: filters.campaign || undefined } }),
    enabled: Boolean(user && operation.isSuccess),
    retry: false,
  });
  const [preferences, setPreferences] = useState<{ order: MetricKey[]; hidden: MetricKey[] }>({
    order: metricOrder,
    hidden: [],
  });
  const preferenceKey = user ? "scalehot-indicators:" + user.id : null;
  useEffect(() => {
    if (!preferenceKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(preferenceKey) ?? "null");
      if (!Array.isArray(saved?.order) || !Array.isArray(saved?.hidden)) return;
      const valid = (key: MetricKey) => metricByKey.has(key);
      setPreferences({
        order: [...new Set<MetricKey>([...saved.order.filter(valid), ...metricOrder])],
        hidden: saved.hidden.filter(valid),
      });
    } catch {
      return;
    }
  }, [preferenceKey]);
  const save = (next: typeof preferences) => {
    setPreferences(next);
    if (preferenceKey) {
      try {
        localStorage.setItem(preferenceKey, JSON.stringify(next));
      } catch {
        /* Session only. */
      }
    }
  };
  const compatibleAds = adReportAllowed ? sumAdTotals(advertising.data) : undefined;
  const current = figures(operation.data, compatibleAds);
  const previous = figures(
    comparison.data,
    adReportAllowed ? sumAdTotals(priorAdvertising.data) : undefined,
  );
  if (!operation.data && !filters.campaign && sales.data) {
    current.approved = sales.data.approved;
    if (sales.data.approved === sales.data.with_net) {
      current.net = (sales.data.reported_net_cents ?? 0) - sales.data.reversed_cents;
    }
  }
  // Revenue is a gateway total. This account selection filters API metrics only.
  if (filters.selection || filters.campaign) {
    current.profit = current.roas = current.roi = current.margin = current.cpa = undefined;
    previous.profit = previous.roas = previous.roi = previous.margin = previous.cpa = undefined;
  }
  const metrics = preferences.order.filter((key) => !preferences.hidden.includes(key));
  const changed =
    draft.period !== filters.period ||
    draft.selection !== filters.selection ||
    draft.campaign !== filters.campaign;
  const refreshing =
    operation.isFetching ||
    sales.isFetching ||
    advertising.isFetching ||
    priorAdvertising.isFetching ||
    comparison.isFetching;
  const sync = () => {
    void operation.refetch();
    void sales.refetch();
    if (adReportAllowed) void advertising.refetch();
    if (adReportAllowed && advertising.isSuccess) void priorAdvertising.refetch();
    if (operation.isSuccess) void comparison.refetch();
    void meta.refetch();
    void google.refetch();
  };
  const move = (key: MetricKey, target: MetricKey) => {
    const from = preferences.order.indexOf(key);
    const to = preferences.order.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    const order = [...preferences.order];
    order.splice(from, 1);
    order.splice(to, 0, key);
    save({ ...preferences, order });
  };
  const series =
    operation.data?.series ??
    (!filters.campaign
      ? sales.data?.series.map(({ day, cents }) => ({ day, gross_cents: cents }))
      : undefined);

  return (
    <div className="scalehot-dashboard">
      <form
        className="scalehot-filters"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters(draft);
        }}
      >
        <label>
          Período de Visualização
          <span className="scalehot-date-control">
            <CalendarDays size={16} aria-hidden />
            <select
              className="field"
              value={draft.period}
              onChange={(event) =>
                setDraft({ ...draft, period: event.target.value as Period, campaign: "" })
              }
            >
              {SCALEHOT_PERIODS.map(({ key, label }) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label>
          Conta de Anúncio
          <select
            className="field"
            value={draft.selection}
            onChange={(event) => setDraft({ ...draft, selection: event.target.value })}
          >
            <option value="">Qualquer</option>
            {accounts.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Campanha
          <select
            className="field"
            value={draft.campaign}
            onChange={(event) => setDraft({ ...draft, campaign: event.target.value })}
          >
            <option value="">Qualquer</option>
            {operation.data?.campaigns.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button className="sales-button scalehot-action" disabled={!changed} type="submit">
          Aplicar
        </button>
      </form>
      <header className="scalehot-heading">
        <div>
          <h1>Resumo</h1>
          <p>Visão consolidada da operação de anúncios e vendas</p>
        </div>
        <div className="scalehot-actions">
          <button
            type="button"
            className="sales-button sales-button-outline"
            aria-pressed={reorder}
            onClick={() => setReorder(!reorder)}
          >
            <Move size={16} aria-hidden /> {reorder ? "Concluir ordenação" : "Arrastar cards"}
          </button>
          <Dialog>
            <DialogTrigger asChild>
              <button type="button" className="sales-button sales-button-outline">
                <LayoutGrid size={16} aria-hidden /> Personalizar
              </button>
            </DialogTrigger>
            <DialogContent className="max-h-[85dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Personalizar indicadores</DialogTitle>
                <DialogDescription>Escolha os cards do Resumo neste navegador.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-2 sm:grid-cols-2">
                {indicators.map(([key, label]) => (
                  <label
                    key={key}
                    className="flex min-h-10 items-center gap-3 rounded-md border border-border px-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={!preferences.hidden.includes(key)}
                      onChange={(event) =>
                        save({
                          ...preferences,
                          hidden: event.target.checked
                            ? preferences.hidden.filter((id) => id !== key)
                            : [...preferences.hidden, key],
                        })
                      }
                    />{" "}
                    {label}
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="sales-button sales-button-outline"
                onClick={() => save({ order: metricOrder, hidden: [] })}
              >
                Restaurar padrão
              </button>
            </DialogContent>
          </Dialog>
          <button
            type="button"
            className="sales-button sales-button-outline"
            onClick={sync}
            disabled={refreshing}
          >
            <RefreshCw size={16} aria-hidden />{" "}
            {refreshing ? "Sincronizando…" : "Sincronizar dados"}
          </button>
        </div>
      </header>
      <div className="scalehot-notice" role="status">
        {operation.isError
          ? "Indicadores avançados indisponíveis neste ambiente. As vendas registradas continuam disponíveis."
          : advertising.isError
            ? "Não foi possível consultar a conta de anúncios selecionada."
            : filters.campaign
              ? "Filtro de campanha aplicado às vendas atribuídas. Gastos por campanha não estão disponíveis."
              : filters.selection
                ? "A conta escolhida filtra as métricas de anúncios. Os recebimentos abrangem toda a operação."
                : chosenAccounts.length > 12
                  ? "Selecione uma conta para consultar anúncios."
                  : compatibleAds
                    ? "Gastos nas contas conectadas em reais. ROAS e CPA consideram vendas atribuídas à mídia paga."
                    : "Conecte contas de anúncios em reais para consultar gastos, cliques e impressões."}
        <Link to="/vendas/conexoes" className="text-brand-red hover:underline">
          Integrações
        </Link>
      </div>
      <TooltipProvider delayDuration={200}>
        <ul className="scalehot-grid" aria-label="Indicadores da operação">
          {metrics.map((key, index) => {
            const metric = metricByKey.get(key);
            if (!metric) return null;
            const [, title, kind, Icon, help] = metric;
            const value = current[key];
            const delta = metricChange(value, previous[key]);
            return (
              <li
                className="scalehot-stat"
                key={key}
                draggable={reorder}
                onDragStart={(event) => {
                  if (!reorder) return;
                  dragging.current = key;
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", title);
                }}
                onDragOver={(event) => {
                  if (reorder && dragging.current) event.preventDefault();
                }}
                onDragEnd={() => {
                  dragging.current = null;
                }}
                onDrop={(event) => {
                  if (!reorder || !dragging.current) return;
                  event.preventDefault();
                  move(dragging.current, key);
                  dragging.current = null;
                }}
              >
                <div className="scalehot-stat-head">
                  <span className="scalehot-stat-icon">
                    <Icon size={16} aria-hidden />
                  </span>
                  <p>{title}</p>
                  <HelpTooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="scalehot-stat-info"
                        aria-label={"Sobre " + title}
                      >
                        <Info size={14} aria-hidden />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-56">{help}</TooltipContent>
                  </HelpTooltip>
                </div>
                <strong>{value === undefined ? "—" : format(value, kind)}</strong>
                <small>
                  {value === undefined
                    ? "Dado indisponível"
                    : delta !== null
                      ? percent.format(delta) + " vs período anterior"
                      : "No período selecionado"}
                </small>
                {reorder && (
                  <div className="mt-2 flex gap-1">
                    <button
                      className="scalehot-order-control"
                      type="button"
                      aria-label={"Mover " + title + " para antes"}
                      disabled={index === 0}
                      onClick={() => move(key, metrics[index - 1])}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      className="scalehot-order-control"
                      type="button"
                      aria-label={"Mover " + title + " para depois"}
                      disabled={index === metrics.length - 1}
                      onClick={() => move(key, metrics[index + 1])}
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </TooltipProvider>
      <div className="scalehot-analysis">
        <SalesRank
          title="Vendas por Produto"
          entries={operation.data?.products?.map((item) => ({
            ...item,
            name: item.name ?? "Sem produto informado",
          }))}
        />
        <SalesRank title="Vendas por Campanha (UTM)" entries={operation.data?.campaigns} />
        <ScaleHotAnalysis current={current} previous={previous} />
        <section className="sales-panel scalehot-analysis-wide p-5">
          <h2 className="font-semibold">Evolução diária do faturamento</h2>
          {series?.length ? (
            <div className="mt-4 h-52 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} accessibilityLayer>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(day: string) => day.slice(8) + "/" + day.slice(5, 7)}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                  />
                  <YAxis
                    tickFormatter={(value: number) => integer.format(value / 100)}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                  />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", borderColor: "var(--border)" }}
                    formatter={(value: number) => [salesMoney(value), "Faturamento"]}
                  />
                  <Bar dataKey="gross_cents" fill="var(--primary-glow)" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="scalehot-empty">
              {series ? "Sem vendas no período" : "Dados indisponíveis"}
            </p>
          )}
        </section>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/vendas/rastreamento" className="sales-button sales-button-outline">
          Rastreamento de vendas
        </Link>
        <Link to="/vendas/eventos" className="sales-button sales-button-outline">
          Eventos recentes
        </Link>
      </div>
    </div>
  );
}

export function SalesRank({
  title,
  entries,
}: {
  title: string;
  entries?: { name: string; sales: number; gross_cents: number }[];
}) {
  return (
    <section className="sales-panel scalehot-ranking min-w-0 p-5">
      <h2 className="font-semibold">{title}</h2>
      {entries?.length ? (
        <ul className="mt-3 max-h-56 divide-y divide-border overflow-auto">
          {entries.map(({ name, sales, gross_cents }, index) => (
            <li key={name + index} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="min-w-0 break-words">
                {name}
                <small className="block text-muted-foreground">
                  {integer.format(sales)} vendas
                </small>
              </span>
              <strong className="shrink-0 tabular-nums">{salesMoney(gross_cents)}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="scalehot-empty">{entries ? "Sem dados no período" : "Dados indisponíveis"}</p>
      )}
    </section>
  );
}
