import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  FileKey,
  Image as ImageIcon,
  Instagram,
  PanelTop,
  Scan,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "00duHot — central de ferramentas" },
      {
        name: "description",
        content: "Central interna de ferramentas para a operação digital 00duHot.",
      },
    ],
  }),
  component: Home,
});

const tools = [
  {
    to: "/image-links" as const,
    icon: ImageIcon,
    name: "Image Links",
    description: "Hospede imagens e gere URLs prontas para uso.",
    detail: "Arquivos e links",
  },
  {
    to: "/criar-pagina" as const,
    icon: PanelTop,
    name: "Tela Privacy",
    description: "Monte prompts completos para recriar suas páginas.",
    detail: "Páginas e prompts",
  },
  {
    to: "/limpar-metadados" as const,
    icon: FileKey,
    name: "Metadados",
    description: "Limpe dados embutidos em fotos e vídeos.",
    detail: "Higienização",
  },
  {
    to: "/otimizar-criativos" as const,
    icon: ShieldCheck,
    name: "Criativos",
    description: "Prepare novas versões dos seus materiais.",
    detail: "Otimização",
  },
  {
    to: "/gerar-preview" as const,
    icon: Scan,
    name: "Preview",
    description: "Gere versões com blur ou pixelização.",
    detail: "Visualização",
  },
  {
    to: "/automacao-instagram" as const,
    icon: Instagram,
    name: "Instagram",
    description: "Organize contas, vídeos e a fila de Reels.",
    detail: "Automação",
  },
];

function Home() {
  return (
    <AppShell>
      <main className="mx-auto max-w-[1400px] px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
        <section className="relative overflow-hidden border-b border-border pb-9">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Ambiente de testes ativo
            </div>
            <h1 className="font-display text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
              Tudo que a operação precisa, em um só lugar.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
              O 00duHot reúne as ferramentas usadas pela equipe para preparar páginas, mídia,
              criativos e automações. A estrutura foi pensada para crescer junto com o SaaS.
            </p>
          </div>
          <div className="absolute right-0 top-0 hidden h-32 w-32 rounded-full bg-primary/5 blur-3xl sm:block" />
        </section>

        <section className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.to}
                to={tool.to}
                className="group flex min-h-52 flex-col bg-card p-6 transition-colors hover:bg-accent/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
                    <Icon className="size-5" />
                  </span>
                  <ArrowUpRight className="size-4 text-muted-foreground/50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
                <div className="mt-auto pt-8">
                  <p className="text-[11px] font-medium text-primary">{tool.detail}</p>
                  <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">{tool.name}</h2>
                  <p className="mt-2 max-w-sm text-sm leading-5 text-muted-foreground">{tool.description}</p>
                </div>
              </Link>
            );
          })}
        </section>

        <section className="mt-8 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Base do próximo estágio</p>
            <p className="mt-1 text-xs text-muted-foreground">
              O núcleo visual já está organizado para receber persistência, autenticação e integrações.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="size-3.5 text-primary" />
            00duHot · equipe interna
          </div>
        </section>
      </main>
    </AppShell>
  );
}
