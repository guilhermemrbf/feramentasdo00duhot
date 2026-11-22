import { ArrowRight, Check, Plus, Clapperboard, GitBranch, Radio, Sparkles } from "lucide-react";
import { useState } from "react";
import type { ShowcaseCategory } from "./LaunchShowcase";
import { useLaunchEntrance } from "./useLaunchEntrance";

const setupSteps = [
  {
    icon: GitBranch,
    category: "Planejamento",
    result: "Saia com uma lista de perfis e um mapa da campanha.",
    route: ["Comparar perfis", "Escolher subnichos", "Desenhar o funil"],
    title: "Tenho uma ideia e preciso escolher os perfis",
    text: "Compare perfis com o Instagram Intelligence e conecte as etapas da campanha no Funil visual.",
  },
  {
    icon: Clapperboard,
    category: "Preparação",
    result: "Saia com arquivos prontos para compartilhar ou publicar.",
    route: ["Limpar em lote", "Aplicar sua marca", "Gerar uma prévia"],
    title: "Tenho uma pasta cheia de arquivos",
    text: "Aplique sua marca, limpe metadados em lote e gere uma prévia. Use o Image Links quando quiser compartilhar o arquivo por URL.",
  },
  {
    icon: Radio,
    category: "Automação",
    result: "Saia com uma programação por conta e um lugar para conferi-la.",
    route: ["Separar por conta", "Revisar a fila", "Conferir o histórico"],
    title: "Tenho campanhas rodando em vários canais",
    text: "Programe Reels por conta, atualize links em canais que você administra com o Telegram Sync e acompanhe seus iPhones pelo Windows.",
  },
] as const;

const questions = [
  {
    question: "Quanto custa?",
    answer:
      "A MouseHot está em fase de testes. Os planos e preços serão divulgados quando estiverem definidos.",
  },
  {
    question: "Funciona para agência e vários clientes?",
    answer:
      "Você pode organizar contas profissionais autorizadas, com bibliotecas e agendas por perfil. As condições comerciais para agências ainda estão em definição.",
  },
  {
    question: "Meus dados e perfis ficam seguros?",
    answer:
      "A conexão do Instagram usa a autorização oficial da Meta. As ferramentas de preparo local processam os arquivos no navegador. Consulte a Política de Privacidade para saber como os dados da plataforma são tratados.",
  },
  {
    question: "Preciso de uma conta profissional no Instagram?",
    answer:
      "Sim, para programar publicações no Automatic Post. As ferramentas de preparo de fotos e vídeos funcionam sem conectar um perfil do Instagram.",
  },
  {
    question: "Meus vídeos do Google Drive precisam ficar públicos?",
    answer:
      "A pasta pode continuar privada. Compartilhe com a identidade indicada pela MouseHot e vincule-a à biblioteca da conta que vai usar aqueles vídeos.",
  },
  {
    question: "Como funciona o convite de 15 minutos?",
    answer:
      "O convite pode ser usado uma vez e vence 15 minutos após ser gerado. Entre com o e-mail cadastrado no convite. Ao clicar em iniciar, você ganha 15 minutos para experimentar as ferramentas de preparação de conteúdo.",
  },
  {
    question: "Posso criar uma conta sem convite?",
    answer:
      "Sim. Escolha Criar conta no final da página, confirme o e-mail e aguarde a aprovação para entrar no painel.",
  },
] as const;

const comparisons = [
  {
    title: "Operação espalhada",
    items: [
      "Links de perfis perdidos em conversas e planilhas.",
      "Várias cópias do mesmo vídeo em pastas diferentes.",
      "Horários e resultados conferidos conta por conta.",
    ],
  },
  {
    title: "Com a MouseHot",
    items: [
      "Perfis comparados antes de investir em produção.",
      "Mídia tratada em lote e separada por conta.",
      "Fila, horários e histórico em um único painel.",
    ],
  },
] as const;

