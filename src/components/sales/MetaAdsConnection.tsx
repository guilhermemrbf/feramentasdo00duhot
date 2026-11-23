import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import {
  beginMetaAdsConnection,
  disconnectMetaAds,
  getMetaAdsStatus,
  getMetaAdSpend,
} from "@/lib/api/tracking.functions";

const callbackMessages: Record<string, string> = {
  configuration: "A integração de anúncios ainda não está configurada neste ambiente.",
  session: "A autorização expirou. Inicie a conexão novamente.",
  denied: "A Meta não concedeu a permissão de leitura de anúncios.",
  empty: "A Meta não retornou contas de anúncios para esta autorização.",
  unavailable: "Não foi possível concluir a conexão com a Meta. Tente novamente.",
};

const number = new Intl.NumberFormat("pt-BR");
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });

export function MetaAdsConnection({ result }: { result?: string }) {
  const { user } = usePlatformAccess();
  const load = useServerFn(getMetaAdsStatus);
  const begin = useServerFn(beginMetaAdsConnection);
  const disconnect = useServerFn(disconnectMetaAds);
  const fetchSpend = useServerFn(getMetaAdSpend);
  const [account, setAccount] = useState("");
  const [days, setDays] = useState<7 | 30>(7);
  const status = useQuery({
    queryKey: ["scalehot-meta-ads", user?.id],
    queryFn: () => load(),
    enabled: Boolean(user),
  });
  const start = useMutation({
    mutationFn: () => begin(),
    onSuccess: (url) => window.location.assign(url),
  });
  const report = useMutation({ mutationFn: () => fetchSpend({ data: { account, days } }) });
  const revoke = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => {
      setAccount("");
      report.reset();
      void status.refetch();
    },
  });
  const connection = status.data;
  const reportError = start.error ?? report.error ?? revoke.error;
  const totals = report.data?.totals;
  const totalsLabel =
    totals && report.data
      ? new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: report.data.account.currency,
        }).format(totals.spend)
      : null;
  return (
    <section className="sales-panel space-y-4 p-5" aria-labelledby="tracking-meta-ads">
      <div>
        <h2 className="text-lg font-semibold" id="tracking-meta-ads">
          Meta Ads
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Consulte os gastos, cliques e impressões das contas de anúncios autorizadas.
        </p>
      </div>
      {result && callbackMessages[result] && (
        <p role="alert" className="text-sm text-destructive">
          {callbackMessages[result]}
        </p>
      )}
      {status.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Verificando conexão…
        </p>
      )}
      {status.isError && (
        <button
          className="sales-button sales-button-outline"
          type="button"
          onClick={() => void status.refetch()}
        >
          Verificar conexão novamente
        </button>
      )}
      {connection?.status === "unconfigured" && (
        <p className="text-sm text-muted-foreground">
          A conexão com a Meta aguarda a configuração do app neste ambiente.
        </p>
      )}
      {connection && connection.status !== "unconfigured" && (
        <div className="flex flex-wrap gap-2">
          <button
            className={
              connection.status === "connected"
                ? "sales-button sales-button-outline"
                : "sales-button"
            }
            type="button"
            disabled={start.isPending || revoke.isPending}
            onClick={() => start.mutate()}
          >
            {start.isPending
              ? "Abrindo a Meta…"
              : connection.status === "disconnected"
                ? "Conectar Meta Ads"
                : "Reconectar Meta Ads"}
          </button>
          {(connection.status === "connected" || connection.status === "expired") && (
            <button
              className="sales-button sales-button-outline"
              type="button"
              disabled={revoke.isPending || start.isPending || report.isPending}
              onClick={() => revoke.mutate()}
            >
              {revoke.isPending ? "Desconectando…" : "Desconectar"}
            </button>
          )}
        </div>
      )}
      {connection?.status === "expired" && (
        <p className="text-sm text-muted-foreground">
          A autorização expirou. Reconecte para consultar suas contas.
        </p>
      )}
      {connection?.status === "connected" && (
        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            if (account && !report.isPending) report.mutate();
          }}
        >
          <div className="space-y-1 text-sm">
            <label htmlFor="scalehot-meta-account" className="block font-medium">
              Conta de anúncios
            </label>
            <select
              id="scalehot-meta-account"
              className="min-h-11 w-full rounded-lg border border-border bg-background px-3"
              value={account}
              disabled={report.isPending}
              required
              onChange={(event) => {
                setAccount(event.target.value);
                report.reset();
              }}
            >
              <option value="">Selecione</option>
              {connection.accounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.currency}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 text-sm">
            <label htmlFor="scalehot-meta-period" className="block font-medium">
              Período
            </label>
            <select
              id="scalehot-meta-period"
              className="min-h-11 w-full rounded-lg border border-border bg-background px-3"
              value={days}
              disabled={report.isPending}
              onChange={(event) => {
                setDays(event.target.value === "30" ? 30 : 7);
                report.reset();
              }}
            >
              <option value={7}>7 dias completos</option>
              <option value={30}>30 dias completos</option>
            </select>
          </div>
          <button
            type="submit"
            className="sales-button sales-button-outline self-end"
            disabled={!account || report.isPending || revoke.isPending}
          >
            {report.isPending ? "Consultando…" : "Consultar"}
          </button>
        </form>
      )}
      {reportError && (
        <p role="alert" className="text-sm text-destructive">
          {reportError.message}
        </p>
      )}
      {report.data && (
        <div className="space-y-3 border-t border-border pt-4" role="status">
          <p className="text-xs text-muted-foreground">
            {date.format(new Date(report.data.since))} a {date.format(new Date(report.data.until))}{" "}
            · {report.data.account.timezone}
          </p>
          {totals ? (
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Gasto</dt>
                <dd className="font-semibold tabular-nums">{totalsLabel}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Cliques</dt>
                <dd className="font-semibold tabular-nums">{number.format(totals.clicks)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Impressões</dt>
                <dd className="font-semibold tabular-nums">{number.format(totals.impressions)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              A Meta não retornou métricas para esta conta no período.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
