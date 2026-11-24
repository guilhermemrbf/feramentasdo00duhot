import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Settings2 } from "lucide-react";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import { TrackingReport } from "@/components/sales/TrackingReport";
import { trackingOverview } from "@/lib/api/tracking.functions";
import "@/components/sales/tracking-report.css";

export const Route = createFileRoute("/vendas/rastreamento")({
  head: () => ({ meta: [{ title: "Rastreamento de vendas · Traqueamento avançado | Mousefy" }] }),
  validateSearch: (search: Record<string, unknown>): { meta?: string; view?: "integracoes" } => ({
    meta: typeof search.meta === "string" ? search.meta : undefined,
    view: search.view === "integracoes" ? "integracoes" : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (search.meta || search.view) {
      throw redirect({
        to: "/vendas/conexoes",
        search: search.meta ? { meta: search.meta } : { aba: "webhooks" },
      });
    }
  },
  component: TrackingPage,
});

function TrackingPage() {
  const { user } = usePlatformAccess();
  const load = useServerFn(trackingOverview);
  const [days, setDays] = useState<7 | 14 | 30>(30);
  const [breakdown, setBreakdown] = useState<"campaign" | "ad">("campaign");
  const query = useQuery({
    queryKey: ["sales-tracking", user?.id, days, breakdown],
    queryFn: () => load({ data: { days, breakdown } }),
    enabled: Boolean(user),
    refetchInterval: 15_000,
  });
  return (
    <div className="tracking-workspace">
      <Link
        to="/vendas"
        className="tracking-back inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Resumo do traqueamento
      </Link>
      <header className="tracking-header">
        <h1>Rastreamento de vendas</h1>
        <p>Acompanhe a receita e descubra quais campanhas geraram vendas.</p>
      </header>
      <nav className="tracking-nav" aria-label="Configuração do rastreamento">
        <Link to="/vendas/conexoes">
          <Settings2 size={17} aria-hidden="true" /> Configurar integrações
        </Link>
      </nav>
      <TrackingReport
        data={query.data}
        pending={query.isPending}
        error={query.isError}
        refresh={() => void query.refetch()}
        refreshing={query.isFetching}
        days={days}
        changeDays={setDays}
        breakdown={breakdown}
        changeBreakdown={setBreakdown}
      />
    </div>
  );
}
