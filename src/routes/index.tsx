import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  FileKey,
  Image as ImageIcon,
  Instagram,
  PanelTop,
  Scan,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "00duHot — central de ferramentas" },
      {
        name: "description",
        content: "Ferramentas para criar, preparar, otimizar e automatizar sua operação em um só lugar.",
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
    detail: "Ferramenta",
  },
  {
    to: "/criar-pagina" as const,
    icon: PanelTop,
    name: "Criar Tela Privacy",
    description: "Monte prompts completos para recriar suas páginas.",
    detail: "Ferramenta",
  },
  {
    to: "/limpar-metadados" as const,
    icon: FileKey,
    name: "Limpar Metadados",
    description: "Limpe dados embutidos em fotos e vídeos.",
    detail: "Ferramenta",
  },
  {
    to: "/otimizar-criativos" as const,
    icon: ShieldCheck,
    name: "Otimizar Criativos",
    description: "Prepare novas versões dos seus materiais.",
    detail: "Ferramenta",
  },
  {
    to: "/gerar-preview" as const,
    icon: Scan,
    name: "Gerar Preview",
    description: "Gere versões com blur ou pixelização.",
    detail: "Ferramenta",
  },
  {
    to: "/automacao-instagram" as const,
    icon: Instagram,
    name: "Automação Instagram",
    description: "Organize contas, vídeos e a fila de Reels.",
    detail: "Ferramenta",
  },
];

function Home() {
  return (
    <AppShell>
      <main className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
        <div className="pointer-events-none absolute -right-24 -top-24 size-[420px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="pointer-events-none absolute left-1/3 top-[420px] size-[260px] rounded-full bg-primary/5 blur-[100px]" />

        <div className="relative mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-9 lg:py-8">
          <section className="overflow-hidden rounded-[26px] border border-border/90 bg-card/85 shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
            <div className="relative px-6 py-7 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
              <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-primary/10 blur-[80px]" />

              <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                  <div className="mb-6 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] text-primary">
                      <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_currentColor]" />
                      SESSÃO ATIVA
                    </span>
                    <span className="rounded-full border border-border bg-background/40 px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground">
                      CENTRAL DE FERRAMENTAS
                    </span>
                  </div>

                  <div className="flex items-start gap-4">
                    <span className="hidden size-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-[0_0_34px_rgba(72,132,255,0.22)] sm:flex">
                      G
                    </span>
                    <div>
                      <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <Sparkles className="size-4 text-primary" />
                        <span>Bom dia</span>
                      </div>
                      <h1 className="font-display text-4xl font-bold tracking-[-0.045em] sm:text-5xl lg:text-[54px]">
                        Olá, <span className="text-primary">Guilherme.</span>
                      </h1>
                      <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                        Tudo que sua operação precisa para escalar, reunido em um só lugar.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:max-w-[520px] xl:justify-end">
                  {tools.slice(0, 4).map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <Link
                        key={tool.to}
                        to={tool.to}
                        className="group inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background/45 px-3 py-2.5 text-xs font-semibold text-foreground transition-all hover:border-primary/30 hover:bg-background/75"
                      >
                        <Icon className="size-3.5 text-primary" />
                        <span className="truncate">{tool.name}</span>
                        <ArrowUpRight className="size-3 text-muted-foreground/50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="relative mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-border/70 pt-5">
                <div>
                  <p className="font-display text-lg font-bold">6</p>
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground">FERRAMENTAS DISPONÍVEIS</p>
                </div>
                <div className="h-7 w-px bg-border" />
                <div>
                  <p className="font-display text-lg font-bold">01</p>
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground">CENTRAL DE OPERAÇÃO</p>
                </div>
                <div className="ml-auto hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                  <Zap className="size-3.5 text-primary" />
                  Acesso rápido às ferramentas
                </div>
              </div>
            </div>
          </section>

          <section className="mt-7">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-[0.16em] text-primary">FERRAMENTAS</p>
                <h2 className="mt-1 font-display text-xl font-bold tracking-tight">Tudo no seu fluxo de trabalho.</h2>
              </div>
              <span className="hidden text-xs text-muted-foreground sm:block">Selecione uma ferramenta para começar</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {tools.map((tool, index) => {
                const Icon = tool.icon;

                return (
                  <Link
                    key={tool.to}
                    to={tool.to}
                    className="group relative min-h-[190px] overflow-hidden rounded-2xl border border-border bg-card/80 p-5 shadow-[0_12px_34px_rgba(0,0,0,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-card hover:shadow-[0_18px_46px_rgba(0,0,0,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="absolute -right-8 -top-8 size-28 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-100" />
                    <div className="relative flex items-start justify-between">
                      <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-secondary text-primary transition-colors group-hover:border-primary/25">
                        <Icon className="size-[19px]" />
                      </span>
                      <span className="flex size-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground/40 transition-colors group-hover:border-primary/20 group-hover:text-primary">
                        <ArrowUpRight className="size-4" />
                      </span>
                    </div>

                    <div className="relative mt-8">
                      <div className="mb-1 text-[10px] font-bold tracking-[0.12em] text-muted-foreground/55">
                        0{index + 1}
                      </div>
                      <h3 className="font-display text-[17px] font-bold tracking-tight">{tool.name}</h3>
                      <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">
                        {tool.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="mt-7 flex flex-col gap-3 rounded-2xl border border-border bg-card/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Zap className="size-4" />
              </span>
              <div>
                <p className="text-xs font-semibold">00duHot</p>
                <p className="text-[11px] text-muted-foreground">
                  Sua operação em um só lugar.
                </p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Mais ferramentas podem ser adicionadas sem alterar seu fluxo.
            </p>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
