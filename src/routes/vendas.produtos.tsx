import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SalesPageHeader } from "@/components/sales/SalesLayout";
import { SalesRank } from "@/components/sales/ScaleHotOverview";
import { useScaleHotOperation } from "@/components/sales/useScaleHotOperation";
import { SCALEHOT_PERIODS } from "@/lib/scalehot-period";
import type { SalesPeriod } from "@/lib/sales-events";

export const Route = createFileRoute("/vendas/produtos")({
  head: () => ({ meta: [{ title: "Produtos · Traqueamento avançado | Mousefy" }] }),
  component: Products,
});

function Products() {
  const [period, setPeriod] = useState<Exclude<SalesPeriod, "all">>("today");
  const { operation } = useScaleHotOperation(period);
  const products = operation.data?.products;
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
      </div>
      <SalesPageHeader
        title="Produtos"
        subtitle="Veja quais produtos aparecem nas vendas aprovadas."
      />
      {operation.isError && (
        <p className="scalehot-notice" role="alert">
          O relatório por produto está indisponível neste ambiente.
        </p>
      )}
      <SalesRank
        title="Vendas por Produto"
        entries={products?.map((item) => ({ ...item, name: item.name ?? "Sem produto informado" }))}
      />
      <p className="text-sm text-muted-foreground">
        O webhook personalizado pode informar <code>product_name</code> nas novas vendas aprovadas.
      </p>
    </div>
  );
}
