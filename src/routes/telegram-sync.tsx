import { downloads } from "@/lib/downloads";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Laptop, ShieldCheck, ArrowRight, CheckCircle2, Link2 } from "lucide-react";
import { AppShell, PageIntro } from "@/components/AppShell";

export const Route = createFileRoute("/telegram-sync")({
  head: () => ({ meta: [{ title: "Telegram Sync gratuito para Windows — 00duHot" }] }),
  component: TelegramSync,
});
const { url: download, release } = downloads.telegramSync;

function TelegramSync() {
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl space-y-7 p-5 sm:p-8">
        <PageIntro
          eyebrow="APLICATIVO GRATUITO"
          title="Telegram Sync"
          description="Clone e sincronize canais e grupos autorizados do Telegram. Troque links de divulgação e organize suas tarefas diretamente no seu computador."
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
                Sua sincronização, no seu computador.
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Baixe, extraia o ZIP e abra TelegramSync.exe. Não precisa instalar Python, contratar
                servidor ou assinar um plano para usar o aplicativo.
              </p>
              <a
                href={download}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                <Download className="size-4" /> Baixar para Windows
              </a>
              <p className="text-xs leading-5 text-muted-foreground">
                Aproximadamente 19 MB. O ZIP inclui o executável e as instruções.{" "}
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
              title: "Links personalizados",
              text: "Troque links na sincronização ou edite links de posts existentes no seu canal, com prévia e restauração local.",
            },
            {
              icon: CheckCircle2,
              title: "Histórico e novos posts",
              text: "Importe o histórico ou mantenha a sincronização de novas publicações enquanto o programa estiver aberto.",
            },
            {
              icon: ShieldCheck,
              title: "Conta no seu Windows",
              text: "As credenciais são protegidas pelo Windows. Tarefas, regras e registros ficam no computador.",
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
                "Conecte seu Telegram",
                "Obtenha gratuitamente seu API ID e API Hash em my.telegram.org. Faça o login no aplicativo com seu telefone, código e, se solicitada, senha de duas etapas.",
              ],
              [
                "Configure a cópia",
                "Na mesma tela, escolha Copiar para outro canal e informe origem e destino. Se precisar trocar textos ou links, abra as substituições opcionais.",
              ],
              [
                "Crie e inicie a tarefa",
                "Clique em Criar sincronização. A tarefa nasce pausada: confira os canais e clique em Iniciar cópia. Teste primeiro entre dois canais seus.",
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
          <h2 className="font-display text-xl font-semibold">Editar links de posts existentes</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Na própria tela do aplicativo, pause as sincronizações e escolha Trocar links do meu
            canal. Escolha um canal que você administra, informe o novo destino e clique em Analisar
            canal. Confira os totais e clique em Aplicar todos os links. Uma confirmação inicia
            o lote inteiro; seleção e filtros servem apenas para conferir. O dashboard ao vivo
            mostra posts e links pendentes, alterados, ignorados e a publicação em andamento.
            Quando o Telegram exigir uma espera, a contagem regressiva aparece e o lote retoma
            automaticamente ao terminar, enquanto o aplicativo permanecer aberto.
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            A edição troca os destinos de todos os links do texto, qualquer que seja o título
            clicável, inclusive URLs por extenso. Mantém texto, linhas, formatação e mídias. Analise
            novamente para encontrar destinos que ainda não apontam para o novo link. A restauração
            continua disponível; posts alterados depois da prévia são preservados.
          </p>
        </section>
        <aside className="space-y-3 rounded-2xl border border-border bg-secondary/40 p-6 text-sm leading-6 text-muted-foreground">
          <h2 className="font-semibold text-foreground">O que precisa ficar ligado?</h2>
          <p>
            O computador, a internet e o aplicativo. Ao fechar ou suspender o computador, a
            sincronização para. Na próxima abertura, você escolhe quando retomar. A página na
            Lovable não precisa ficar aberta.
          </p>
          <p>
            Use conteúdo próprio ou autorizado. A ferramenta respeita proteção contra cópia e não
            transfere membros, reações, tópicos ou alterações posteriores de posts. Se um envio
            ficar sem confirmação, confira o destino antes de autorizar uma nova tentativa.
          </p>
          <p>
            Esta versão não inclui assinatura digital comercial. Os testes automatizados incluem
            abertura do executável no Windows; a validação com sua conta e seus canais deve ser
            feita antes de usar em grande volume.
          </p>
        </aside>
      </main>
    </AppShell>
  );
}
