import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { usePlanAccess, usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import {
  beginGoogleAdsConnection,
  disconnectGoogleAds,
  getGoogleAdsStatus,
  getGoogleAdSpend,
} from "@/lib/api/google-integrations.functions";

const callbackMessages: Record<string, string> = {
  configuration: "A integração do Google Ads ainda não está configurada neste ambiente.",
  session: "A autorização expirou. Inicie a conexão novamente.",
  denied: "O Google não concedeu as permissões necessárias.",
  empty: "O Google não retornou contas de anúncios para este login.",
  unavailable: "Não foi possível concluir a conexão com o Google. Tente novamente.",
};
const number = new Intl.NumberFormat("pt-BR");
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });

export function GoogleAdsConnection({ result }: { result?: string }) {
  const { user } = usePlatformAccess();
  const { canExecute, requirePlan } = usePlanAccess();
  const load = useServerFn(getGoogleAdsStatus);
  const begin = useServerFn(beginGoogleAdsConnection);
  const disconnect = useServerFn(disconnectGoogleAds);
  const fetchSpend = useServerFn(getGoogleAdSpend);
  const [account, setAccount] = useState("");
  const [days, setDays] = useState<7 | 30>(7);
  const status = useQuery({
    queryKey: ["scalehot-google-ads", user?.id],
    queryFn: () => load(),
    enabled: canExecute && Boolean(user),
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
  const error = start.error ?? report.error ?? revoke.error;
  const busy = start.isPending || revoke.isPending || report.isPending;
  const selectable = connection?.status === "connected";
  const totals = report.data?.totals;

  return (
    <section className="sales-panel space-y-4 p-5" aria-labelledby="tracking-google-ads">
      <div>
        <h2 id="tracking-google-ads" className="text-lg font-semibold">
          Google Ads
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Consulte gastos, cliques e impressões das contas que você autorizar no Google.
        </p>
      </div>
      {result && callbackMessages[result] && (
        <p role="alert" className="text-sm text-destructive">
          {callbackMessages[result]}
        </p>
      )}
      {canExecute && status.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Verificando conexão…
        </p>
      )}
      {canExecute && status.isError && (
        <Button type="button" variant="outline" onClick={() => void status.refetch()}>
          Verificar conexão novamente
        </Button>
      )}
      {connection?.status === "unconfigured" && (
        <p className="text-sm text-muted-foreground">
          A conexão aguarda a configuração do Google Ads neste ambiente.
        </p>
      )}
      {!canExecute && <Button type="button" onClick={requirePlan}>Conectar Google Ads</Button>}
      {canExecute && connection && connection.status !== "unconfigured" && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="min-h-11"
            variant={selectable ? "outline" : "default"}
            disabled={busy}
            onClick={() => start.mutate()}
          >
            {start.isPending
              ? "Abrindo o Google…"
              : connection.status === "disconnected"
                ? "Conectar Google Ads"
                : "Reconectar Google Ads"}
          </Button>
          {connection.status !== "disconnected" && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() => revoke.mutate()}
            >
              {revoke.isPending ? "Desconectando…" : "Desconectar Google Ads"}
            </Button>
          )}
        </div>
      )}
      {selectable && (
        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            if (account && !busy) report.mutate();
          }}
        >
          <div className="grid gap-1 text-sm font-medium">
            <label htmlFor="scalehot-google-account">Conta do Google Ads</label>
            <select
              id="scalehot-google-account"
              className="field min-h-11"
              value={account}
              required
              disabled={busy}
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
          <div className="grid gap-1 text-sm font-medium">
            <label htmlFor="scalehot-google-period">Período</label>
            <select
              id="scalehot-google-period"
              className="field min-h-11"
              value={days}
              disabled={busy}
              onChange={(event) => {
                setDays(event.target.value === "30" ? 30 : 7);
                report.reset();
              }}
            >
              <option value={7}>7 dias completos</option>
              <option value={30}>30 dias completos</option>
            </select>
          </div>
          <Button
            variant="outline"
            className="min-h-11 justify-self-start"
            disabled={!account || busy}
          >
            {report.isPending ? "Consultando…" : "Consultar Google Ads"}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
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
                <dd className="font-semibold tabular-nums">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: report.data.account.currency,
                  }).format(totals.spend)}
                </dd>
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
              O Google não retornou métricas para esta conta no período.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
