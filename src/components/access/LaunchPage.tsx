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
import { MouseOrbit } from "./MouseOrbit";
import { LaunchWorkflow } from "./LaunchWorkflow";
import { usePlatformAccess } from "./PlatformAccessProvider";
import { TOOL_CATALOG, CATEGORIES, type Tool } from "@/lib/tool-catalog";
import { TOOL_ICONS } from "@/components/AppShell";

const toolCopy: Partial<Record<Tool["id"], string>> = {
  intelligence:
    "Cole até 1.000 perfis e compare desempenho, subnicho e sinais de risco. Veja as evidências antes de escolher com quem trabalhar.",
  funnels:
    "Desenhe o caminho entre o primeiro contato e a oferta. Conecte as etapas e compartilhe o mapa da campanha com a equipe.",
  downloader:
    "Separe as fotos e os vídeos que você tem permissão para usar. A extensão salva os arquivos do Instagram e do TikTok direto no computador.",
  metadata:
    "Retire metadados de uma foto ou de um lote inteiro de vídeos. Baixe as cópias tratadas e preserve os originais.",
  creatives:
    "Escolha a posição e a opacidade da sua marca uma vez e aplique a mesma assinatura aos materiais da campanha.",
  preview:
    "Escolha o que revelar. Ajuste o desfoque ou a pixelização e exporte uma prévia para divulgar seu conteúdo.",
  images:
    "Gere links públicos diretos para fotos e vídeos. Copie a URL para incluir o arquivo em uma página, mensagem ou prompt.",
  pages:
    "Reúna capa, foto e descrição do perfil. Leve um prompt com os materiais organizados para a ferramenta que vai criar a página.",
  social:
    "Separe as bibliotecas por conta, programe Reels e Stories e confira no histórico quais publicações chegaram ao Instagram.",
  telegram:
    "Mudou o destino de uma campanha? Confira a prévia e atualize os links das publicações que você administra no Telegram.",
  controlHub:
    "Conecte seus iPhones por USB e acompanhe as telas pelo Windows. Use mouse e teclado nos aparelhos compatíveis.",
  tempMail:
    "Receba mensagens de teste em uma caixa temporária. Acompanhe a chegada dos e-mails e descarte o endereço ao terminar.",
};

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
              <div className="launch-signature">
                <span>Ferramentas para a operação orgânica</span>
              </div>
              <h1 id="launch-heading">
                Sua operação digital <span>em um só lugar.</span>
              </h1>
              <p>
                Escolha os perfis da próxima campanha, prepare as mídias em lote e distribua o
                conteúdo por conta. Da primeira ideia ao acompanhamento dos canais, cada etapa tem
                sua ferramenta.
              </p>
              <div className="launch-actions">
                <a className="saas-button saas-button-primary" href="#fluxo">
                  Ver como funciona <ArrowRight size={19} aria-hidden />
                </a>
                <a className="launch-nav-link" href="#ferramentas">
                  Explorar ferramentas <ChevronDown size={16} aria-hidden />
                </a>
              </div>
            </div>

            <MouseOrbit />
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
              <h2 id="launch-catalog-heading">O que você precisa fazer hoje?</h2>
              <p className="launch-catalog-lead">
                Abra uma categoria para encontrar sua ferramenta. Dá para começar com um único
                arquivo, preparar uma campanha inteira ou acompanhar os aparelhos da operação.
              </p>
            </div>
            <div className="launch-tool-groups">
              {CATEGORIES.map((category) => {
                const tools = TOOL_CATALOG.filter((tool) => tool.category === category);
                if (!tools.length) return null;
                return (
                  <details key={category} className="launch-tool-group" open>
                    <summary>
                      <span>{category}</span>
                      <small>
                        {tools.length} {tools.length === 1 ? "ferramenta" : "ferramentas"}
                      </small>{" "}
                      <ChevronDown size={19} aria-hidden />
                    </summary>
                    <ul>
                      {tools.map((tool) => {
                        const Icon = TOOL_ICONS[tool.id];
                        return (
                          <li key={tool.id}>
                            <Icon size={19} aria-hidden />
                            <div>
                              <strong>{tool.name}</strong>
                              <p>{toolCopy[tool.id] ?? tool.summary}</p>
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
              <h2 id="launch-close-heading">A MouseHot faz sentido para sua operação?</h2>
              <p className="launch-close-heading-copy">
                Se você já sabe qual ferramenta quer usar primeiro, crie sua conta. O acesso ao
                painel é liberado após a aprovação. Se recebeu um convite de teste, entre pelo link
                do convite.
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
              <AccessForm
                selectedMode={formMode}
                onModeChange={setFormMode}
                headingId="launch-access-title"
              />
              <p className="launch-access-note">Novas contas passam por aprovação.</p>
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
