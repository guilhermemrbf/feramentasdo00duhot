import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import { metaUrlParameters } from "@/lib/meta-ads/contract";
import {
  configureMetaPixel,
  createMetaPixel,
  disconnectMetaPixel,
  listMetaPixels,
} from "@/lib/meta-ads/functions";

export function Pixels() {
  const { user } = usePlatformAccess();
  const load = useServerFn(listMetaPixels);
  const create = useServerFn(createMetaPixel);
  const client = useQueryClient();
  const key = ["meta-pixels", user?.id];
  const query = useQuery({ queryKey: key, queryFn: () => load(), enabled: Boolean(user) });
  const mutation = useMutation({
    mutationFn: (data: {
      label: string;
      dataset: string;
      domain: string;
      token: string;
      testCode: string;
    }) => create({ data }),
    onSuccess: () => void client.invalidateQueries({ queryKey: key }),
    gcTime: 0,
  });

  function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    mutation.mutate(
      {
        label: String(fields.get("label") ?? ""),
        dataset: String(fields.get("dataset") ?? ""),
        domain: String(fields.get("domain") ?? ""),
        token: String(fields.get("token") ?? ""),
        testCode: String(fields.get("testCode") ?? ""),
      },
      { onSuccess: () => form.reset() },
    );
  }

  return (
    <section id="pixels" className="my-8 scroll-mt-20" aria-labelledby="pixels-heading">
      <h2 id="pixels-heading" className="font-display text-2xl font-bold">
        Pixel da Meta
      </h2>
      <p className="mb-4 text-muted-foreground">
        Vincule o checkout Syncpay ao Pixel para atribuir vendas aos anúncios e enviar compras
        confirmadas à Meta.
      </p>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <Card className="bg-gradient-card p-5 self-start">
          <h2 className="font-display text-lg font-bold mb-4">Cadastrar Pixel</h2>
          {mutation.data ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Configure o endpoint e a chave no servidor da loja. A chave aparece só uma vez.
              </p>
              <CopyField label="Endpoint do checkout" value={mutation.data.checkoutUrl} />
              <CopyField label="Chave do checkout" value={mutation.data.key} />
              <CopyField label="Webhook Syncpay" value={mutation.data.webhookUrl} />
              <Button variant="outline" onClick={() => mutation.reset()}>
                Fechar credenciais
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={register}>
              <div className="space-y-1">
                <Label htmlFor="pixel-label">Nome</Label>
                <Input id="pixel-label" name="label" required maxLength={80} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pixel-dataset">ID do Pixel ou dataset</Label>
                <Input
                  id="pixel-dataset"
                  name="dataset"
                  inputMode="numeric"
                  pattern="[0-9]{1,32}"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pixel-domain">Domínio da loja</Label>
                <Input
                  id="pixel-domain"
                  name="domain"
                  type="url"
                  placeholder="https://sualoja.com.br"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pixel-token">Token da API de Conversões</Label>
                <Input id="pixel-token" name="token" type="password" autoComplete="off" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pixel-test-code">Código de eventos de teste (opcional)</Label>
                <Input id="pixel-test-code" name="testCode" maxLength={32} />
              </div>
              <Button type="submit" disabled={mutation.isPending || !user}>
                {mutation.isPending ? "Cadastrando…" : "Cadastrar Pixel"}
              </Button>
              {mutation.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {mutation.error.message}
                </p>
              )}
            </form>
          )}
        </Card>
        <div className="space-y-4 min-w-0">
          <Card className="bg-gradient-card p-5">
            <h2 className="font-display text-lg font-bold">Links dos anúncios</h2>
            <p className="mb-3 mt-1 text-sm text-muted-foreground">
              Cole no campo Parâmetros de URL dos anúncios. O checkout precisa vincular o clique à
              referência da transação.
            </p>
            <CopyField label="Parâmetros de URL da Meta" value={metaUrlParameters} />
          </Card>
          {query.isPending && user && (
            <p role="status" className="text-muted-foreground">
              Carregando Pixels…
            </p>
          )}
          {query.isError && (
            <p role="alert" className="text-destructive">
              {query.error.message}
            </p>
          )}
          {query.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum Pixel cadastrado.</p>
          )}
          {query.data?.map((pixel) => (
            <PixelSettings key={pixel.id} pixel={pixel} refresh={() => void query.refetch()} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PixelSettings({
  pixel,
  refresh,
}: {
  pixel: Awaited<ReturnType<typeof listMetaPixels>>[number];
  refresh: () => void;
}) {
  const [testCode, setTestCode] = useState(pixel.testCode);
  const [secret, setSecret] = useState("");
  const configure = useServerFn(configureMetaPixel);
  const detach = useServerFn(disconnectMetaPixel);
  const update = useMutation({
    mutationFn: () => configure({ data: { id: pixel.id, secret, testCode } }),
    onSuccess: () => {
      setSecret("");
      refresh();
      toast.success("Configuração salva.");
    },
  });
  const disable = useMutation({
    mutationFn: () => detach({ data: { id: pixel.id } }),
    onSuccess: refresh,
  });
  return (
    <Card className="bg-gradient-card p-5 space-y-3">
      <div>
        <h2 className="font-display text-lg font-bold break-words">{pixel.label}</h2>
        <p className="text-sm text-muted-foreground break-words">
          {pixel.domain} · {pixel.dataset}
        </p>
      </div>
      {pixel.active ? (
        <>
          <p className="text-sm">
            {pixel.signatureReady
              ? "Assinatura Syncpay configurada"
              : "Aguardando o segredo do webhook Syncpay"}
          </p>
          <CopyField label="Webhook Syncpay" value={pixel.webhookUrl} />
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              update.mutate();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor={pixel.id + "-secret"}>Segredo de assinatura Syncpay</Label>
              <Input
                id={pixel.id + "-secret"}
                type="password"
                autoComplete="off"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={pixel.id + "-test"}>Código de eventos de teste</Label>
              <Input
                id={pixel.id + "-test"}
                value={testCode}
                onChange={(event) => setTestCode(event.target.value)}
                maxLength={32}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={update.isPending || disable.isPending}>
                Salvar configuração
              </Button>
              <Button
                size="sm"
                variant="outline"
                type="button"
                disabled={update.isPending || disable.isPending}
                onClick={() => disable.mutate()}
              >
                Desativar
              </Button>
            </div>
          </form>
          {(update.error || disable.error) && (
            <p role="alert" className="text-sm text-destructive">
              {(update.error ?? disable.error)?.message}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Desativado</p>
      )}
    </Card>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <label className="block text-sm">
        {label}
        <Input readOnly value={value} className="mt-1 font-mono text-xs" />
      </label>
      <Button
        size="sm"
        variant="outline"
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast.success("Copiado.");
          } catch {
            toast.error("Selecione o texto para copiar manualmente.");
          }
        }}
      >
        <Copy aria-hidden="true" /> Copiar {label.toLowerCase()}
      </Button>
    </div>
  );
}
