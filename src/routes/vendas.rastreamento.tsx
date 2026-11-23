import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowUpRight, ChartNoAxesCombined, Copy, Link2, Settings2 } from "lucide-react";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import { MetaAdsConnection } from "@/components/sales/MetaAdsConnection";
import { TrackingReport } from "@/components/sales/TrackingReport";
import { useSalesOverview } from "@/components/sales/SalesSummary";
import {
  createTrackingSource,
  disableTrackingSource,
  trackingOverview,
} from "@/lib/api/tracking.functions";
import "@/components/sales/tracking-report.css";

export const Route = createFileRoute("/vendas/rastreamento")({
  head: () => ({ meta: [{ title: "Rastreamento de vendas · ScaleHot | MouseHot" }] }),
  validateSearch: (search: Record<string, unknown>): { meta?: string; view?: "integracoes" } => ({
    meta: typeof search.meta === "string" ? search.meta : undefined,
    view: search.view === "integracoes" ? "integracoes" : undefined,
  }),
  component: TrackingPage,
});

const fieldClass =
  "min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary";
const date = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function TrackingPage() {
  const { meta, view } = Route.useSearch();
  const integrations = view === "integracoes" || Boolean(meta);
  const { user } = usePlatformAccess();
  const load = useServerFn(trackingOverview);
  const create = useServerFn(createTrackingSource);
  const disable = useServerFn(disableTrackingSource);
  const [gateway, setGateway] = useState("");
  const [origin, setOrigin] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [days, setDays] = useState<7 | 14 | 30>(30);
  const [breakdown, setBreakdown] = useState<"campaign" | "ad">("campaign");
  const gateways = useSalesOverview(30, null);
  const query = useQuery({
    queryKey: ["sales-tracking", user?.id, days, breakdown],
    queryFn: () => load({ data: { days, breakdown } }),
    enabled: Boolean(user),
    refetchInterval: 15_000,
  });
  const setup = useMutation({
    gcTime: 0,
    mutationFn: () => create({ data: { gateway, origin } }),
    onSuccess: () => {
      setOrigin("");
      setCopyMessage("");
      void query.refetch();
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => disable({ data: { id } }),
    onSuccess: (_, id) => {
      if (setup.data?.id === id) {
        setup.reset();
        setCopyMessage("");
      }
      void query.refetch();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (gateway && origin.trim() && !setup.isPending && !setup.data) setup.mutate();
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(label + " copiado.");
    } catch {
      setCopyMessage("Selecione o valor no campo e copie manualmente.");
    }
  }

  const activeGateways = gateways.data?.links.filter((link) => link.active) ?? [];
  return (
    <div className="tracking-workspace">
      <Link
        to="/vendas"
        className="tracking-back inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Dashboard do ScaleHot
      </Link>
      <header className="tracking-header">
        <h1>Rastreamento de vendas</h1>
        <p>
          {integrations
            ? "Configure as fontes que ligam o clique ao pagamento."
            : "Acompanhe a receita e descubra quais campanhas geraram vendas."}
        </p>
      </header>
      <nav className="tracking-nav" aria-label="Áreas de rastreamento">
        <Link
          to="/vendas/rastreamento"
          search={{}}
          activeOptions={{ exact: true }}
          aria-current={!integrations ? "page" : undefined}
        >
          <ChartNoAxesCombined size={17} aria-hidden="true" /> Desempenho
        </Link>
        <Link
          to="/vendas/rastreamento"
          search={{ view: "integracoes" }}
          activeOptions={{ exact: true }}
          aria-current={integrations ? "page" : undefined}
        >
          <Settings2 size={17} aria-hidden="true" /> Integrações
        </Link>
      </nav>
      {!integrations ? (
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
      ) : (
        <div className="tracking-settings grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
          <div className="min-w-0 space-y-5">
            <section className="sales-panel p-5" aria-labelledby="tracking-sources">
              <h2 className="mb-4 text-lg font-semibold" id="tracking-sources">
                Domínios configurados
              </h2>
              {query.data?.sources.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Adicione o domínio da sua loja para receber os primeiros cliques.
                </p>
              )}
              {query.isError && (
                <p role="alert" className="text-sm text-destructive">
                  Não foi possível carregar os domínios.
                </p>
              )}
              <ul className="divide-y divide-border">
                {query.data?.sources.map((source) => (
                  <li
                    key={source.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0 break-words">
                      <p className="font-medium">{source.origin}</p>
                      <p className="text-sm text-muted-foreground">
                        {source.label} ·{" "}
                        {!source.active
                          ? "Desativado"
                          : !source.gateway_active
                            ? "Gateway inativo"
                            : source.last_click_at
                              ? "Último clique " + date.format(new Date(source.last_click_at))
                              : "Aguardando o primeiro clique"}
                      </p>
                    </div>
                    {source.active && (
                      <button
                        type="button"
                        className="sales-button sales-button-outline"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(source.id)}
                        aria-label={"Desativar " + source.origin}
                      >
                        Desativar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {revoke.isError && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {revoke.error.message}
                </p>
              )}
            </section>
            <MetaAdsConnection result={meta} />
            <Link
              to="/vendas/integracoes"
              hash="pixels"
              className="sales-button sales-button-outline"
            >
              Configurar Pixel da Meta
            </Link>
          </div>
          <section className="sales-panel min-w-0 self-start p-5" aria-labelledby="tracking-setup">
            <h2 className="flex items-center gap-2 text-lg font-semibold" id="tracking-setup">
              <Link2 size={18} aria-hidden="true" /> Vincular loja
            </h2>
            <p className="mb-5 mt-2 text-sm leading-relaxed text-muted-foreground">
              Escolha o gateway que recebe os pedidos e informe o domínio onde o cliente chega antes
              de comprar.
            </p>
            {gateways.isError && (
              <p role="alert" className="text-sm text-destructive">
                Não foi possível carregar seus gateways.
              </p>
            )}
            {gateways.data && !activeGateways.length && (
              <Link to="/vendas/integracoes" className="sales-button sales-button-outline">
                Conectar gateway <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            )}
            {activeGateways.length > 0 && !setup.data && (
              <form className="space-y-4" onSubmit={submit}>
                <div className="space-y-1.5">
                  <label htmlFor="tracking-gateway" className="block text-sm font-medium">
                    Gateway
                  </label>
                  <select
                    id="tracking-gateway"
                    className={fieldClass}
                    value={gateway}
                    onChange={(event) => setGateway(event.target.value)}
                    required
                  >
                    <option value="">Selecione</option>
                    {activeGateways.map((link) => (
                      <option key={link.id} value={link.id}>
                        {link.label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="block space-y-1.5 text-sm font-medium">
                  <span>Domínio da loja</span>
                  <input
                    className={fieldClass}
                    type="url"
                    value={origin}
                    onChange={(event) => setOrigin(event.target.value)}
                    placeholder="https://sualoja.com.br"
                    maxLength={255}
                    required
                  />
                </label>
                <button type="submit" className="sales-button w-full" disabled={setup.isPending}>
                  {setup.isPending ? "Criando integração…" : "Gerar credenciais da loja"}
                </button>
              </form>
            )}
            {setup.isError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {setup.error.message}
              </p>
            )}
            {setup.data && (
              <div className="space-y-4 border-t border-border pt-4">
                <p className="text-sm leading-relaxed">
                  Configure a URL e a chave no servidor da sua loja. Guarde a chave agora. Ela só é
                  exibida uma vez.
                </p>
                {[
                  { label: "URL", value: setup.data.endpoint },
                  { label: "Chave", value: setup.data.key },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <label className="block text-sm font-medium">
                      <span className="mb-1.5 block">{label}</span>
                      <input className={fieldClass} readOnly value={value} />
                    </label>
                    <button
                      type="button"
                      className="sales-button sales-button-outline mt-2"
                      onClick={() => void copy(value, label)}
                    >
                      <Copy size={15} aria-hidden="true" /> Copiar {label.toLowerCase()}
                    </button>
                  </div>
                ))}
                <p role="status" className="text-sm text-muted-foreground">
                  {copyMessage}
                </p>
                <button
                  type="button"
                  className="sales-button sales-button-outline"
                  onClick={() => setup.reset()}
                >
                  Fechar credenciais
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
