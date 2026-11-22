import { ChevronDown, Clapperboard, GitBranch, Radio, Sparkles } from "lucide-react";
import { useState } from "react";
import { useLaunchEntrance } from "./useLaunchEntrance";

const setupSteps = [
  {
    icon: GitBranch,
    title: "Tenho uma ideia e preciso escolher os perfis",
    text: "Compare perfis com o Instagram Intelligence e conecte as etapas da campanha no Funil visual.",
  },
  {
    icon: Clapperboard,
    title: "Tenho uma pasta cheia de arquivos",
    text: "Aplique sua marca, limpe metadados em lote e gere uma prévia. Use o Image Links quando quiser compartilhar o arquivo por URL.",
  },
  {
    icon: Radio,
    title: "Tenho campanhas rodando em vários canais",
    text: "Programe Reels por conta, atualize links em canais que você administra com o Telegram Sync e acompanhe seus iPhones pelo Windows.",
  },
] as const;

const questions = [
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

export function LaunchSetup() {
  const [salute, setSalute] = useState(0);
  const { ref: mascot, entered } = useLaunchEntrance<HTMLDivElement>();

  return (
    <section className="launch-setup" aria-labelledby="launch-setup-heading">
      <div className="launch-wrap wrap launch-setup-layout">
        <div className="launch-setup-copy">
          <h2 id="launch-setup-heading">Por onde começar? Depende do que já está na sua mão.</h2>
          <ul>
            {setupSteps.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <Icon size={23} aria-hidden />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ul>
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
            aria-label="Animar o rato da MouseHot"
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
  return (
    <section className="launch-faq" aria-labelledby="launch-faq-heading">
      <div className="launch-wrap wrap launch-faq-layout">
        <h2 id="launch-faq-heading">Perguntas frequentes</h2>
        <div>
          {questions.map(({ question, answer }) => (
            <details className="launch-faq-item" key={question}>
              <summary>
                {question}
                <ChevronDown size={19} aria-hidden />
              </summary>
              <div>
                <p>{answer}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
