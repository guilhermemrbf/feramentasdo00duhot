import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Image as ImageIcon, PanelTop, Zap } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scale Up Hub — ferramentas para escalar páginas" },
      {
        name: "description",
        content:
          "Hub com duas ferramentas: gere links públicos de imagens e monte o prompt completo da sua página em minutos.",
      },
      { property: "og:title", content: "Scale Up Hub — ferramentas para escalar páginas" },
      {
        property: "og:description",
        content:
          "Hub com duas ferramentas: gere links públicos de imagens e monte o prompt completo da sua página em minutos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

const tools = [
  {
    to: "/image-links" as const,
    icon: ImageIcon,
    name: "Image Links",
    description:
      "Envie várias imagens ao mesmo tempo e copie os links públicos em URL, Markdown, HTML ou prompt de IA.",
    action: "Abrir ferramenta",
  },
  {
    to: "/criar-pagina" as const,
    icon: PanelTop,
    name: "Criar Minha Página",
    description:
      "Envie foto de perfil e capa, informe nome, @ e descrição, e receba o prompt completo pronto para colar.",
    action: "Começar agora",
  },
];

function Home() {
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <section className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Zap className="size-3 text-primary" /> Scale Up Hub
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl">
            Ferramentas diretas para colocar sua página no ar.
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Sem etapas desnecessárias: hospede suas imagens, gere os links e monte o prompt completo
            da sua página em poucos minutos.
          </p>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.to}
                to={tool.to}
                className="group flex flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/60"
              >
                <span className="flex size-10 items-center justify-center rounded-md bg-secondary text-primary">
                  <Icon className="size-5" />
                </span>
                <h2 className="mt-4 font-display text-lg font-semibold text-foreground">
                  {tool.name}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                  {tool.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  {tool.action}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </section>
      </main>
    </AppShell>
  );
}
