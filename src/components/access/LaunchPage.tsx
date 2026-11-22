import {
  ArrowRight,
  ChevronDown,
  Clapperboard,
  Download,
  GitBranch,
  RotateCcw,
  CalendarClock,
  Check,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AccessForm, type FormMode } from "./AccessForm";
import { AccessStatusPanel } from "./AccessStatusPanel";
import { LaunchBenefits, LaunchFaq, LaunchSetup } from "./LaunchDetails";
import { MouseOrbit } from "./MouseOrbit";
import { LaunchWorkflow } from "./LaunchWorkflow";
import { usePlatformAccess } from "./PlatformAccessProvider";
import { useLaunchScroll } from "./useLaunchScroll";
import { useVisibleMotion } from "./useVisibleMotion";
import { LaunchProof } from "./LaunchProof";
import { LaunchShowcase, type ShowcaseCategory } from "./LaunchShowcase";

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
  const { ref, running } = useVisibleMotion<HTMLDivElement>();
  return (
    <div
      ref={ref}
      data-running={running || undefined}
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
      <div className="command-flow-progress" key={`progress-${run}`} aria-hidden="true" />
      <ol className="launch-board-track" key={run}>
        {contentSteps.map(({ name, label, icon: Icon }) => (
          <li key={name}>
            <Icon size={19} aria-hidden />
            <div>
              <strong>{name}</strong>
              <small>{label}</small>
              <Check className="command-flow-check" size={12} aria-hidden />
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
  const scroll = useLaunchScroll(!access.user);
  const [category, setCategory] = useState<ShowcaseCategory>("Planejamento");
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
      <header
        className="nav launch-top launch-public-top premium-nav"
        ref={scroll.header}
        data-raised={scroll.raised || undefined}
        data-hidden={scroll.hidden || undefined}
      >
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        <div className="launch-wrap wrap launch-top-layout">
          <PublicBrand />
          <nav aria-label="Menu público">
            <a className="launch-nav-link premium-nav-flow" href="#fluxo">
              Como funciona
            </a>
            <a className="launch-nav-link" href="#ferramentas">
              Ferramentas
            </a>
            <a className="launch-nav-link command-nav-faq" href="#perguntas">
              Perguntas
            </a>
            <a
              className="launch-nav-link command-nav-login"
              href="#acesso"
              onClick={() => setFormMode("password")}
            >
              Entrar
            </a>
            <a
              className="saas-button saas-button-outline command-nav-register"
              href="#acesso"
              onClick={() => setFormMode("register")}
            >
              Criar conta
            </a>
          </nav>
        </div>
      </header>
      <main id="conteudo" tabIndex={-1}>
        <section className="launch-hero" aria-labelledby="launch-heading" data-enter>
          <div className="launch-wrap wrap launch-hero-layout">
            <div className="launch-hero-copy hero-text">
              <p className="command-eyebrow">
                <i aria-hidden="true" /> Operação orgânica em escala
              </p>
              <h1 id="launch-heading" aria-label="Sua operação digital em um só lugar.">
                {["Sua", "operação", "digital", "em", "um", "só", "lugar."].map((word, index) => (
                  <span
                    key={word}
                    aria-hidden="true"
                    data-accent={index >= 3 || undefined}
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <span>{word}</span>{" "}
                  </span>
                ))}
              </h1>
              <p className="command-hero-summary">
                Organize a escala da sua operação no orgânico. Planeje campanhas, compare perfis,
                prepare vídeos em lote e programe Reels com uma biblioteca para cada conta.
              </p>
              <div className="launch-actions">
                <a
                  className="saas-button saas-button-primary"
                  href="#acesso"
                  onClick={() => setFormMode("register")}
                >
                  Criar minha conta <ArrowRight size={19} aria-hidden />
                </a>
                <a className="saas-button saas-button-outline" href="#fluxo">
                  Ver como funciona <ChevronDown size={16} aria-hidden />
                </a>
              </div>
              <ul className="command-trust">
                <li>
                  <Timer size={16} aria-hidden /> Teste de 15 minutos por convite
                </li>
                <li>
                  <ShieldCheck size={16} aria-hidden /> Preparo de mídia no navegador
                </li>
              </ul>
            </div>

            <div className="premium-hero-product">
              <MouseOrbit />
              <ContentFlow />
            </div>
          </div>
          <a className="command-scroll-cue" href="#fluxo" hidden={!scroll.nearTop}>
            Role para explorar <ChevronDown size={17} aria-hidden />
          </a>
        </section>
        <LaunchWorkflow />
        <LaunchShowcase category={category} onCategoryChange={setCategory} />
        <LaunchBenefits onRegister={() => setFormMode("register")} />
        <LaunchSetup onExplore={setCategory} />
        <LaunchProof />
        <LaunchFaq />
        <section className="launch-close" aria-labelledby="launch-close-heading">
          <div className="launch-wrap wrap">
            <div>
              <h2 id="launch-close-heading">Sua próxima operação começa com mais controle.</h2>
              <p className="launch-close-heading-copy">
                Crie sua conta e dê o primeiro passo para organizar o orgânico hoje. Se recebeu um
                convite de teste, abra o link que chegou para você.
              </p>
              <a
                className="saas-button saas-button-primary"
                href="#acesso"
                onClick={() => setFormMode("register")}
              >
                Criar conta <ArrowRight size={19} aria-hidden />
              </a>
            </div>
            <div
              id="acesso"
              tabIndex={-1}
              className="launch-hero-access"
              aria-labelledby="launch-access-title"
            >
              <img
                className="command-form-mascot"
                src="/brand/compact.webp"
                width={70}
                height={70}
                loading="lazy"
                decoding="async"
                alt=""
              />
              <AccessForm
                selectedMode={formMode}
                onModeChange={setFormMode}
                headingId="launch-access-title"
              />
              <p className="launch-access-note">
                Após o cadastro, acompanhe a liberação do acesso ao entrar.
              </p>
            </div>
          </div>
        </section>
      </main>
      {scroll.mobileAction && (
        <div className="command-mobile-cta">
          <a
            className="saas-button saas-button-primary"
            href="#acesso"
            onClick={() => setFormMode("register")}
          >
            Criar minha conta <ArrowRight size={17} aria-hidden />
          </a>
        </div>
      )}
      <footer className="closing launch-footer">
        <div className="launch-wrap wrap launch-footer-layout">
          <div className="premium-footer-brand">
            <PublicBrand />
            <span>Sua operação digital em um só lugar.</span>
          </div>
          <nav aria-label="Informações legais">
            <Link to="/privacidade">Privacidade</Link>
            <Link to="/exclusao-de-dados">Exclusão de dados</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
