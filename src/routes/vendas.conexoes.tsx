import { createFileRoute, Link } from "@tanstack/react-router";
import { Megaphone, RadioTower, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SalesPageHeader } from "@/components/sales/SalesLayout";
import { MetaAdsConnection } from "@/components/sales/MetaAdsConnection";
import { GoogleAdsConnection } from "@/components/sales/GoogleAdsConnection";
import { WebhookCredentials } from "@/components/sales/WebhookCredentials";
import { Pixels } from "@/components/sales/Pixels";
import { GooglePixels } from "@/components/sales/GooglePixels";
import { useState } from "react";

const pages = [
  { id: "anuncios", label: "Anúncios", icon: Megaphone },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "pixels", label: "Pixels", icon: RadioTower },
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
      <nav
        aria-label="Áreas de integrações"
        className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3"
      >
        {pages.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            to="/vendas/conexoes"
            search={{ aba: id === "anuncios" ? undefined : id }}
            aria-current={active === id ? "page" : undefined}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-primary/15 aria-[current=page]:text-brand-red sm:px-4"
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
      {active === "pixels" && <PixelIntegrations />}
    </>
  );
}

function PixelIntegrations() {
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
