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
  { name: "Biblioteca de Reels", label: "Vídeos organizados por perfil", icon: FolderOpen },
  { name: "Agendamento", label: "Datas e horários de publicação", icon: CalendarClock },
  { name: "Histórico", label: "Acompanhamento das publicações", icon: ListChecks },
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
        <p>Da biblioteca à publicação em 3 etapas</p>
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

  useEffect(() => {
    if (access.user || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const script = document.createElement("script");
    script.type = "module";
    script.src = "/launch/moments/moments.js";
    document.head.append(script);
    return () => script.remove();
  }, [access.user]);

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
                Prepare fotos e vídeos, organize campanhas e agende Reels para os perfis que você
                gerencia no Instagram.
              </p>
              <div className="launch-actions">
                <a
                  className="saas-button saas-button-primary"
                  href="#acesso"
                  onClick={() => setFormMode("register")}
                >
                  Solicitar acesso <ArrowRight size={19} aria-hidden />
                </a>
                <a className="launch-nav-link" href="#ferramentas">
                  Explorar ferramentas <ChevronDown size={16} aria-hidden />
                </a>
              </div>
            </div>

            <div id="acesso" className="launch-hero-access" aria-labelledby="launch-access-title">
              <AccessForm
                selectedMode={formMode}
                onModeChange={setFormMode}
                headingId="launch-access-title"
              />
              <p className="launch-access-note">Novos cadastros aguardam aprovação.</p>
            </div>
            <PublishingFrame />
          </div>
        </section>
        <section id="ferramentas" className="launch-catalog" data-moment="iris-opens">
          <div className="launch-wrap wrap">
            <div>
              <h2>Ferramentas para cada etapa do conteúdo</h2>
              <p className="launch-catalog-lead">
                Prepare seus arquivos, escolha os perfis que fazem sentido para sua campanha e
                acompanhe o que foi publicado.
              </p>
              <div className="launch-catalog-path" data-visual aria-label="Fluxo de trabalho">
                <span>Arquivo</span>
                <ArrowRight size={15} aria-hidden />
                <span>Campanha</span>
                <ArrowRight size={15} aria-hidden />
                <span>Publicação</span>
              </div>
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
