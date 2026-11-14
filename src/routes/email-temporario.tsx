import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Mail } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TEMP_MAIL_URL } from "@/lib/tool-catalog";

export const Route = createFileRoute("/email-temporario")({
  head: () => ({ meta: [
      { property: "og:title", content: "Correio Temporário — MauseHot" },
      { property: "og:description", content: "Receba mensagens em uma caixa de e-mail descartável." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },{ title: "Correio Temporário — MauseHot" }, { name: "description", content: "Receba mensagens em uma caixa de e-mail descartável." }] }),
  component: TemporaryEmail,
});

function TemporaryEmail() {
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <section className="home-intro">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-brand-red">
              <Mail className="size-4" aria-hidden /> Recebimento de e-mails
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Correio Temporário
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
              Receba mensagens em um endereço descartável, com caixa de entrada ao vivo e exclusão
              automática.
            </p>
            {TEMP_MAIL_URL ? (
              <a
                href={TEMP_MAIL_URL}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
              >
                Abrir caixa de entrada <ArrowUpRight className="size-4" aria-hidden />
              </a>
            ) : (
              <p className="mt-5 rounded-lg border border-border bg-background/60 p-3 text-sm">
                A caixa de entrada estará disponível quando o serviço de recebimento estiver
                conectado.
              </p>
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
