import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Download, ExternalLink, FileArchive, MonitorDown, ShieldCheck } from "lucide-react";
import { AppShell, PageIntro } from "@/components/AppShell";
import { downloads } from "@/lib/downloads";

export const Route = createFileRoute("/baixar-midias")({
  head: () => ({
    meta: [
      { title: "Baixar Mídias — Extensão Chrome/Edge · MauseHot" },
      {
        name: "description",
        content: "Instale a extensão experimental para localizar e baixar mídias acessíveis do Instagram e TikTok.",
      },
    ],
  }),
  component: BaixarMidias,
});

const extension = downloads.socialMediaExtension;

function BaixarMidias() {
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl space-y-7 p-5 sm:p-8">
        <PageIntro
          eyebrow="EXTENSÃO PARA NAVEGADOR · VERSÃO DE TESTE"
          title="Baixar Mídias"
          description="Encontre vídeos e imagens que já estão carregados em páginas do Instagram e TikTok e baixe os arquivos quando houver um link direto acessível."
        />

        <section className="rounded-2xl border border-primary/25 bg-card p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MonitorDown className="size-7" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
                  Chrome / Edge · Desktop
                </span>
                <span className="rounded-full bg-secondary px-3 py-1 text-muted-foreground">
                  Versão experimental {extension.version}
                </span>
              </div>
              <h2 className="font-display text-2xl font-semibold">
                Extensão de download para Instagram e TikTok
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Baixe o ZIP, extraia a pasta e carregue a extensão no navegador. Ela mostra
                mídias encontradas na página e permite tentar o download individual ou de
                vários arquivos acessíveis.
              </p>
              <a
                href={extension.url}
                download={extension.filename}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <Download className="size-4" aria-hidden />
                Baixar extensão ZIP
              </a>
              <p className="text-xs leading-5 text-muted-foreground">
                A extensão funciona localmente no navegador; não precisa de conta no MauseHot.
                A instalação é manual e esta versão ainda depende de testes com downloads
                reais nas plataformas.
              </p>
              <a
                href={extension.source}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-xs text-primary underline underline-offset-4"
              >
                Conferir código-fonte no GitHub <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              Icon: FileArchive,
              title: "Arquivos visíveis",
              description: "Identifica imagens e vídeos que a página efetivamente carregou. Carrosséis podem exigir avançar os slides e atualizar a lista.",
            },
            {
              Icon: Download,
              title: "Downloads pelo Chrome",
              description: "Os downloads são gerenciados pelo navegador. A extensão informa início, conclusão e falhas conhecidas.",
            },
            {
              Icon: ShieldCheck,
              title: "Sem acesso oculto",
              description: "Não usa senhas, APIs privadas nem contorna DRM, páginas privadas ou vídeos blob: e streaming.",
            },
          ].map(({ Icon, title, description }) => (
            <article key={title} className="rounded-2xl border border-border bg-card p-5">
              <Icon className="mb-3 size-5 text-primary" aria-hidden />
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </article>
          ))}
        </section>

        <section className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-xl font-semibold">Como instalar e testar</h2>
          <ol className="space-y-4">
            {[
              ["Baixe e extraia o ZIP", "Extraia o conteúdo para uma pasta permanente no computador. O arquivo manifest.json precisa ficar na raiz da pasta extraída."],
              ["Ative o modo de desenvolvedor", "No Chrome, abra chrome://extensions. No Edge, abra edge://extensions. Ative o modo do desenvolvedor."],
              ["Carregue a extensão", "Clique em Carregar sem compactação e selecione a pasta extraída, que contém o manifest.json."],
              ["Abra um post e teste", "Visite um post ou Reel no Instagram ou uma mídia do TikTok. Clique no ícone da extensão, confira os itens e escolha Baixar. Em carrosséis, avance os slides e clique em Atualizar."],
            ].map(([title, description], index) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-xs leading-6 text-muted-foreground">
            Os arquivos vão para Downloads/00-do-hot. Algumas imagens podem ser miniaturas;
            URLs temporárias podem expirar e mídias protegidas ou transmitidas por blob:
            podem não disponibilizar um arquivo direto. Use somente mídias autorizadas.
          </p>
          <a
            href={extension.url}
            download={extension.filename}
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4"
          >
            Baixar ZIP para instalação <ArrowRight className="size-4" aria-hidden />
          </a>
        </section>
      </main>
    </AppShell>
  );
}
