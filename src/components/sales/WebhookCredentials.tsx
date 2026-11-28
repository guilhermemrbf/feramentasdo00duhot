import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Plus, Trash2, Webhook } from "lucide-react";
import { usePlanAccess, usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  archiveSalesWebhook,
  createSalesWebhook,
  listSalesWebhookCredentials,
} from "@/lib/api/sales.functions";
import { SALES_PROVIDERS } from "@/lib/sales-events";
import { IntegrationCopyField } from "./IntegrationCopyField";
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
  const { user } = usePlatformAccess();
  const { canExecute, requirePlan } = usePlanAccess();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; label: string } | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const removeButton = useRef<HTMLButtonElement | null>(null);
  const list = useServerFn(listSalesWebhookCredentials);
  const load = useQuery({
    queryKey: ["sales-webhook-credentials", user?.id],
    queryFn: () => list(),
    enabled: canExecute && Boolean(user),
  });
  const create = useServerFn(createSalesWebhook);
  const archive = useServerFn(archiveSalesWebhook);
  const client = useQueryClient();
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["sales-overview"] }),
      client.invalidateQueries({ queryKey: ["sales-webhook-credentials"] }),
    ]);
  const generated = useMutation({
    mutationFn: (label: string) => create({ data: { label } }),
    gcTime: 0,
    onSuccess: () => void refresh(),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => archive({ data: { id } }),
    onSuccess: async () => {
      await refresh();
      setRemoving(null);
    },
  });
  const links = load.data;

  return (
    <div className="space-y-5">
      <section className="sales-panel min-w-0 p-5 sm:p-6" aria-labelledby="webhook-credentials">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="webhook-credentials" className="text-lg font-semibold">
              Credenciais de API
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Receba vendas e estornos do seu gateway no módulo de traqueamento.
            </p>
          </div>
          <Dialog
            open={open}
            onOpenChange={(next) => {
              if (next && !requirePlan()) return;
              if (!next && generated.isPending) return;
              if (!next) generated.reset();
              setOpen(next);
            }}
          >
            <DialogTrigger asChild>
              <Button ref={addButton} type="button" className="min-h-11">
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
                    : "Dê um nome para identificar a integração no módulo de traqueamento."}
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
          {canExecute && load.isPending && (
            <p role="status" className="text-sm text-muted-foreground">
              Carregando credenciais…
            </p>
          )}
          {canExecute && load.isError && (
            <Button variant="outline" onClick={() => void load.refetch()}>
              Tentar carregar novamente
            </Button>
          )}
          {links?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma credencial cadastrada.</p>
          )}
          {links && links.length > 0 && (
            <ul
              aria-label="Webhooks cadastrados"
              className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-3"
            >
              {links.map((link) => (
                <li
                  key={link.id}
                  className="flex min-w-0 flex-col rounded-xl border border-border bg-background/45 p-4"
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-brand-red">
                      <Webhook aria-hidden="true" className="size-[18px]" />
                    </div>
                    <span
                      className={
                        link.active && link.last_event_at
                          ? "rounded-full bg-success/10 px-2 py-1 text-xs font-medium text-success"
                          : "rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"
                      }
                    >
                      {!link.active
                        ? "Desativada"
                        : link.last_event_at
                          ? "Recebendo eventos"
                          : "Aguardando evento"}
                    </span>
                  </div>
                  <h3 className="mt-3 break-words text-base font-semibold">{link.label}</h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {SALES_PROVIDERS[link.provider]}
                  </p>
                  {link.provider === "custom" && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-auto min-h-11 self-start px-2 text-muted-foreground hover:text-destructive"
                      disabled={revoke.isPending}
                      aria-label={"Excluir webhook " + link.label}
                      onClick={(event) => {
                        removeButton.current = event.currentTarget;
                        revoke.reset();
                        setRemoving(link);
                      }}
                    >
                      <Trash2 aria-hidden="true" /> Excluir
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <AlertDialog
          open={Boolean(removing)}
          onOpenChange={(next) => {
            if (!next && !revoke.isPending) setRemoving(null);
          }}
        >
          <AlertDialogContent
            className="w-[calc(100%-2rem)] rounded-xl"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              (removeButton.current?.isConnected
                ? removeButton.current
                : addButton.current
              )?.focus();
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir webhook?</AlertDialogTitle>
              <AlertDialogDescription className="break-words">
                A credencial de {removing?.label} será revogada e o card sairá da lista. As vendas
                registradas continuam no histórico.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {revoke.error && (
              <p className="text-sm text-destructive" role="alert">
                {revoke.error.message}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={revoke.isPending}>Cancelar</AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                disabled={!removing || revoke.isPending}
                onClick={() => {
                  if (removing && !revoke.isPending) revoke.mutate(removing.id);
                }}
              >
                {revoke.isPending ? "Excluindo…" : "Excluir webhook"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
