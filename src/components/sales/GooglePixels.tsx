import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import {
  createGooglePixel,
  listGooglePixels,
  removeGooglePixel,
} from "@/lib/api/google-integrations.functions";
import { IntegrationCopyField } from "./IntegrationCopyField";

export function GooglePixels({ showCreate }: { showCreate: boolean }) {
  const { user } = usePlatformAccess();
  const client = useQueryClient();
  const load = useServerFn(listGooglePixels);
  const create = useServerFn(createGooglePixel);
  const remove = useServerFn(removeGooglePixel);
  const key = ["scalehot-google-pixels", user?.id];
  const query = useQuery({ queryKey: key, queryFn: () => load(), enabled: Boolean(user) });
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const save = useMutation({
    mutationFn: (data: { label: string; tag: string; conversion: string }) => create({ data }),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: refresh,
  });
  const error = save.error ?? revoke.error;

  return (
    <section className="sales-panel min-w-0 p-5 sm:p-6" aria-labelledby="google-pixels-heading">
      <h2 id="google-pixels-heading" className="text-lg font-semibold">
        Tag do Google Ads
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cadastre a ação de conversão e copie os dados para instalar no checkout.
      </p>
      {showCreate && (
        <form
          className="mt-4 grid gap-3 rounded-xl border border-border bg-background/60 p-4 sm:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const fields = new FormData(form);
            if (!save.isPending)
              save.mutate(
                {
                  label: String(fields.get("label") ?? ""),
                  tag: String(fields.get("tag") ?? ""),
                  conversion: String(fields.get("conversion") ?? ""),
                },
                { onSuccess: () => form.reset() },
              );
          }}
        >
          <label className="grid gap-1.5 text-sm font-medium">
            Nome
            <Input
              required
              name="label"
              maxLength={80}
              placeholder="Ex.: Compras da loja"
              className="h-11"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            ID de conversão
            <Input
              required
              name="tag"
              pattern="AW-[0-9]{1,20}"
              placeholder="AW-123456789"
              className="h-11"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Rótulo da conversão
            <Input required name="conversion" pattern={"[A-Za-z0-9_\\-]{1,100}"} className="h-11" />
          </label>
          <Button className="min-h-11 justify-self-start sm:col-span-3" disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Cadastrar tag"}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error.message}
        </p>
      )}
      {query.isPending && (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          Carregando tags…
        </p>
      )}
      {query.isError && (
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => void query.refetch()}
        >
          Tentar carregar novamente
        </Button>
      )}
      {query.data?.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">Nenhuma tag cadastrada.</p>
      )}
      {query.data?.map((pixel) => {
        const [tag, conversion] = pixel.destination.split("/");
        return (
          <article key={pixel.id} className="mt-4 space-y-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="break-words font-semibold">{pixel.label}</h3>
              <Button
                type="button"
                variant="outline"
                disabled={revoke.isPending}
                aria-label={"Remover tag " + pixel.label}
                onClick={() => revoke.mutate(pixel.id)}
              >
                Remover
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <IntegrationCopyField label="ID de conversão" value={tag} />
              <IntegrationCopyField label="Rótulo da conversão" value={conversion} />
            </div>
            <p className="text-sm text-muted-foreground">
              Instale a tag no checkout e dispare a conversão após o pagamento confirmado, com o
              valor e o identificador do pedido.
            </p>
            <a
              className="inline-flex min-h-11 items-center text-sm font-medium text-brand-red underline underline-offset-4"
              href="https://support.google.com/google-ads/answer/6331314"
              target="_blank"
              rel="noreferrer"
            >
              Como instalar a tag do Google Ads
            </a>
          </article>
        );
      })}
    </section>
  );
}
