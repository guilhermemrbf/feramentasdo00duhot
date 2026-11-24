import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Link2, Megaphone, RadioTower, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SalesPageHeader } from "@/components/sales/SalesLayout";
import { MetaAdsConnection } from "@/components/sales/MetaAdsConnection";
import { GoogleAdsConnection } from "@/components/sales/GoogleAdsConnection";
import { WebhookCredentials } from "@/components/sales/WebhookCredentials";
import { Pixels } from "@/components/sales/Pixels";
import { GooglePixels } from "@/components/sales/GooglePixels";
import { TrackingStores } from "@/components/sales/TrackingStores";
import { SalesRank } from "@/components/sales/ScaleHotOverview";
import { useScaleHotOperation } from "@/components/sales/useScaleHotOperation";
import { useState } from "react";

const pages = [
  { id: "anuncios", label: "Anúncios", icon: Megaphone },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "utms", label: "UTMs", icon: Link2 },
  { id: "pixels", label: "Pixels", icon: RadioTower },
  { id: "testes", label: "Testes", icon: Activity },
] as const;

export const Route = createFileRoute("/vendas/conexoes")({
  head: () => ({ meta: [{ title: "Integrações · ScaleHot | MouseHot" }] }),
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    aba?: (typeof pages)[number]["id"];
    meta?: string;
    google?: string;
  } => ({
    aba: pages.find(({ id }) => id === search.aba)?.id,
    meta: typeof search.meta === "string" ? search.meta : undefined,
    google: typeof search.google === "string" ? search.google : undefined,
  }),
  component: ScaleHotIntegrations,
});

function ScaleHotIntegrations() {
  const search = Route.useSearch();
  const active = search.aba ?? "anuncios";
  return (
    <>
      <SalesPageHeader
        title="Integrações"
        subtitle="Conecte anúncios, recebimentos e conversões ao ScaleHot."
      />
      <nav aria-label="Áreas de integrações" className="scalehot-tabs mb-6">
        {pages.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            to="/vendas/conexoes"
            search={{ aba: id === "anuncios" ? undefined : id }}
            aria-current={active === id ? "page" : undefined}
          >
            <Icon className="size-4" aria-hidden="true" /> {label}
          </Link>
        ))}
      </nav>
      {active === "anuncios" && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <MetaAdsConnection result={search.meta} />
          <GoogleAdsConnection result={search.google} />
        </div>
      )}
      {active === "webhooks" && <WebhookCredentials />}
      {active === "utms" && <UtmSettings />}
      {active === "pixels" && <PixelIntegrations />}
      {active === "testes" && <IntegrationTests />}
    </>
  );
}

export function PixelIntegrations() {
  const [adding, setAdding] = useState(false);
  const [provider, setProvider] = useState<"meta" | "google" | null>(null);
  return (
    <section className="space-y-5" aria-labelledby="pixels-setup">
      <div className="sales-panel flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div>
          <h2 id="pixels-setup" className="text-lg font-semibold">
            Configuração de conversões
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure um Pixel da Meta ou uma tag do Google Ads.
          </p>
        </div>
        <Button
          type="button"
          className="min-h-11"
          aria-expanded={adding}
          onClick={() => {
            setAdding(!adding);
            setProvider(null);
          }}
        >
          {adding ? "Fechar cadastro" : "Adicionar pixel"}
        </Button>
        {adding && (
          <div
            className="flex w-full flex-wrap gap-2 border-t border-border pt-4"
            aria-label="Plataforma do pixel"
          >
            <Button
              type="button"
              variant={provider === "meta" ? "default" : "outline"}
              aria-pressed={provider === "meta"}
              onClick={() => setProvider("meta")}
            >
              Meta Ads
            </Button>
            <Button
              type="button"
              variant={provider === "google" ? "default" : "outline"}
              aria-pressed={provider === "google"}
              onClick={() => setProvider("google")}
            >
              Google Ads
            </Button>
          </div>
        )}
      </div>
      <Pixels showCreate={provider === "meta"} />
      <GooglePixels showCreate={provider === "google"} />
    </section>
  );
}

function UtmSettings() {
  const { operation } = useScaleHotOperation("30d");
  const [copyStatus, setCopyStatus] = useState("");
  const template =
    "utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&mh_campaign_id={{campaign.id}}&mh_ad_id={{ad.id}}";
  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(template);
      setCopyStatus("UTMs copiadas.");
    } catch {
      setCopyStatus("Não foi possível copiar. Selecione o texto do modelo.");
    }
  };
  return (
    <div className="grid gap-4">
      <section className="sales-panel grid gap-4 p-5">
        <div>
          <h2 className="font-semibold">UTMs da MouseHot</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Identifique a origem, o meio e a campanha no link. O checkout deve vincular o clique ao
            mesmo pedido recebido pelo webhook.
          </p>
        </div>
        <dl className="grid gap-2 break-words text-sm sm:grid-cols-2">
          <div>
            <dt>
              <code>utm_source</code>
            </dt>
            <dd className="text-muted-foreground">Origem do clique</dd>
          </div>
          <div>
            <dt>
              <code>utm_medium</code>
            </dt>
            <dd className="text-muted-foreground">Canal de aquisição</dd>
          </div>
          <div>
            <dt>
              <code>utm_campaign</code>
            </dt>
            <dd className="text-muted-foreground">Nome da campanha</dd>
          </div>
          <div>
            <dt>
              <code>mh_campaign_id</code> e <code>mh_ad_id</code>
            </dt>
            <dd className="text-muted-foreground">IDs da campanha e do anúncio</dd>
          </div>
        </dl>
        <div className="grid gap-2">
          <h3 className="font-semibold">Modelo para Meta Ads</h3>
          <code className="rounded-md border border-border bg-background p-3 text-sm wrap-anywhere">
            {template}
          </code>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="justify-self-start"
              variant="outline"
              type="button"
              onClick={() => void copyTemplate()}
            >
              Copiar UTMs
            </Button>
            <span className="text-sm text-muted-foreground" role="status">
              {copyStatus}
            </span>
          </div>
        </div>
      </section>
      <TrackingStores />
      <SalesRank title="Atribuição recente · 30 dias" entries={operation.data?.campaigns} />
    </div>
  );
}

function IntegrationTests() {
  const { sales } = useScaleHotOperation("30d");
  const links = sales.data?.links.filter(({ active }) => active);
  return (
    <section className="sales-panel p-5">
      <h2 className="font-semibold">Recebimento de webhooks</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Envie um teste no painel do seu gateway e atualize a lista para confirmar o recebimento.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          variant="outline"
          type="button"
          disabled={sales.isFetching}
          onClick={() => void sales.refetch()}
        >
          Atualizar status
        </Button>
        <Link to="/vendas/eventos" className="sales-button sales-button-outline">
          Abrir eventos
        </Link>
      </div>
      {links?.length ? (
        <ul className="mt-4 divide-y divide-border">
          {links.map(({ id, label, last_event_at }) => (
            <li key={id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <strong>{label}</strong>
              <span className="text-muted-foreground">
                {last_event_at
                  ? "Último recebimento: " +
                    new Date(last_event_at).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })
                  : "Aguardando evento"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="scalehot-empty">
          {sales.isPending
            ? "Consultando…"
            : sales.isError
              ? "Status indisponível"
              : "Nenhum webhook ativo"}
        </p>
      )}
    </section>
  );
}
