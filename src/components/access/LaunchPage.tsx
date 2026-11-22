import {
  ArrowRight,
  CalendarClock,
  ChevronDown,
  FolderOpen,
  Instagram,
  ListChecks,
  RotateCcw,
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
  { name: "Na biblioteca", label: "Pasta do Google Drive", icon: FolderOpen },
  { name: "Na fila", label: "Perfil e horário definidos", icon: CalendarClock },
  { name: "No ar", label: "Publicação no histórico", icon: ListChecks },
];

function PublishingFrame() {
  const [run, setRun] = useState(0);
  return (
    <div className="launch-board app-frame" aria-label="Demonstração do Automatic Post" data-visual>
      <div className="launch-board-header">
        <Instagram size={20} aria-hidden />
        <strong>Automatic Post</strong>
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
        {publishSteps.map(({ name, label, icon: Icon }) => (
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
                Prepare seus criativos, traga vídeos do Google Drive e monte a fila de Reels de cada
                conta do Instagram. Acompanhe na MouseHot o que ainda falta e o que já foi ao ar.
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
              <p className="launch-access-note">O cadastro passa por aprovação.</p>
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
              <h2 id="launch-catalog-heading">Ferramentas para antes e depois de publicar</h2>
              <p className="launch-catalog-lead">
                Analise os perfis da campanha, aplique sua marca aos arquivos e limpe metadados em
                lote no navegador. Quando os vídeos estiverem prontos, programe o que entra na fila
                de cada conta.
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
        <section className="launch-close" aria-labelledby="launch-close-heading">
          <div className="launch-wrap wrap">
            <div>
              <h2 id="launch-close-heading">Monte sua primeira fila de Reels</h2>
              <p>
                Comece pelo cadastro. Se recebeu um convite de teste, abra o link e entre com o
                e-mail indicado no convite.
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
