import { createFileRoute } from "@tanstack/react-router";
import { Download, MonitorSmartphone } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { downloads } from "@/lib/downloads";

export const Route = createFileRoute("/fazenda-de-celulares")({
  head: () => ({
    meta: [
      { title: "Fazenda de Celulares — MauseHot" },
      {
        name: "description",
        content: "Baixe a Fazenda de Celulares para Windows e gerencie iPhones conectados por USB.",
      },
    ],
  }),
  component: FazendaDeCelulares,
});

function FazendaDeCelulares() {
  const download = downloads.fazendaDeCelulares;
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <section
          aria-labelledby="fazenda-title"
          className="rounded-2xl border border-primary/30 bg-card p-6 sm:p-9"
        >
          <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-primary/15 text-brand-red">
            <MonitorSmartphone className="size-6" aria-hidden />
          </div>
          <h1 id="fazenda-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Fazenda de Celulares
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Conecte seus iPhones por USB e selecione qual tela quer acompanhar. A janela exibe um
            aparelho por vez. Use o mouse e o teclado no iOS 27 ou mais recente, com o Modo de
            Desenvolvedor ativo.
          </p>
          <Button asChild size="lg" className="mt-7 min-h-12 w-full sm:w-auto">
            <a href={download.url}>
              <Download className="size-5" aria-hidden />
              Baixar instalador para Windows
            </a>
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Windows 10/11 · 64 bits · Versão {download.version}
          </p>
        </section>
      </main>
    </AppShell>
  );
}
