import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, ExternalLink } from "lucide-react";

// Etapas oficiais da Meta enquanto o app está em desenvolvimento: só contas liberadas como
// testadoras conseguem autorizar. O Mousefy apenas guia; as ações na Meta/Instagram são do usuário.
export const META_APP_ROLES_URL =
  "https://developers.facebook.com/apps/2201393490722211/roles/roles/?business_id=1498873732174939";
export const INSTAGRAM_TESTER_INVITES_URL = "https://www.instagram.com/accounts/manage_access/";
const INSTAGRAM_SIGN_IN_URL = "https://www.instagram.com/accounts/login/";

type WizardStep = 0 | 1 | 2 | 3 | 4;

const storageKey = (workspaceId: string) => `mousefy:instagram-connect-step:v2:${workspaceId}`;

function readStep(workspaceId: string): WizardStep {
  try {
    const value = Number(window.localStorage.getItem(storageKey(workspaceId)));
    return value === 1 || value === 2 || value === 3 || value === 4 ? value : 0;
  } catch {
    return 0;
  }
}

function writeStep(workspaceId: string, step: WizardStep) {
  try {
    window.localStorage.setItem(storageKey(workspaceId), String(step));
  } catch {
    // Sem armazenamento local, o assistente continua funcionando nesta sessão.
  }
}

export function resetInstagramConnectWizard(workspaceId: string, step: 0 | 1 = 0) {
  writeStep(workspaceId, step);
}

const STEP_TITLES = [
  "Entrar no Instagram",
  "Configurar acesso na Meta",
  "Aceitar convite",
  "Conectar ao Mousefy",
];

export function InstagramConnectWizard({
  workspaceId,
  usePlatformApp,
  children,
}: {
  workspaceId: string;
  usePlatformApp: boolean;
  children: ReactNode;
}) {
  const [step, setStepState] = useState<WizardStep>(0);

  useEffect(() => {
    setStepState(readStep(workspaceId));
  }, [workspaceId]);

  const setStep = (next: WizardStep) => {
    setStepState(next);
    writeStep(workspaceId, next);
  };

  const externalLinkClass =
    "inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const continueClass =
    "min-h-11 rounded-lg border border-border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (!usePlatformApp) return <>{children}</>;

  if (step === 0) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-background/40 p-4 text-sm">
        <p>Para conectar um perfil pela primeira vez durante o beta, ele precisa de um convite.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setStep(1)} className={externalLinkClass}>
            Começar configuração
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <ol aria-label="Configuração da conexão" className="mb-4 flex flex-wrap gap-2">
        {STEP_TITLES.map((title, index) => {
          const number = (index + 1) as WizardStep;
          return (
            <li
              key={title}
              aria-current={number === step ? "step" : undefined}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${number === step ? "border-primary/40 bg-primary/10 text-foreground" : number < step ? "border-emerald-400/30 text-emerald-300" : "border-border text-muted-foreground"}`}
            >
              {number < step && <CheckCircle2 aria-hidden className="size-3.5" />}
              {number}. {title}
            </li>
          );
        })}
      </ol>

      <p className="text-xs font-semibold text-muted-foreground">Etapa {step} de 4</p>

      {step === 1 && (
        <div className="mt-1 space-y-3 text-sm">
          <h3 className="font-semibold text-foreground">Entrar no Instagram</h3>
          <p className="text-muted-foreground">
            Abra o Instagram em outra aba e confira o @ antes de continuar. Se já estiver no perfil
            que quer conectar, volte para esta aba.
          </p>
          <div className="rounded-lg border border-border p-3">
            <p className="font-semibold text-foreground">Abriu em outra conta?</p>
            <p className="mt-1 text-muted-foreground">
              No Instagram, clique em <strong>Mais</strong>, no canto inferior esquerdo, e escolha{" "}
              <strong>Trocar de conta</strong>. Selecione o perfil certo ou clique em{" "}
              <strong>Entrar em uma conta existente</strong> para fazer login com outro @.
            </p>
          </div>
          <p className="text-muted-foreground">
            Deixe o perfil certo aberto para aceitar o convite. Se ele for pessoal, mude para
            Criador ou Comercial antes de continuar.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={INSTAGRAM_SIGN_IN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={externalLinkClass}
            >
              Abrir Instagram para escolher o perfil <ExternalLink aria-hidden className="size-4" />
            </a>
            <button type="button" onClick={() => setStep(2)} className={continueClass}>
              Estou no perfil certo · continuar
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-1 space-y-3 text-sm">
          <h3 className="font-semibold text-foreground">Configurar acesso</h3>
          <p className="text-muted-foreground">
            Para conectar uma conta pela primeira vez, ela precisa ser liberada no aplicativo da
            Meta. Só quem administra o aplicativo pode enviar o convite. Se você não tiver acesso à
            configuração, peça ao responsável pelo Mousefy para convidar o @ que você quer conectar.
          </p>
          <p className="text-muted-foreground">
            Se você administra o aplicativo, abra a configuração, clique em{" "}
            <strong>Adicionar pessoas</strong>, selecione <strong>Testador do Instagram</strong> e
            informe o @. Depois volte para esta aba.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={META_APP_ROLES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={externalLinkClass}
            >
              Abrir configuração da Meta <ExternalLink aria-hidden className="size-4" />
            </a>
            <button type="button" onClick={() => setStep(3)} className={continueClass}>
              O convite foi enviado · continuar
            </button>
          </div>
          <button
            type="button"
            onClick={() => setStep(4)}
            className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Este perfil já aceitou o convite · ir para a conexão
          </button>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="block text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Voltar para o login no Instagram
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="mt-1 space-y-3 text-sm">
          <h3 className="font-semibold text-foreground">Aceitar convite no Instagram</h3>
          <p className="text-muted-foreground">
            Use <strong>o mesmo perfil da etapa 1</strong>. Em <strong>Apps e sites</strong> →{" "}
            <strong>Convites de testador</strong>, confira o nome do aplicativo e toque em{" "}
            <strong>Aceitar</strong>. Depois volte para esta aba.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={INSTAGRAM_TESTER_INVITES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={externalLinkClass}
            >
              Abrir convites do Instagram <ExternalLink aria-hidden className="size-4" />
            </a>
            <button type="button" onClick={() => setStep(4)} className={continueClass}>
              Convite aceito · continuar conexão
            </button>
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Voltar para a configuração da Meta
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="mt-1 space-y-2 text-sm">
          <h3 className="font-semibold text-foreground">Conectar conta</h3>
          <p className="text-muted-foreground">
            Use o perfil que aceitou o convite. Clique em <strong>Conectar Instagram</strong>,
            escolha <strong>Continuar com Instagram</strong> na janela da Meta, entre na conta
            liberada e confirme o acesso. Se a janela não fechar, use{" "}
            <strong>Voltar ao Mousefy</strong>.
          </p>
          {children}
          <button
            type="button"
            onClick={() => setStep(1)}
            className="mt-2 text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Conectar uma conta nova que ainda não foi liberada · refazer configuração
          </button>
        </div>
      )}
    </div>
  );
}
