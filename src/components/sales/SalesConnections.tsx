import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Link2, Power, Zap } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createSalesWebhook,
  disableSalesWebhook,
  type SalesOverview,
} from "@/lib/api/sales.functions";
import {
  SALES_CONNECTION_PROVIDERS,
  SALES_PROVIDERS,
  type SalesConnectionProvider,
} from "@/lib/sales-events";

const gateways = {
  omegapay: {
    description: "Pix, cartão, boleto e assinaturas",
    recommended: true,
    steps: [
      "No painel da OmegaPay, abra Configurações → Webhooks.",
      "Crie um webhook, cole a URL no campo URL alvo do disparo e selecione os produtos.",
      "Marque Transação paga, Transação estornada e Chargeback. Salve.",
    ],
  },
  syncpay: {
    description: "Pix e checkout para infoprodutos",
    steps: [
      "No painel da Syncpay, abra Webhooks.",
      "Crie um webhook e cole a URL no campo URI alvo do disparo.",
      "Salve e confirme o envio do primeiro evento.",
    ],
  },
  wiinpay: {
    description: "Gateway nacional de pagamentos",
    steps: [
      "No painel da Wiinpay, abra Configurações → Webhooks.",
      "Adicione um endpoint com a URL gerada.",
      "Selecione os eventos de pagamento aprovado e estornado e salve.",
    ],
  },
} satisfies Record<
  SalesConnectionProvider,
  {
    description: string;
    recommended?: boolean;
    steps: string[];
  }
>;

