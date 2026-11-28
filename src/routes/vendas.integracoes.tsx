import { usePlanAccess } from "@/components/access/PlatformAccessProvider";
import { createFileRoute } from "@tanstack/react-router";
import { SalesConnections } from "@/components/sales/SalesConnections";
import { SalesPageHeader } from "@/components/sales/SalesLayout";
import { useSalesOverview } from "@/components/sales/SalesSummary";

export const Route = createFileRoute("/vendas/integracoes")({
  head: () => ({ meta: [{ title: "Gateways | Mousefy" }] }),
  component: SalesIntegrations,
});

function SalesIntegrations() {
  const query = useSalesOverview(30, null);
  const { canExecute } = usePlanAccess();
  return (
    <>
      <SalesPageHeader
        title="Gateways"
        subtitle="Conecte seus gateways e receba vendas automaticamente no dashboard."
      />
      {canExecute && query.isPending && (
        <p className="sales-panel p-5 text-sm text-muted-foreground" role="status">
          Carregando conexões…
        </p>
      )}
      {query.isError && (
        <div
          className="sales-panel flex flex-wrap items-center justify-between gap-3 p-5"
          role="alert"
        >
          Não foi possível carregar as integrações.
          <button
            className="sales-button sales-button-outline"
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {(query.data || !canExecute) && <SalesConnections links={query.data?.links ?? []} />}
    </>
  );
}
