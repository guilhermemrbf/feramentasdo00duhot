import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDownUp, CalendarDays, RefreshCw, Search } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { salesMoney } from "@/lib/sales-events";
import type { TrackingOverview } from "@/lib/api/tracking.functions";

type Days = 7 | 14 | 30;
type Breakdown = "campaign" | "ad";
type Measure = "gross_cents" | "sales" | "reversed_cents";
const recentDays = [7, 14, 30] as const;
const number = new Intl.NumberFormat("pt-BR");
const dateLabel = (day: string) => day.slice(8, 10) + "/" + day.slice(5, 7);
const moneyTick = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

type ReportProps = {
  data?: TrackingOverview;
  pending: boolean;
  error: boolean;
  refreshing: boolean;
  refresh: () => void;
  days: Days;
  changeDays: (days: Days) => void;
  breakdown: Breakdown;
  changeBreakdown: (breakdown: Breakdown) => void;
};

export function TrackingReport({
  data,
  pending,
  error,
  refreshing,
  refresh,
  days,
  changeDays,
  breakdown,
  changeBreakdown,
}: ReportProps) {
  const first = data?.series[0]?.day;
  const last = data?.series.at(-1)?.day;

  return (
    <div className="tracking-report">
      <div className="tracking-toolbar">
        <div className="tracking-range">
          <CalendarDays size={17} aria-hidden="true" />
          <span>
            {first && last ? dateLabel(first) + " – " + dateLabel(last) : "Período do relatório"}
          </span>
        </div>
        <div className="tracking-controls">
          <div className="tracking-segment" aria-label="Período do relatório" role="group">
            {recentDays.map((range) => (
              <button
                key={range}
                type="button"
                aria-pressed={range === days}
                onClick={() => changeDays(range)}
              >
                {range} dias
              </button>
            ))}
          </div>
          <button
            type="button"
            className="tracking-refresh"
            aria-label="Atualizar relatório"
            disabled={refreshing}
            onClick={refresh}
          >
            <RefreshCw size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
      {pending && (
        <div className="tracking-empty" role="status">
          Carregando desempenho…
        </div>
      )}
      {error && (
        <div className="tracking-empty" role="alert">
          <p>Não foi possível carregar o relatório de vendas.</p>
          <button type="button" className="sales-button sales-button-outline" onClick={refresh}>
            Tentar novamente
          </button>
        </div>
      )}
      {data && (
        <>
          <ReportTotals data={data} />
          <section className="tracking-panel" aria-labelledby="tracking-revenue">
            <div className="tracking-panel-heading">
              <div>
                <h2 id="tracking-revenue">Evolução da receita</h2>
                <p>Vendas aprovadas por dia, antes dos estornos.</p>
              </div>
              <div className="tracking-legend" aria-label="Legenda do gráfico">
                <span>
                  <i aria-hidden="true" /> Atribuída
                </span>
                <span>
                  <i aria-hidden="true" /> Sem atribuição
                </span>
              </div>
            </div>
            {data.approved ? (
              <div className="tracking-chart">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart
                    data={data.series}
                    margin={{ top: 8, bottom: 0, left: 0, right: 12 }}
                    accessibilityLayer
                  >
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
                    <XAxis
                      dataKey="day"
                      tickFormatter={dateLabel}
                      minTickGap={24}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    />
                    <YAxis
                      tickFormatter={(cents: number) => moneyTick.format(cents / 100)}
                      width={42}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    />
                    <Tooltip
                      labelFormatter={(label) => dateLabel(String(label))}
                      formatter={(value) => salesMoney(Number(value))}
                      cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
                      contentStyle={{
                        background: "var(--popover)",
                        color: "var(--foreground)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                      }}
                    />
                    <Bar
                      stackId="revenue"
                      dataKey="gross_attributed_cents"
                      name="Atribuída"
                      fill="var(--tracking-red)"
                      maxBarSize={28}
                      isAnimationActive={false}
                    />
                    <Bar
                      stackId="revenue"
                      dataKey="gross_unattributed_cents"
                      name="Sem atribuição"
                      fill="var(--tracking-neutral)"
                      maxBarSize={28}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="tracking-empty tracking-chart-empty">
                <p>Nenhuma venda aprovada neste período.</p>
                <Link to="/vendas/rastreamento" search={{ view: "integracoes" }}>
                  Ver fontes de rastreamento
                </Link>
              </div>
            )}
          </section>
          <CampaignTable
            rows={data.campaigns}
            breakdown={breakdown}
            changeBreakdown={changeBreakdown}
          />
        </>
      )}
    </div>
  );
}

function ReportTotals({ data }: { data: TrackingOverview }) {
  const share = data.approved ? Math.round((data.attributed / data.approved) * 100) : 0;
  return (
    <dl className="tracking-metrics" aria-label="Indicadores de desempenho">
      <div>
        <dt>Receita bruta</dt>
        <dd>
          {salesMoney(data.gross_cents)}
          <span>Todas as vendas aprovadas</span>
        </dd>
      </div>
      <div>
        <dt>Receita atribuída</dt>
        <dd>
          {salesMoney(data.gross_attributed_cents)}
          <span>{salesMoney(data.reversed_attributed_cents)} em estornos atribuídos</span>
        </dd>
      </div>
      <div>
        <dt>Vendas aprovadas</dt>
        <dd>
          {number.format(data.approved)}
          <span>{number.format(data.attributed)} com origem identificada</span>
        </dd>
      </div>
      <div>
        <dt>Cobertura de atribuição</dt>
        <dd>
          {data.approved ? share + "%" : "—"}
          <span>{number.format(data.unattributed)} vendas sem atribuição</span>
        </dd>
      </div>
    </dl>
  );
}

const columns: { name: string; field: Measure }[] = [
  { name: "Vendas", field: "sales" },
  { name: "Receita bruta", field: "gross_cents" },
  { name: "Estornos", field: "reversed_cents" },
];

function CampaignTable({
  rows,
  breakdown,
  changeBreakdown,
}: {
  rows: TrackingOverview["campaigns"];
  breakdown: Breakdown;
  changeBreakdown: (breakdown: Breakdown) => void;
}) {
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<{ field: Measure; asc: boolean }>({
    field: "gross_cents",
    asc: false,
  });
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const filtered = rows
    .filter(
      (item) =>
        [item.campaign, item.campaign_id, item.source, item.medium, item.ad_id].some((value) =>
          value?.toLocaleLowerCase("pt-BR").includes(term),
        ) || !term,
    )
    .sort((left, right) => (left[order.field] - right[order.field]) * (order.asc ? 1 : -1));

  return (
    <section className="tracking-panel" aria-labelledby="tracking-campaigns">
      <div className="tracking-panel-heading">
        <div>
          <h2 id="tracking-campaigns">Origem das vendas</h2>
          <p>Até 50 resultados com vendas vinculadas ao checkout.</p>
        </div>
        <div className="tracking-segment" aria-label="Detalhamento da origem" role="group">
          <button
            type="button"
            aria-pressed={breakdown === "campaign"}
            onClick={() => changeBreakdown("campaign")}
          >
            Campanhas
          </button>
          <button
            type="button"
            aria-pressed={breakdown === "ad"}
            onClick={() => changeBreakdown("ad")}
          >
            Anúncios
          </button>
        </div>
      </div>
      <div className="tracking-table-tools">
        <label>
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Buscar origem</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar campanha, origem ou ID"
          />
        </label>
        <span aria-live="polite">
          {number.format(filtered.length)} {filtered.length === 1 ? "resultado" : "resultados"}
        </span>
      </div>
      {filtered.length ? (
        <div className="tracking-table-scroll">
          <table className="tracking-table">
            <caption className="sr-only">
              Desempenho por {breakdown === "campaign" ? "campanha" : "anúncio"}
            </caption>
            <thead>
              <tr>
                <th scope="col">{breakdown === "campaign" ? "Campanha" : "Anúncio"}</th>
                <th scope="col">Canal</th>
                {columns.map(({ name, field }) => (
                  <th
                    key={field}
                    scope="col"
                    className="tracking-numeric"
                    aria-sort={
                      order.field === field ? (order.asc ? "ascending" : "descending") : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOrder({ field, asc: field === order.field ? !order.asc : false })
                      }
                    >
                      {name} <ArrowDownUp size={13} aria-hidden="true" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={JSON.stringify([
                    item.source,
                    item.medium,
                    item.campaign,
                    item.campaign_id,
                    item.ad_id,
                  ])}
                >
                  <th scope="row">
                    {breakdown === "ad"
                      ? item.ad_id
                        ? "Anúncio " + item.ad_id
                        : "Sem ID de anúncio"
                      : item.campaign ||
                        (item.campaign_id && "Campanha " + item.campaign_id) ||
                        "Campanha sem nome"}
                    {breakdown === "ad" && item.campaign && <span>{item.campaign}</span>}
                  </th>
                  <td>
                    <span>{item.source || "Sem canal"}</span>
                    {item.medium && <small>{item.medium}</small>}
                  </td>
                  <td className="tracking-numeric">{number.format(item.sales)}</td>
                  <td className="tracking-numeric">{salesMoney(item.gross_cents)}</td>
                  <td className="tracking-numeric">{salesMoney(item.reversed_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tracking-empty">
          {term
            ? "Nenhuma origem corresponde à busca."
            : "A primeira campanha aparece depois que um clique é associado a um pedido aprovado."}
        </div>
      )}
    </section>
  );
}
