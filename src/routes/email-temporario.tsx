import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Mail } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/email-temporario")({
  head: () => ({ meta: [{ title: "Correio Temporário — 00duHot" }] }),
  component: TemporaryEmail,
});

function publicMailUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.href !== url.origin + "/") return null;
    if (url.protocol === "https:" || (import.meta.env.DEV && local && url.protocol === "http:")) {
      return url.href;
    }
  } catch {
    return null;
  }
  return null;
}

function TemporaryEmail() {
  const target = publicMailUrl(import.meta.env.VITE_TEMP_MAIL_URL);
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <section className="home-intro">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-primary">
              <Mail className="size-4" aria-hidden /> Recebimento de e-mails
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Correio Temporário
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
              Receba mensagens em um endereço descartável, com caixa de entrada ao vivo e
              exclusão automática.
            </p>
            {target ? (
              <a
                href={target}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
              >
                Abrir caixa de entrada <ArrowUpRight className="size-4" aria-hidden />
              </a>
            ) : (
              <p className="mt-5 rounded-lg border border-border bg-background/60 p-3 text-sm">
                A caixa de entrada estará disponível quando o serviço de recebimento estiver conectado.
              </p>
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
