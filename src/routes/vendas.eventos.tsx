import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SalesPageHeader } from "@/components/sales/SalesLayout";
import { useScaleHotOperation } from "@/components/sales/useScaleHotOperation";
import { SCALEHOT_PERIODS } from "@/lib/scalehot-period";
import { SALES_PROVIDERS, salesMoney, type SaleKind, type SalesPeriod } from "@/lib/sales-events";

const kinds: Record<SaleKind, string> = {
  approved: "Venda aprovada",
  reversed: "Estorno",
  disputed: "Contestação",
};
const date = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
export const Route = createFileRoute("/vendas/eventos")({
  head: () => ({ meta: [{ title: "Eventos · Traqueamento avançado | Mousefy" }] }),
  component: Events,
});

function Events() {
  const [period, setPeriod] = useState<Exclude<SalesPeriod, "all">>("today");
  const [kind, setKind] = useState("");
  const { sales } = useScaleHotOperation(period);
  const entries = sales.data?.recent.filter((event) => !kind || event.kind === kind);
  return (
    <div className="scalehot-dashboard">
      <div className="scalehot-filters">
        <label>
          Período de Visualização
          <select
            className="field"
            value={period}
            onChange={(event) => setPeriod(event.target.value as typeof period)}
          >
            {SCALEHOT_PERIODS.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo de evento
          <select className="field" value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="">Todos</option>
            {Object.entries(kinds).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <SalesPageHeader
        title="Eventos & qualidade"
        subtitle="Veja os 20 eventos mais recentes recebidos dos seus gateways no período."
      />
      <section className="sales-panel p-5">
        {entries?.length ? (
          <div className="overflow-x-auto">
            <table className="scalehot-table">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Gateway</th>
                  <th>Data</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((event) => (
                  <tr key={event.id}>
                    <td>{kinds[event.kind]}</td>
                    <td>{SALES_PROVIDERS[event.provider]}</td>
                    <td className="whitespace-nowrap">
                      {date.format(new Date(event.occurred_at))}
                    </td>
                    <td className="whitespace-nowrap tabular-nums">
                      {salesMoney(event.amount_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="scalehot-empty" role={sales.isError ? "alert" : "status"}>
            {sales.isError
              ? "Não foi possível carregar os eventos."
              : sales.isPending
                ? "Carregando eventos…"
                : "Nenhum evento no período"}
          </p>
        )}
      </section>
    </div>
  );
}
