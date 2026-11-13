import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Chrome, Download, FolderOpen, Puzzle } from "lucide-react";
import { AppShell, PageIntro } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { downloads } from "@/lib/downloads";

export const Route = createFileRoute("/mouse-hot-downloader")({
  head: () => ({
    meta: [
      { title: "Mouse Hot Downloader — MauseHot" },
      {
        name: "description",
        content: "Instale a extensão para baixar fotos, vídeos e Reels no Chrome.",
      },
    ],
  }),
  component: MouseHotDownloader,
});

const steps = [
  {
    icon: FolderOpen,
    title: "Extraia o ZIP",
    text: "Abra o ZIP baixado e extraia a pasta Mouse Hot para um lugar fácil de encontrar.",
  },
  {
    icon: Puzzle,
    title: "Instale no Chrome",
    text: "Digite chrome://extensions na barra de endereço. Ative o Modo do desenvolvedor, clique em Carregar sem compactação e selecione a pasta Mouse Hot.",
  },
  {
    icon: CheckCircle2,
    title: "Escolha o que baixar",
    text: "Recarregue um perfil no Instagram ou TikTok. Clique em Ver mídias no canto da página. Marque os itens e clique em Baixar seleção.",
  },
] as const;

function MouseHotDownloader() {
  const { url, version } = downloads.mouseHotDownloader;

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl space-y-7 p-5 sm:p-8">
        <PageIntro
          eyebrow="EXTENSÃO PARA CHROME"
          title="Mouse Hot Downloader"
          description="Baixe fotos, vídeos e Reels do Instagram e do TikTok direto para o computador."
        />
        <section
          aria-label="Download da extensão"
          className="flex flex-col gap-5 rounded-2xl border border-primary/30 bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7"
        >
          <div className="flex items-start gap-4">
            <Chrome className="size-7 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold">Instalar a extensão</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Versão {version} · Google Chrome 120 ou mais recente · Computador
              </p>
            </div>
          </div>
          <Button asChild className="min-h-11 w-full shrink-0 sm:w-auto">
            <a href={url} download>
              <Download className="size-4" aria-hidden />
              Baixar extensão (.zip)
            </a>
          </Button>
        </section>
        <section aria-labelledby="install-title">
          <h2 id="install-title" className="mb-3 text-lg font-semibold">
            Como instalar e usar
          </h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="rounded-xl border border-border bg-card p-4">
                <Icon className="mb-3 size-5 text-primary" aria-hidden />
                <h3 className="text-sm font-semibold">
                  {index + 1}. {title}
                </h3>
                <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </section>
        <div className="rounded-xl border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
          <p>
            <strong className="text-foreground">Onde ficam os arquivos?</strong> Em Downloads →
            Mouse Hot. Os arquivos são baixados um por vez.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Já tem uma versão anterior?</strong> Desative-a
            na tela de extensões antes de carregar a nova pasta.
          </p>
        </div>
      </main>
    </AppShell>
  );
}
