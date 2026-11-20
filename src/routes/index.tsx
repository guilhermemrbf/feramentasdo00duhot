import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarClock,
  ChevronRight,
  CircleCheck,
  Clapperboard,
  FileKey,
  GitBranch,
  Image,
  Instagram,
  Library,
  ScanSearch,
  SlidersHorizontal,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MauseHot — sua operação digital em um só lugar" },
      {
        name: "description",
        content:
          "Prepare suas mídias, organize suas campanhas e programe suas publicações no Instagram em um só lugar.",
      },
    ],
  }),
  component: Home,
});

const publishingSteps = [
  { label: "Biblioteca", detail: "Vídeos de cada perfil", icon: Library },
  { label: "Agendamento", detail: "Dias e horários", icon: CalendarClock },
  { label: "Histórico", detail: "Situação da publicação", icon: CircleCheck },
];

function Home() {
  return (
    <AppShell>
      {(openTools) => (
        <main className="home-overview mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-9">
          <section className="home-intro" aria-labelledby="home-welcome">
            <div className="relative z-10 min-w-0">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-red/30 bg-brand-red/10 px-3 py-1.5 text-xs font-semibold text-brand-red">
                <span className="size-1.5 rounded-full bg-brand-red" aria-hidden />
                Bem-vindo ao MauseHot
              </p>
              <h1 id="home-welcome" className="home-title font-display font-bold tracking-tight">
                Sua operação digital <span className="block text-brand-red">em um só lugar</span>
              </h1>
              <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground sm:text-base">
                Prepare seu conteúdo, organize a próxima campanha e acompanhe o que foi publicado.
              </p>
              <button type="button" className="tool-action mt-6" onClick={openTools}>
                Ver todas as ferramentas <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
            <div className="home-mascot" aria-hidden>
              <span className="home-mascot-orbit" />
              <img
                src="/brand/mark.png"
                alt=""
                width={176}
                height={176}
                className="home-mark relative object-contain"
              />
            </div>
          </section>

          <section aria-labelledby="home-workflow">
            <div className="mb-4 sm:mb-5">
              <h2 id="home-workflow" className="font-display text-xl font-semibold sm:text-2xl">
                Da preparação à publicação
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Explore o que você pode fazer a partir do menu lateral.
              </p>
            </div>
            <div className="home-capabilities">
              <article className="home-feature home-feature-publishing">
                <div className="flex items-center gap-3">
                  <span className="home-feature-icon">
                    <Instagram className="size-5" aria-hidden />
                  </span>
                  <h3 className="font-display text-lg font-semibold sm:text-xl">
                    Programe seu Instagram
                  </h3>
                </div>
                <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                  Separe os vídeos por perfil, programe Reels e confira a fila e o histórico no
                  Automatic Post.
                </p>
                <div className="home-publishing-flow">
                  <div className="flex items-center gap-2 border-b border-white/10 px-3.5 py-3">
                    <span className="flex gap-1.5" aria-hidden>
                      <span className="size-2 rounded-full bg-brand-red" />
                      <span className="size-2 rounded-full bg-white/25" />
                      <span className="size-2 rounded-full bg-white/15" />
                    </span>
                    <p className="ml-1 text-xs font-medium text-muted-foreground">
                      Fluxo de publicação
                    </p>
                  </div>
                  <ol className="home-publishing-steps">
                    {publishingSteps.map(({ label, detail, icon: Icon }) => (
                      <li key={label} className="home-publishing-step">
                        <Icon className="size-4 shrink-0 text-brand-red" aria-hidden />
                        <div className="min-w-0">
                          <strong className="block text-xs font-semibold">{label}</strong>
                          <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </article>

              <article className="home-feature">
                <div className="flex items-center gap-3">
                  <span className="home-feature-icon">
                    <Clapperboard className="size-5" aria-hidden />
                  </span>
                  <h3 className="font-display text-base font-semibold sm:text-lg">
                    Prepare fotos e vídeos
                  </h3>
                </div>
                <ul className="home-feature-list">
                  <li>
                    <FileKey className="size-4" aria-hidden /> Limpe metadados de arquivos
                  </li>
                  <li>
                    <Image className="size-4" aria-hidden /> Adicione sua marca aos criativos
                  </li>
                  <li>
                    <SlidersHorizontal className="size-4" aria-hidden /> Crie prévias com desfoque
                  </li>
                </ul>
              </article>

              <article className="home-feature">
                <div className="flex items-center gap-3">
                  <span className="home-feature-icon">
                    <GitBranch className="size-5" aria-hidden />
                  </span>
                  <h3 className="font-display text-base font-semibold sm:text-lg">
                    Planeje os próximos passos
                  </h3>
                </div>
                <ul className="home-feature-list">
                  <li>
                    <ScanSearch className="size-4" aria-hidden /> Analise perfis do Instagram
                  </li>
                  <li>
                    <GitBranch className="size-4" aria-hidden /> Organize etapas e decisões do funil
                  </li>
                </ul>
              </article>
            </div>
          </section>
        </main>
      )}
    </AppShell>
  );
}
