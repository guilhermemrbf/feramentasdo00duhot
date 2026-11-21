import {
  ArrowRight,
  CalendarClock,
  ChevronDown,
  FolderOpen,
  Instagram,
  ListChecks,
  MonitorPlay,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AccessForm, type FormMode } from "./AccessForm";
import { AccessStatusPanel } from "./AccessStatusPanel";
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

const publishSteps = [
  { name: "Biblioteca de Reels", label: "Uma biblioteca para cada perfil", icon: FolderOpen },
  { name: "Agendamento", label: "Escolha dias e horários", icon: CalendarClock },
  { name: "Histórico", label: "Confira o que foi ao ar", icon: ListChecks },
];

function PublishingFrame() {
  return (
    <div className="launch-frame app-frame" aria-label="Fluxo do Automatic Post" data-visual>
      <div className="launch-frame-header">
        <Instagram size={20} aria-hidden />
        <span>
          Automatic Post <small>Instagram</small>
        </span>
        <MonitorPlay size={18} aria-hidden className="frame-screen" />
      </div>
      <div className="launch-frame-body">
        <p>Uma operação por perfil</p>
        <ol>
          {publishSteps.map(({ name, label, icon: Icon }) => (
            <li key={name}>
              <span className="launch-step-icon">
                <Icon size={18} aria-hidden />
              </span>
              <span>
                <strong>{name}</strong>
                <small>{label}</small>
              </span>
            </li>
          ))}
        </ol>
      </div>
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
            <div className="launch-light" aria-hidden="true" />
            <div className="launch-hero-copy hero-text">
              <h1 id="launch-heading">
                Sua operação digital <span>em um só lugar.</span>
              </h1>
              <p>
                Cuida de vários perfis? Prepare seus criativos, organize a biblioteca de cada conta
                e programe os próximos Reels no Instagram.
              </p>
              <div className="launch-actions">
                <a
                  className="saas-button saas-button-primary"
                  href="#acesso"
                  onClick={() => setFormMode("register")}
                >
                  Solicitar acesso <ArrowRight size={19} aria-hidden />
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
              <p className="launch-access-note">Crie sua conta para solicitar acesso.</p>
            </div>
            <PublishingFrame />
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
              <h2 id="launch-catalog-heading">A ferramenta certa para cada tarefa</h2>
              <p className="launch-catalog-lead">
                Analise perfis antes de planejar uma campanha, trate arquivos em lote e confira a
                fila de publicação das contas que você gerencia.
              </p>
            </div>
            <div className="launch-tool-groups">
              {CATEGORIES.map((category) => {
                const tools = TOOL_CATALOG.filter((tool) => tool.category === category);
                if (!tools.length) return null;
                return (
                  <details
                    key={category}
                    className="launch-tool-group"
                    open={category === "Preparação" || category === "Automação"}
                  >
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
        <section className="launch-close" aria-labelledby="launch-close-heading">
          <div className="launch-wrap wrap">
            <div>
              <h2 id="launch-close-heading">Planeje sua próxima semana de conteúdo</h2>
              <p>
                Os novos cadastros passam por aprovação. Se recebeu um convite de teste, use o link
                enviado para o seu e-mail.
              </p>
            </div>
            <a
              className="saas-button saas-button-primary"
              href="#acesso"
              onClick={() => setFormMode("register")}
            >
              Solicitar acesso <ArrowRight size={19} aria-hidden />
            </a>
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