export function LaunchBenefits({ onRegister }: { onRegister: () => void }) {
  const [view, setView] = useState(0);
  return (
    <section className="premium-benefits" aria-labelledby="premium-benefits-title">
      <div className="launch-wrap">
        <div className="premium-section-heading">
          <h2 id="premium-benefits-title">Pare de apagar incêndio. Comece a operar.</h2>
          <p>
            Quando a campanha cresce, passa a importar onde está cada arquivo, quem vai publicar e o
            que já saiu.
          </p>
        </div>
        <div className="command-compare-switch" role="group" aria-label="Comparar operações">
          {comparisons.map(({ title }, index) => (
            <button
              type="button"
              key={title}
              aria-pressed={view === index}
              aria-controls="comparison-view"
              onClick={() => setView(index)}
            >
              {title}
            </button>
          ))}
        </div>
        <div id="comparison-view" className="premium-comparison" aria-live="polite">
          {comparisons.map(({ title, items }, index) => (
            <div key={title} data-active={view === index || undefined}>
              <h3>{title}</h3>
              <ul>
                {items.map((item) => (
                  <li key={item}>
                    {index === 1 && <Check size={16} aria-hidden />}
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="command-comparison-action">
          <p>Quanto tempo sua equipe gasta nisso por semana?</p>
          <a className="premium-text-link" href="#acesso" onClick={onRegister}>
            Quero centralizar <ArrowRight size={17} aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}
export function LaunchSetup({ onExplore }: { onExplore: (category: ShowcaseCategory) => void }) {
  const [scenario, setScenario] = useState(0);
  const active = setupSteps[scenario];
  const [salute, setSalute] = useState(0);
  const { ref: mascot, entered } = useLaunchEntrance<HTMLDivElement>();

  return (
    <section className="launch-setup" aria-labelledby="launch-setup-heading">
      <div className="launch-wrap wrap launch-setup-layout">
        <div className="launch-setup-copy">
          <h2 id="launch-setup-heading">Escolha seu ponto de partida.</h2>
          <div
            className="launch-stage-controls premium-scenario-controls"
            role="group"
            aria-label="Cenários de uso"
          >
            {setupSteps.map(({ icon: Icon, title }, index) => (
              <button
                type="button"
                key={title}
                aria-pressed={scenario === index}
                aria-controls="scenario-detail"
                onClick={() => setScenario(index)}
              >
                <Icon size={19} aria-hidden />
                <span>{title}</span>
              </button>
            ))}
          </div>
          <div id="scenario-detail" aria-live="polite">
            <div key={scenario} className="premium-scenario-detail">
              <strong>{active.result}</strong>
              <p>{active.text}</p>
              <ol>
                {active.route.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <a
                className="premium-text-link"
                href="#ferramentas"
                onClick={() => onExplore(active.category)}
              >
                Ver ferramentas de {active.category.toLowerCase()}{" "}
                <ArrowRight size={17} aria-hidden />
              </a>
            </div>
          </div>
        </div>
        <div
          id="mascote"
          className="launch-mascot"
          ref={mascot}
          data-entered={entered || undefined}
        >
          <button
            type="button"
            className="launch-mascot-button"
            aria-label="Dê um toque no rato para animar o rato da MouseHot"
            onPointerMove={(event) => {
              if (
                event.pointerType !== "mouse" ||
                !window.matchMedia("(prefers-reduced-motion: no-preference)").matches
              )
                return;
              const button = event.currentTarget;
              const bounds = button.getBoundingClientRect();
              button.style.setProperty(
                "--look-x",
                ((event.clientX - bounds.left) / bounds.width - 0.5) * 12 + "px",
              );
              button.style.setProperty(
                "--look-y",
                ((event.clientY - bounds.top) / bounds.height - 0.5) * 10 + "px",
              );
            }}
            onPointerLeave={(event) => {
              event.currentTarget.style.removeProperty("--look-x");
              event.currentTarget.style.removeProperty("--look-y");
            }}
            onClick={() => setSalute((previous) => previous + 1)}
          >
            <span className="launch-mascot-art" key={salute} data-salute={salute > 0 || undefined}>
              <img
                src="/brand/mascot.webp"
                loading="lazy"
                decoding="async"
                width={720}
                height={720}
                alt=""
              />
              <span className="launch-mascot-ring" aria-hidden="true" />
            </span>
            <span className="launch-mascot-prompt">
              <Sparkles size={16} aria-hidden /> Dê um toque no rato
            </span>
          </button>
          <p className="launch-mascot-status" role="status">
            {salute > 0 && <span key={salute}>O rato deu um salve.</span>}
          </p>
        </div>
      </div>
    </section>
  );
}

export function LaunchFaq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="perguntas" className="launch-faq" aria-labelledby="launch-faq-heading">
      <div className="launch-wrap wrap launch-faq-layout">
        <h2 id="launch-faq-heading">Dúvidas antes de começar?</h2>
        <div>
          {questions.map(({ question, answer }, index) => {
            const expanded = open === index;
            const id = `launch-answer-${index}`;
            return (
              <div
                className="command-faq-item"
                data-expanded={expanded || undefined}
                key={question}
              >
                <h3>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={id}
                    onClick={() => setOpen(expanded ? null : index)}
                  >
                    {question}
                    <Plus size={20} aria-hidden />
                  </button>
                </h3>
                <div className="command-faq-answer" id={id} aria-hidden={!expanded}>
                  <div>
                    <p>{answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
