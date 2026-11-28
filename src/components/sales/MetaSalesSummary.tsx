import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePlanAccess, usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import { salesMoney, type SalesPeriod } from "@/lib/sales-events";
import { postkitOverviewPeriod } from "@/lib/postkit-overview-period";
const brl = (value: number) => salesMoney(Math.round(value * 100));
import { getMetaAdsReport } from "@/lib/meta-ads/functions";

export function MetaSalesSummary({ period }: { period: SalesPeriod }) {
  const { user } = usePlatformAccess();
  const { canExecute } = usePlanAccess();
  const load = useServerFn(getMetaAdsReport);
  const { start: from, end: until } = postkitOverviewPeriod("America/Sao_Paulo", period);
  const query = useQuery({
    queryKey: ["scalehot-meta-report", user?.id, from, until],
    queryFn: () => load({ data: { from, until } }),
    enabled: canExecute && Boolean(user),
    retry: false,
    refetchInterval: 30_000,
  });
  const data = query.data;
  if (!user || !data || (!data.approved && !data.sent && !data.test_sent && !data.failed))
    return null;
  return (
    <Card className="bg-gradient-card p-5 mt-6 space-y-4" aria-labelledby="meta-sales-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="meta-sales-heading"
            className="font-display font-bold text-lg flex items-center gap-2"
          >
            <Zap className="size-4 text-primary" aria-hidden="true" /> Vendas do Meta Ads
          </h2>
          <p className="text-sm text-muted-foreground">
            Pagamentos confirmados no webhook Syncpay.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/vendas/conexoes" search={{ aba: "pixels" }}>
            Configurar Pixels
          </Link>
        </Button>
      </div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-sm text-muted-foreground">Vendas atribuídas</dt>
          <dd className="text-xl font-bold">{data.attributed}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Receita atribuída</dt>
          <dd className="text-xl font-bold">{brl(data.revenue)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Sem atribuição</dt>
          <dd className="text-xl font-bold">{data.approved - data.attributed}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Eventos aceitos pela Meta</dt>
          <dd className="text-xl font-bold">{data.sent}</dd>
        </div>
      </dl>
      {data.failed > 0 && (
        <p className="text-sm text-destructive">{data.failed} eventos com falha no envio à Meta.</p>
      )}
      {data.test_sent > 0 && (
        <p className="text-sm text-muted-foreground">
          {data.test_sent} eventos enviados em modo de teste.
        </p>
      )}
      {data.campaigns.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[26rem] text-sm text-left">
            <thead className="text-muted-foreground">
              <tr>
                <th scope="col" className="py-2">
                  Campanha
                </th>
                <th scope="col">Anúncio</th>
                <th scope="col" className="text-right">
                  Vendas
                </th>
                <th scope="col" className="text-right">
                  Receita
                </th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((row) => (
                <tr
                  key={JSON.stringify([row.campaign_id, row.ad_id])}
                  className="border-t border-border"
                >
                  <td className="py-2 pr-3">{row.campaign_id ?? "—"}</td>
                  <td className="pr-3">{row.ad_id ?? "—"}</td>
                  <td className="text-right">{row.sales}</td>
                  <td className="text-right whitespace-nowrap">{brl(row.gross)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
