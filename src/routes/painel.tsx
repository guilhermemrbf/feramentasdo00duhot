import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import { dashboardGreeting } from "@/lib/dashboard-greeting";
import { SalesDashboard } from "@/components/sales/SalesDashboard";
import { AutomaticPostOverview } from "@/components/postkit/AutomaticPostOverview";

export const Route = createFileRoute("/painel")({
  head: () => ({ meta: [{ title: "Dashboard | Mousefy" }] }),
  component: WorkspaceHome,
});

function WorkspaceHome() {
  const { status, user, offsetMs } = usePlatformAccess();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const toolsLink = (
    <Link
      to="/ferramentas"
      className="workspace-primary-action mt-6 inline-flex min-h-11 items-center gap-2 rounded-[var(--control-radius)] px-4 text-sm font-semibold"
    >
      Ver todas as ferramentas <ArrowUpRight size={17} aria-hidden />
    </Link>
  );
  return (
    <AppShell>
      <main className="workspace-overview mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-9">
        <header className="operate-heading workspace-dashboard-heading brand-stage">
          <div>
            <h1>{dashboardGreeting(new Date(now + offsetMs), user, status === "admin")}</h1>
            <p>Acompanhe publicações, vendas e campanhas da sua operação.</p>
            {status === "approved" && (
              <Link to="/assinatura" className="mt-2 inline-block text-sm underline">
                Gerenciar assinatura
              </Link>
            )}
          </div>
        </header>
        {status === "admin" || status === "approved" ? (
          <SalesDashboard
            embedded
            renderOverview={(period, salesMetrics) => (
              <AutomaticPostOverview period={period} salesMetrics={salesMetrics} />
            )}
          >
            {toolsLink}
          </SalesDashboard>
        ) : (
          toolsLink
        )}
      </main>
    </AppShell>
  );
}
