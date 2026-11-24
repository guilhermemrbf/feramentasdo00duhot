import { Info } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ScaleHotMetrics } from "./ScaleHotOverview";
import { scaleHotComparisonSeries } from "@/lib/scalehot-report-display";
import { salesMoney } from "@/lib/sales-events";

type Kind = "money" | "percent" | "number" | "ratio";
type Series = { key: keyof ScaleHotMetrics; label: string; kind: Kind };
type Comparison = { title: string; series: Series[] };
const seriesColors = ["var(--brand-red)", "var(--info)", "var(--brand-gold)"];
const reports: Comparison[] = [
  {
    title: "Gastos em anúncios × Faturamento líquido",
    series: [
      { key: "spend", label: "Gastos em anúncios", kind: "money" },
      { key: "net", label: "Faturamento líquido", kind: "money" },
    ],
  },
  {
    title: "Lucro × ROI",
    series: [
      { key: "profit", label: "Lucro", kind: "money" },
      { key: "roi", label: "ROI %", kind: "percent" },
    ],
  },
  {
    title: "ROAS × Compras",
    series: [
      { key: "roas", label: "ROAS", kind: "ratio" },
      { key: "approved", label: "Compras", kind: "number" },
    ],
  },
  {
    title: "CTR · CPM · CPA",
    series: [
      { key: "ctr", label: "CTR %", kind: "percent" },
      { key: "cpm", label: "CPM", kind: "money" },
      { key: "cpa", label: "CPA", kind: "money" },
    ],
  },
];

const funnelSteps = [
  { key: "clicks", label: "Cliques" },
  { key: "views", label: "Vis. Página" },
  { key: "checkout", label: "ICs" },
  { key: "pendingSales", label: "Vendas Inic." },
  { key: "approved", label: "Vendas Apr." },
] satisfies { key: keyof ScaleHotMetrics; label: string }[];

const integer = new Intl.NumberFormat("pt-BR");
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });
const ratio = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMeasure(value: number | undefined, kind: Kind) {
  if (value === undefined) return "—";
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

export function ScaleHotAnalysis({
  current,
  previous,
}: {
  current: ScaleHotMetrics;
  previous: ScaleHotMetrics;
}) {
  const total =
    current.approved !== undefined && current.pendingSales !== undefined
      ? current.approved + current.pendingSales
      : null;
  const approval = total && current.approved !== undefined ? current.approved / total : null;
  return (
    <>
      <section className="sales-panel scalehot-approval scalehot-ranking">
        <h2>Taxa de Aprovação</h2>
        {approval === null ? (
          <p className="scalehot-empty">
            A taxa requer os registros de pedidos iniciados e aprovados.
          </p>
        ) : (
          <div className="scalehot-approval-value">
            <strong>{percent.format(approval)}</strong>
            <span>
              {integer.format(current.approved ?? 0)} de {integer.format(total ?? 0)} pedidos
              aprovados
            </span>
          </div>
        )}
      </section>
      {reports.map((report) => (
        <ReportChart key={report.title} {...report} current={current} previous={previous} />
      ))}
      <section className="sales-panel scalehot-chart scalehot-analysis-wide">
        <h2>
          Funnel de Conversão <Info size={16} aria-hidden />
        </h2>
        <p className="scalehot-funnel-note">
          As etapas exibem apenas os eventos disponíveis no período.
        </p>
        <ol className="scalehot-funnel-steps">
          {funnelSteps.map(({ key, label }) => {
            const value = current[key];
            return (
              <li key={key} data-available={value !== undefined}>
                <span>{label}</span>
                <strong>{formatMeasure(value, "number")}</strong>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}

function ReportChart({
  title,
  series,
  current,
  previous,
}: Comparison & { current: ScaleHotMetrics; previous: ScaleHotMetrics }) {
  const data = scaleHotComparisonSeries(
    series.map(({ key }) => key),
    current,
    previous,
  );
  const axes = [...new Set(series.map(({ kind }) => kind))];
  const available = series.some(
    ({ key }) => current[key] !== undefined || previous[key] !== undefined,
  );
  return (
    <section className="sales-panel scalehot-chart">
      <h2>{title}</h2>
      <div className="scalehot-chart-frame">
        {!available && <p className="scalehot-chart-empty">Sem dados para comparar</p>}
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart
            data={data}
            accessibilityLayer
            margin={{ top: 12, right: 8, bottom: 3, left: 8 }}
          >
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="period"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
            />
            {axes.map((kind, index) => (
              <YAxis
                key={kind}
                yAxisId={kind}
                orientation={index ? "right" : "left"}
                width={52}
                stroke="var(--muted-foreground)"
                fontSize={10}
                tickLine={false}
                tickFormatter={(value: number) => formatMeasure(value, kind)}
              />
            ))}
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                borderColor: "var(--border)",
                borderRadius: 8,
              }}
              formatter={(value: number, label: string) => [
                formatMeasure(value, series.find((item) => item.label === label)?.kind ?? "number"),
                label,
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {series.map(({ key, label, kind }, index) => (
              <Line
                key={key}
                yAxisId={kind}
                dataKey={key}
                name={label}
                stroke={seriesColors[index]}
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="sr-only">
        {series.map(({ key, label, kind }) => (
          <li key={key}>
            {label} · período selecionado {formatMeasure(current[key], kind)} · anterior{" "}
            {formatMeasure(previous[key], kind)}
          </li>
        ))}
      </ul>
    </section>
  );
}
