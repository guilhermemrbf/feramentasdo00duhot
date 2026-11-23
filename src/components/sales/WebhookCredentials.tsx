import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createSalesWebhook, disableSalesWebhook } from "@/lib/api/sales.functions";
import { SALES_PROVIDERS } from "@/lib/sales-events";
import { IntegrationCopyField } from "./IntegrationCopyField";
import { useSalesOverview } from "./SalesSummary";
import { TrackingStores } from "./TrackingStores";

const sampleSale = JSON.stringify(
  {
    transaction_id: "loja-123",
    status: "approved",
    currency: "BRL",
    amount_cents: 400,
    net_cents: 350,
  },
  null,
  2,
);

export function WebhookCredentials() {
  const [open, setOpen] = useState(false);
  const load = useSalesOverview(30, null);
  const create = useServerFn(createSalesWebhook);
  const disable = useServerFn(disableSalesWebhook);
  const client = useQueryClient();
  const generated = useMutation({
    mutationFn: (label: string) => create({ data: { label } }),
    gcTime: 0,
    onSuccess: () => void client.invalidateQueries({ queryKey: ["sales-overview"] }),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => disable({ data: { id } }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["sales-overview"] }),
  });
  const links = load.data?.links;

  return (
    <div className="space-y-5">
      <section className="sales-panel min-w-0 p-5 sm:p-6" aria-labelledby="webhook-credentials">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="webhook-credentials" className="text-lg font-semibold">
              Credenciais de API
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Receba vendas e estornos do seu gateway no ScaleHot.
            </p>
          </div>
          <Dialog
            open={open}
            onOpenChange={(next) => {
              if (!next && generated.isPending) return;
              if (!next) generated.reset();
              setOpen(next);
            }}
          >
            <DialogTrigger asChild>
              <Button type="button" className="min-h-11">
                <Plus aria-hidden="true" /> Adicionar credencial
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl">
              <DialogHeader>
                <DialogTitle>
                  {generated.data ? "Credencial criada" : "Criar credencial de API"}
                </DialogTitle>
                <DialogDescription>
                  {generated.data
                    ? "Copie o token agora. Ele só aparece uma vez."
                    : "Dê um nome para identificar a integração no ScaleHot."}
                </DialogDescription>
              </DialogHeader>
              {generated.data ? (
                <div className="grid min-w-0 gap-4">
                  <div className="flex items-start gap-2">
                    <KeyRound
                      className="mt-0.5 size-4 shrink-0 text-brand-red"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <IntegrationCopyField label="Token de API" value={generated.data.token} />
                    </div>
                  </div>
                  <IntegrationCopyField label="URL do webhook" value={generated.data.endpoint} />
                  <p className="text-sm text-muted-foreground">
                    Cole a URL e o token no gateway. Se ele pedir um cabeçalho, selecione{" "}
                    <code>x-api-token</code>.
                  </p>
                  <details className="text-sm text-muted-foreground">
                    <summary className="min-h-11 cursor-pointer content-center">
                      Meu gateway só aceita uma URL
                    </summary>
                    <IntegrationCopyField label="URL com token" value={generated.data.url} />
                  </details>
                  <DialogFooter>
                    <Button
                      type="button"
                      className="min-h-11"
                      onClick={() => {
                        generated.reset();
                        setOpen(false);
                      }}
                    >
                      Concluir
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <form
                  className="grid gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const label = String(
                      new FormData(event.currentTarget).get("label") ?? "",
                    ).trim();
                    if (label && !generated.isPending) generated.mutate(label);
                  }}
                >
                  <label className="grid gap-1.5 text-sm font-medium">
                    Nome da credencial
                    <Input
                      name="label"
                      placeholder="Ex.: Minha loja"
                      maxLength={80}
                      required
                      className="h-11"
                    />
                  </label>
                  {generated.error && (
                    <p className="text-sm text-destructive" role="alert">
                      {generated.error.message}
                    </p>
                  )}
                  <DialogFooter>
                    <Button
                      className="min-h-11"
                      type="button"
                      variant="outline"
                      disabled={generated.isPending}
                      onClick={() => {
                        generated.reset();
                        setOpen(false);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button className="min-h-11" disabled={generated.isPending}>
                      {generated.isPending ? "Criando…" : "Criar credencial"}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
        <div className="mt-5 border-t border-border pt-4">
          {load.isPending && (
            <p role="status" className="text-sm text-muted-foreground">
              Carregando credenciais…
            </p>
          )}
          {load.isError && (
            <Button variant="outline" onClick={() => void load.refetch()}>
              Tentar carregar novamente
            </Button>
          )}
          {links?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma credencial cadastrada.</p>
          )}
          {links && links.length > 0 && (
            <ul className="divide-y divide-border">
              {links.map((link) => (
                <li
                  key={link.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <span className="min-w-0 break-words text-sm font-medium">
                    {link.label}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {SALES_PROVIDERS[link.provider]}
                    </span>
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={
                        link.active && link.last_event_at
                          ? "text-sm text-success"
                          : "text-sm text-muted-foreground"
                      }
                    >
                      {!link.active
                        ? "Desativada"
                        : link.last_event_at
                          ? "Recebendo eventos"
                          : "Aguardando evento"}
                    </span>
                    {link.provider === "custom" && link.active && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={revoke.isPending}
                        aria-label={"Desativar credencial " + link.label}
                        onClick={() => revoke.mutate(link.id)}
                      >
                        Desativar
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {revoke.error && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {revoke.error.message}
            </p>
          )}
        </div>
        <details className="mt-5 border-t border-border pt-2 text-sm text-muted-foreground">
          <summary className="min-h-11 cursor-pointer content-center">
            Formato para webhook personalizado
          </summary>
          <p className="mb-3">
            Envie os valores em centavos. Use o mesmo identificador da venda ao enviar estorno,
            chargeback ou MED. Se o gateway envia outro formato, mapeie os campos antes do envio.
          </p>
          <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs">
            {sampleSale}
          </pre>
        </details>
      </section>
      <details className="sales-panel min-w-0 p-5">
        <summary className="min-h-11 cursor-pointer content-center font-semibold">
          Vincular uma loja para rastrear campanhas
        </summary>
        <div className="pt-3">
          <TrackingStores />
        </div>
      </details>
    </div>
  );
}
