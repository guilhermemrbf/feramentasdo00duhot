import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSalesWebhook } from "@/lib/api/sales.functions";
import {
  SALES_CONNECTION_PROVIDERS,
  SALES_PROVIDERS,
  type SalesConnectionProvider,
} from "@/lib/sales-events";
import { IntegrationCopyField } from "./IntegrationCopyField";
import { useSalesOverview } from "./SalesSummary";
import { TrackingStores } from "./TrackingStores";

export function WebhookCredentials() {
  const [open, setOpen] = useState(false);
  const load = useSalesOverview(30, null);
  const create = useServerFn(createSalesWebhook);
  const client = useQueryClient();
  const generated = useMutation({
    mutationFn: (data: { label: string; provider: SalesConnectionProvider }) => create({ data }),
    gcTime: 0,
    onSuccess: () => void client.invalidateQueries({ queryKey: ["sales-overview"] }),
  });
  const links = load.data?.links.filter((link) =>
    SALES_CONNECTION_PROVIDERS.some((provider) => provider === link.provider),
  );

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
          {!open && (
            <Button type="button" className="min-h-11" onClick={() => setOpen(true)}>
              <Plus aria-hidden="true" /> Adicionar credencial
            </Button>
          )}
        </div>
        {open && !generated.data && (
          <form
            className="mt-5 grid gap-3 rounded-xl border border-border bg-background/60 p-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const fields = new FormData(event.currentTarget);
              const provider = SALES_CONNECTION_PROVIDERS.find(
                (item) => item === fields.get("provider"),
              );
              const label = String(fields.get("label") ?? "").trim();
              if (provider && label && !generated.isPending) generated.mutate({ provider, label });
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
            <div className="grid gap-1.5 text-sm font-medium">
              <label htmlFor="webhook-gateway">Gateway</label>
              <select
                id="webhook-gateway"
                name="provider"
                required
                defaultValue=""
                className="field min-h-11"
              >
                <option value="" disabled>
                  Selecione
                </option>
                {SALES_CONNECTION_PROVIDERS.map((provider) => (
                  <option value={provider} key={provider}>
                    {SALES_PROVIDERS[provider]}
                  </option>
                ))}
              </select>
            </div>
            {generated.error && (
              <p className="text-sm text-destructive sm:col-span-2" role="alert">
                {generated.error.message}
              </p>
            )}
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button className="min-h-11" disabled={generated.isPending}>
                {generated.isPending ? "Gerando…" : "Gerar token"}
              </Button>
              <Button
                className="min-h-11"
                type="button"
                variant="outline"
                disabled={generated.isPending}
                onClick={() => {
                  setOpen(false);
                  generated.reset();
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
        {generated.data && (
          <div className="mt-5 grid min-w-0 gap-4 rounded-xl border border-border bg-background/60 p-4">
            <p className="flex items-start gap-2 text-sm font-medium">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-brand-red" aria-hidden="true" />
              Copie o token agora. Ele só aparece nesta tela.
            </p>
            <IntegrationCopyField label="Token de API" value={generated.data.token} />
            <IntegrationCopyField label="URL do webhook" value={generated.data.endpoint} />
            <p className="text-sm text-muted-foreground">
              Cole a URL e o token no gateway. Se ele pedir o cabeçalho, use
              <code className="ml-1">Authorization: Bearer</code> seguido do token.
            </p>
            <details className="text-sm text-muted-foreground">
              <summary className="min-h-11 cursor-pointer content-center">
                Meu gateway só aceita uma URL
              </summary>
              <IntegrationCopyField label="URL com token" value={generated.data.url} />
            </details>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 justify-self-start"
              onClick={() => {
                generated.reset();
                setOpen(false);
              }}
            >
              Concluir
            </Button>
          </div>
        )}
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
                </li>
              ))}
            </ul>
          )}
        </div>
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
