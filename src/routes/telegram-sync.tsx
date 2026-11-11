import { downloads } from "@/lib/downloads";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Laptop, ShieldCheck, ArrowRight, Eye, Link2 } from "lucide-react";
import { AppShell, PageIntro } from "@/components/AppShell";

export const Route = createFileRoute("/telegram-sync")({
  head: () => ({ meta: [{ title: "Trocar links do meu canal — Telegram Sync · MauseHot" }] }),
  component: TelegramSync,
});
const { url: download, release } = downloads.telegramSync;

function TelegramSync() {
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl space-y-7 p-5 sm:p-8">
        <PageIntro
          eyebrow="EDITOR DE LINKS · WINDOWS"
          title="Trocar links do meu canal"
          description="Atualize os destinos dos links em posts existentes de um canal que você administra. Analise os posts, confira o antes e depois e confirme as alterações no aplicativo Telegram Sync."
        />
        <section className="rounded-2xl border border-primary/25 bg-card p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Laptop className="size-7" />
            </span>
            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
                  Windows 10 / 11 · 64 bits
                </span>
                <span className="rounded-full bg-secondary px-3 py-1 text-muted-foreground">
                  Versão de teste {downloads.telegramSync.version}
                </span>
              </div>
              <h2 className="font-display text-2xl font-semibold">
                Telegram Sync · editor de links
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Baixe, extraia o ZIP e abra TelegramSync.exe. A edição acontece pelo aplicativo no
                seu computador, com a sua conta e as permissões do seu canal.
              </p>
              <a
                href={download}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                <Download className="size-4" /> Baixar para Windows
              </a>
              <p className="text-xs leading-5 text-muted-foreground">
                O ZIP inclui o executável e as instruções.{" "}
                <a
                  className="underline underline-offset-4"
                  href={release}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver versão e integridade do arquivo
                </a>
                .
              </p>
            </div>
          </div>
        </section>
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Link2,
              title: "Novo destino para os links",
              text: "Informe o novo link HTTPS para substituir os destinos dos links nos posts do seu canal, mantendo o texto visível, as linhas, a formatação e as mídias compatíveis.",
            },
            {
              icon: Eye,
              title: "Confira antes de aplicar",
              text: "Analise o canal e confira os posts e o antes e depois. A prévia não altera as publicações; a aplicação depende da sua confirmação.",
            },
            {
              icon: ShieldCheck,
              title: "Backup no seu computador",
              text: "As análises e os textos originais ficam salvos localmente para consulta, relatório CSV e restauração dos posts elegíveis.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <article key={title} className="space-y-3 rounded-2xl border border-border bg-card p-5">
              <Icon className="size-5 text-primary" />
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{text}</p>
            </article>
          ))}
        </section>
        <section className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-xl font-semibold">Comece em quatro passos</h2>
          <ol className="space-y-4">
            {[
              ["Abra o aplicativo", "Extraia o ZIP no Windows e abra TelegramSync.exe."],
              [
                "Conecte sua conta",
                "Obtenha seu API ID e API Hash em my.telegram.org. Conecte sua conta no aplicativo com seu telefone, código e, se solicitada, senha de duas etapas.",
              ],
              [
                "Escolha seu canal e analise",
                "Em Trocar links do meu canal, escolha um canal que você administra, informe o novo link HTTPS e clique em Analisar canal.",
              ],
              [
                "Confira e aplique",
                "Revise o antes e depois. Clique em Aplicar todos os links e confirme para editar todos os posts pendentes da análise. A seleção e os filtros servem para conferir a lista.",
              ],
            ].map(([title, text], index) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <a
            href="https://my.telegram.org"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary underline underline-offset-4"
          >
            Abrir portal oficial do Telegram <ArrowRight className="size-4" />
          </a>
        </section>
        <section className="space-y-3 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-xl font-semibold">Acompanhar e restaurar</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            O painel mostra os posts pendentes, alterados, restaurados e ignorados. Você pode pausar
            a operação. Quando o Telegram exigir uma espera, o aplicativo mostra a contagem e retoma
            o lote ao terminar, enquanto permanecer aberto.
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            Em Análises anteriores, restaurar ou salvar relatório, consulte uma análise salva,
            exporte o relatório CSV ou use Restaurar textos originais. A restauração usa o backup
            local e preserva posts que receberam novas alterações depois da prévia.
          </p>
        </section>
        <aside className="space-y-3 rounded-2xl border border-border bg-secondary/40 p-6 text-sm leading-6 text-muted-foreground">
          <h2 className="font-semibold text-foreground">Requisitos para editar seu canal</h2>
          <p>
            Mantenha o computador, a internet e o aplicativo ligados durante a análise e a edição.
            Sua conta precisa ter permissão para editar os posts do canal. Posts com botões e
            conteúdos não compatíveis são ignorados; confira os motivos no painel.
          </p>
          <p>
            As credenciais são protegidas pelo Windows. Preserve a pasta de dados do aplicativo para
            manter sua conta, suas análises e seus backups ao atualizar.
          </p>
        </aside>
      </main>
    </AppShell>
  );
}
