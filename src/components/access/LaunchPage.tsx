import {
  ArrowRight,
  ChevronDown,
  Clapperboard,
  Download,
  GitBranch,
  RotateCcw,
  CalendarClock,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AccessForm, type FormMode } from "./AccessForm";
import { AccessStatusPanel } from "./AccessStatusPanel";
import { LaunchFaq, LaunchSetup } from "./LaunchDetails";
import { LaunchWorkflow } from "./LaunchWorkflow";
import { usePlatformAccess } from "./PlatformAccessProvider";
import { TOOL_CATALOG, CATEGORIES } from "@/lib/tool-catalog";
import { TOOL_ICONS } from "@/components/AppShell";

export function PublicBrand() {
  return (
    <Link to="/" className="launch-brand" aria-label="MouseHot, página inicial">
      <img src="/brand/compact.webp" width={36} height={36} alt="" />
      <strong>
        MouseHot<span>.</span>
      </strong>
    </Link>
  );
}

const contentSteps = [
  { name: "Reúna", label: "Baixe e organize a mídia", icon: Download },
  { name: "Prepare", label: "Edite e trate em lote", icon: Clapperboard },
  { name: "Planeje", label: "Analise perfis e funis", icon: GitBranch },
  { name: "Publique", label: "Agende e acompanhe", icon: CalendarClock },
];

function ContentFlow() {
  const [run, setRun] = useState(0);
  return (
    <div
      className="launch-board app-frame"
      aria-label="Demonstração do fluxo de conteúdo"
      data-visual
    >
      <div className="launch-board-header">
        <GitBranch size={20} aria-hidden />
        <strong>Fluxo de conteúdo</strong>
        <span>Demonstração</span>
        <button
          type="button"
          className="launch-board-replay"
          onClick={() => setRun((value) => value + 1)}
          aria-label="Rever animação do fluxo"
        >
          <RotateCcw size={17} aria-hidden />
        </button>
      </div>
      <ol className="launch-board-track" key={run}>
        {contentSteps.map(({ name, label, icon: Icon }) => (
          <li key={name}>
            <Icon size={19} aria-hidden />
            <div>
              <strong>{name}</strong>
              <small>{label}</small>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function LaunchPage() {
  const access = usePlatformAccess();
  const navigate = useNavigate();
  const [formMode, setFormMode] = useState<FormMode>("password");
  useEffect(() => {
    if (!access.isError && ["admin", "approved", "trial"].includes(access.status ?? "")) {
      void navigate({ to: "/painel", replace: true });
    }
  }, [access.status, access.isError, navigate]);

  if (access.user) {
    return (
      <>
        <header className="launch-top launch-wrap launch-top-static">
          <PublicBrand />
        </header>
        <main className="access-standalone">
          <AccessStatusPanel />
        </main>
      </>
    );
  }

  return (
    <>
      <header className="nav launch-top launch-public-top">
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        <div className="launch-wrap wrap launch-top-layout">
          <PublicBrand />
          <nav aria-label="Menu público">
            <a className="launch-nav-link" href="#ferramentas">
              Ferramentas
            </a>
            <a
              className="saas-button saas-button-outline"
              href="#acesso"
              onClick={() => setFormMode("password")}
            >
              Entrar
            </a>
          </nav>
        </div>
      </header>
      <main id="conteudo" tabIndex={-1}>
        <section className="launch-hero" aria-labelledby="launch-heading" data-enter>
          <div className="launch-wrap wrap launch-hero-layout">
            <div className="launch-hero-copy hero-text">
              <h1 id="launch-heading">
                Sua operação digital <span>em um só lugar.</span>
              </h1>
              <p>
                Baixe e prepare mídias, descubra perfis para suas campanhas e desenhe seus funis. Na
                hora de publicar, organize os vídeos por conta e programe os próximos Reels.
              </p>
              <div className="launch-actions">
                <a
                  className="saas-button saas-button-primary"
                  href="#acesso"
                  onClick={() => setFormMode("register")}
                >
                  Criar conta <ArrowRight size={19} aria-hidden />
                </a>
                <a className="launch-nav-link" href="#fluxo">
                  Ver como funciona <ChevronDown size={16} aria-hidden />
                </a>
              </div>
            </div>

            <div id="acesso" className="launch-hero-access" aria-labelledby="launch-access-title">
              <AccessForm
                selectedMode={formMode}
                onModeChange={setFormMode}
                headingId="launch-access-title"
              />
              <p className="launch-access-note">Novas contas passam por aprovação.</p>
            </div>
            <ContentFlow />
          </div>
        </section>
        <LaunchWorkflow />
        <section
          id="ferramentas"
          className="launch-catalog"
          aria-labelledby="launch-catalog-heading"
        >
          <div className="launch-wrap wrap">
            <div>
              <h2 id="launch-catalog-heading">Ferramentas para cada etapa do conteúdo</h2>
              <p className="launch-catalog-lead">
                Tire uma ideia do papel com um funil visual, prepare arquivos para compartilhar e
                acompanhe suas contas. O catálogo reúne as ferramentas por tipo de trabalho.
              </p>
            </div>
            <div className="launch-tool-groups">
              {CATEGORIES.map((category) => {
                const tools = TOOL_CATALOG.filter((tool) => tool.category === category);
                if (!tools.length) return null;
                return (
                  <details key={category} className="launch-tool-group" open>
                    <summary>
                      {category} <ChevronDown size={19} aria-hidden />
                    </summary>
                    <ul>
                      {tools.map((tool) => {
                        const Icon = TOOL_ICONS[tool.id];
                        return (
                          <li key={tool.id}>
                            <Icon size={19} aria-hidden />
                            <div>
                              <strong>{tool.name}</strong>
                              <p>{tool.summary}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                );
              })}
            </div>
          </div>
        </section>
        <LaunchSetup />
        <LaunchFaq />
        <section className="launch-close" aria-labelledby="launch-close-heading">
          <div className="launch-wrap wrap">
            <div>
              <h2 id="launch-close-heading">Abra seu espaço na MouseHot</h2>
              <p>
                Crie sua conta para começar. Se já recebeu um convite, abra o link e entre com o
                e-mail que o administrador usou para convidar você.
              </p>
              <a
                className="saas-button saas-button-primary"
                href="#acesso"
                onClick={() => setFormMode("register")}
              >
                Criar conta <ArrowRight size={19} aria-hidden />
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="closing launch-footer">
        <div className="launch-wrap wrap launch-footer-layout">
          <PublicBrand />
          <nav aria-label="Informações legais">
            <Link to="/privacidade">Privacidade</Link>
            <Link to="/exclusao-de-dados">Exclusão de dados</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