type Connection = SalesOverview["links"][number];
const date = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function SalesConnections({ links }: { links: Connection[] }) {
  const [newUrl, setNewUrl] = useState("");
  const [message, setMessage] = useState("");
  const client = useQueryClient();
  const disable = useServerFn(disableSalesWebhook);
  const deactivate = useMutation({
    mutationFn: (id: string) => disable({ data: { id } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["sales-overview"] }),
  });
  const visible = links.filter((link) =>
    SALES_CONNECTION_PROVIDERS.some((provider) => provider === link.provider),
  );

  return (
    <>
      <section className="sales-panel mb-8 border-primary/35 p-6" aria-labelledby="sales-hook-url">
        <h2 id="sales-hook-url" className="flex items-center gap-2 font-display text-lg font-bold">
          <Link2 className="size-5 text-brand-red" aria-hidden /> Sua URL de Webhook
        </h2>
        <p className="mt-2 mb-4 text-sm text-muted-foreground">
          Cole esta URL no painel do gateway para receber vendas automaticamente.
        </p>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row">
          {newUrl ? (
            <>
              <input
                className="field min-w-0 flex-1 font-mono text-xs"
                type="url"
                aria-label="URL secreta do webhook"
                value={newUrl}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                className="sales-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(newUrl);
                    setMessage("URL copiada.");
                  } catch {
                    setMessage("Selecione o endereço e copie manualmente.");
                  }
                }}
              >
                <Copy className="size-4" aria-hidden /> Copiar URL
              </button>
            </>
          ) : (
            <p className="flex-1 rounded-md border border-border bg-muted px-3 py-3 text-sm text-muted-foreground">
              Conecte um gateway abaixo para gerar a URL.
            </p>
          )}
        </div>
        {newUrl && (
          <p className="mt-3 text-xs text-muted-foreground" role="status">
            {message || "Copie agora. A URL secreta aparece uma vez."}
          </p>
        )}
      </section>

      <section className="mb-10" aria-labelledby="sales-gateways">
        <h2 id="sales-gateways" className="mb-4 font-display text-xl font-bold tracking-tight">
          Gateways disponíveis
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SALES_CONNECTION_PROVIDERS.map((provider) => {
            const gateway = gateways[provider];
            const active = visible.some((link) => link.provider === provider && link.active);
            const name = SALES_PROVIDERS[provider];
            return (
              <article className="sales-panel flex flex-col overflow-hidden" key={provider}>
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div className="grid size-10 place-items-center rounded-xl border border-border bg-background">
                      <Zap className="size-5 text-brand-red" aria-hidden />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {"recommended" in gateway && !active && (
                        <span className="rounded-full border border-primary/40 bg-primary/15 px-2 py-1 text-[10px] font-bold text-brand-red uppercase">
                          Recomendado
                        </span>
                      )}
                      <span
                        className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${active ? "border-success/40 bg-success/15 text-success" : "border-border bg-muted text-muted-foreground"}`}
                      >
                        {active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </div>
                  <h3 className="font-display text-lg font-bold">{name}</h3>
                  <p className="mb-4 min-h-8 text-xs text-muted-foreground">
                    {gateway.description}
                  </p>
                  <GatewayDialog
                    provider={provider}
                    active={active}
                    onConnect={(url) => {
                      setNewUrl(url);
                      setMessage("");
                    }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="sales-active-gateways">
        <h2
          id="sales-active-gateways"
          className="mb-4 font-display text-xl font-bold tracking-tight"
        >
          Integrações ativas
        </h2>
        <div className="sales-panel overflow-hidden">
          {visible.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma integração ativada ainda. Escolha um gateway acima para começar.
            </p>
          ) : (
            <div className="overflow-x-auto" tabIndex={0} aria-label="Tabela de integrações">
              <table className="w-full min-w-120 text-left text-sm">
                <thead className="bg-muted/50 text-xs tracking-wider text-muted-foreground uppercase">
                  <tr>
                    {["Gateway", "Nome", "Status", "Conectado em", "Ações"].map((label) => (
                      <th key={label} scope="col" className="px-4 py-3 font-medium last:text-right">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((link) => (
                    <tr key={link.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{SALES_PROVIDERS[link.provider]}</td>
                      <td className="px-4 py-3">{link.label}</td>
                      <td
                        className={`px-4 py-3 ${link.active ? "text-success" : "text-muted-foreground"}`}
                      >
                        {link.active ? "Ativo" : "Desativado"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {link.created_at ? date.format(new Date(link.created_at)) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {link.active && (
                          <button
                            type="button"
                            title="Desativar"
                            aria-label={"Desativar " + link.label}
                            disabled={deactivate.isPending}
                            onClick={() => deactivate.mutate(link.id)}
                            className="inline-grid size-11 place-items-center rounded-lg hover:bg-muted"
                          >
                            <Power className="size-4" aria-hidden />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {deactivate.error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {deactivate.error.message}
          </p>
        )}
      </section>
    </>
  );
}

function GatewayDialog({
  provider,
  active,
  onConnect,
}: {
  provider: SalesConnectionProvider;
  active: boolean;
  onConnect: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const create = useServerFn(createSalesWebhook);
  const name = SALES_PROVIDERS[provider];
  const mutation = useMutation({
    mutationFn: create,
    onSuccess: async ({ url }) => {
      onConnect(url);
      setOpen(false);
      await client.invalidateQueries({ queryKey: ["sales-overview"] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = String(new FormData(event.currentTarget).get("label") ?? "").trim() || name;
    mutation.mutate({ data: { provider, label } });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && mutation.isPending) return;
        mutation.reset();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={(active ? "Ver instruções do " : "Conectar ") + name}
          className={`sales-button mt-auto w-full ${active ? "sales-button-outline" : ""}`}
        >
          {active ? "Ver instruções" : "Conectar"}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>Conectar {name}</DialogTitle>
          <DialogDescription>
            Gere uma URL própria para este gateway e copie-a no painel de pagamentos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Passo a passo
            </p>
            <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
              {gateways[provider].steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          <label className="grid gap-1.5 text-sm">
            Nome da conexão
            <input className="field" name="label" maxLength={80} defaultValue={name} />
          </label>
          {mutation.error && (
            <p role="alert" className="text-sm text-destructive">
              {mutation.error.message}
            </p>
          )}
          <DialogFooter>
            <button
              type="button"
              className="sales-button sales-button-outline"
              disabled={mutation.isPending}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="sales-button" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Gerando…"
                : active
                  ? "Gerar outra URL"
                  : "Gerar URL de webhook"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
