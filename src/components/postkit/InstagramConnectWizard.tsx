import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, ExternalLink } from "lucide-react";

// Etapas oficiais da Meta enquanto o app está em desenvolvimento: só contas liberadas como
// testadoras conseguem autorizar. O Mousefy apenas guia; as ações na Meta/Instagram são do usuário.
export const META_APP_ROLES_URL =
  "https://developers.facebook.com/apps/2201393490722211/roles/roles/?business_id=1498873732174939";
export const INSTAGRAM_TESTER_INVITES_URL = "https://www.instagram.com/accounts/manage_access/";

type WizardStep = 1 | 2 | 3;

const storageKey = (workspaceId: string) => `mousefy:instagram-connect-step:${workspaceId}`;

function readStep(workspaceId: string): WizardStep {
  try {
    const value = Number(window.localStorage.getItem(storageKey(workspaceId)));
    return value === 2 || value === 3 ? value : 1;
  } catch {
    return 1;
  }
}

function writeStep(workspaceId: string, step: WizardStep) {
  try {
    window.localStorage.setItem(storageKey(workspaceId), String(step));
  } catch {
    // Sem armazenamento local, o assistente continua funcionando nesta sessão.
  }
}

export function resetInstagramConnectWizard(workspaceId: string) {
  writeStep(workspaceId, 1);
}

const STEP_TITLES = ["Configurar acesso", "Aceitar convite no Instagram", "Conectar conta"];

export function InstagramConnectWizard({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const [step, setStepState] = useState<WizardStep>(1);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    setStepState(readStep(workspaceId));
  }, [workspaceId]);

  const setStep = (next: WizardStep) => {
    setOpened(false);
    setStepState(next);
    writeStep(workspaceId, next);
  };

  const openExternal = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    setOpened(true);
  };

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

      <p className="text-xs font-semibold text-muted-foreground">Etapa {step} de 3</p>

      {step === 1 && (
        <div className="mt-1 space-y-3 text-sm">
          <h3 className="font-semibold text-foreground">Configurar acesso</h3>
          <p className="text-muted-foreground">
            Para conectar uma conta pela primeira vez, ela precisa ser liberada no aplicativo da
            Meta. Na página que vai abrir, vá em <strong>Testadores do Instagram</strong>, clique
            em <strong>Adicionar testadores do Instagram</strong>, digite o @ da conta que você quer
            conectar e envie o convite. Depois volte para esta aba.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openExternal(META_APP_ROLES_URL)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Abrir configuração da Meta <ExternalLink aria-hidden className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className={`min-h-11 rounded-lg border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${opened ? "border-primary/50 text-foreground" : "border-border"}`}
            >
              Já enviei o convite · continuar
            </button>
          </div>
          <button
            type="button"
            onClick={() => setStep(3)}
            className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Esta conta já foi liberada antes · ir direto para a conexão
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-1 space-y-3 text-sm">
          <h3 className="font-semibold text-foreground">Aceitar convite no Instagram</h3>
          <p className="text-muted-foreground">
            Entre no Instagram <strong>com a conta que você quer conectar</strong>. Em{" "}
            <strong>Apps e sites</strong> → <strong>Convites de testador</strong>, confira o nome
            do aplicativo e toque em <strong>Aceitar</strong>. Depois volte para esta aba.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openExternal(INSTAGRAM_TESTER_INVITES_URL)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Abrir convites do Instagram <ExternalLink aria-hidden className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className={`min-h-11 rounded-lg border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${opened ? "border-primary/50 text-foreground" : "border-border"}`}
            >
              Convite aceito · continuar conexão
            </button>
          </div>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Voltar para a etapa 1
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="mt-1 space-y-2 text-sm">
          <h3 className="font-semibold text-foreground">Conectar conta</h3>
          <p className="text-muted-foreground">
            Tudo certo. Clique em <strong>Conectar Instagram</strong>, escolha{" "}
            <strong>Continuar com Instagram</strong> na janela da Meta, entre na conta liberada e
            confirme o acesso. A janela fecha sozinha e o Mousefy confirma a conta. O Mousefy não
            recebe sua senha.
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
