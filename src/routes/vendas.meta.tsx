import { createFileRoute, Link } from "@tanstack/react-router";
import { MetaAdsConnection } from "@/components/sales/MetaAdsConnection";
import { SalesPageHeader } from "@/components/sales/SalesLayout";
import { TrackingReport } from "@/components/sales/TrackingReport";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import { trackingOverview } from "@/lib/api/tracking.functions";
import { useState } from "react";
import "@/components/sales/tracking-report.css";

const tabs = [
  { id: "accounts", label: "Contas" },
  { id: "campaigns", label: "Campanhas" },
  { id: "ads", label: "Anúncios" },
] as const;
export const Route = createFileRoute("/vendas/meta")({
  head: () => ({ meta: [{ title: "Meta · Traqueamento avançado | Mousefy" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    tab: tabs.find((item) => item.id === search.tab)?.id ?? "accounts",
  }),
  component: MetaPage,
});

function MetaPage() {
  const { tab } = Route.useSearch();
  return (
    <div className="scalehot-dashboard">
      <SalesPageHeader
        title="Meta"
        subtitle="Consulte suas contas e a atribuição de campanha do módulo de traqueamento."
      />
      <nav className="scalehot-tabs" aria-label="Seções de anúncios Meta">
        {tabs.map(({ id, label }) => (
          <Link
            to="/vendas/meta"
            search={{ tab: id }}
            key={id}
            aria-current={id === tab ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "accounts" ? (
        <MetaAdsConnection />
      ) : (
        <MetaAttribution breakdown={tab === "ads" ? "ad" : "campaign"} />
      )}
    </div>
  );
}

function MetaAttribution({ breakdown }: { breakdown: "campaign" | "ad" }) {
  const { user } = usePlatformAccess();
  const navigate = Route.useNavigate();
  const [days, setDays] = useState<7 | 14 | 30>(30);
  const load = useServerFn(trackingOverview);
  const query = useQuery({
    queryKey: ["sales-tracking", user?.id, days, breakdown],
    enabled: Boolean(user),
    queryFn: () => load({ data: { days, breakdown } }),
  });
  const data = query.data;
  const rows = data?.campaigns.filter(({ source }) =>
    /^(meta|fb|ig|facebook|instagram)$/i.test(source ?? ""),
  );
  return (
    <div className="tracking-workspace">
      <TrackingReport
        data={data && rows && { ...data, campaigns: rows }}
        pending={query.isPending}
        error={query.isError}
        refresh={() => void query.refetch()}
        refreshing={query.isFetching}
        days={days}
        changeDays={setDays}
        breakdown={breakdown}
        changeBreakdown={(next) =>
          void navigate({ search: { tab: next === "ad" ? "ads" : "campaigns" } })
        }
      />
      <p className="mt-3 text-sm text-muted-foreground">
        A tabela filtra campanhas atribuídas à Meta. Os totais e o gráfico abrangem todas as
        origens.
      </p>
    </div>
  );
}
