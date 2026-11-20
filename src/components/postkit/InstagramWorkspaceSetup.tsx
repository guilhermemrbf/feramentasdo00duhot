import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Copy, KeyRound } from "lucide-react";
import {
  getInstagramWorkspaceApp,
  registerInstagramWorkspaceApp,
} from "@/lib/api/instagram-workspace-app.functions";

export type WorkspaceAppStatus = Awaited<ReturnType<typeof getInstagramWorkspaceApp>>;
type Step = {
  title: string;
  done: boolean;
  description?: string;
  action?: string;
  run?: () => void;
  onGuide?: () => void;
};

export const instagramAppStepTitle = "Cadastre seu aplicativo da Meta";

export const instagramOnboardingSteps = [
  "Conecte uma conta profissional do Instagram",
  "Adicione seu primeiro vídeo",
  "Agende uma publicação",
  "Confira a primeira publicação no ar",
];

export function InstagramFirstSteps({ steps, onHide }: { steps: Step[]; onHide: () => void }) {
  const completed = steps.filter((step) => step.done).length;
  return (
    <section
      aria-labelledby="instagram-first-steps"
      className="rounded-2xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="instagram-first-steps" className="font-display text-lg font-semibold">
            Primeiros passos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Da configuração da Meta à primeira publicação. O progresso acompanha sua operação.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium">
          <progress
            value={completed}
            max={steps.length}
            aria-label="Progresso dos primeiros passos"
            className="h-2 w-24 accent-primary sm:w-36"
          />
          {completed} de {steps.length}
          <button
            type="button"
            onClick={onHide}
            className="min-h-10 rounded-md px-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Ocultar primeiros passos
          </button>
        </div>
      </div>
      <ol className="mt-3 divide-y divide-border">
        {steps.map(({ title, done, description, action, run, onGuide }, index) => (
          <li
            key={title}
            className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
          >
            <span
              className={
                done
                  ? "grid size-7 place-items-center rounded-full bg-emerald-500/10 text-emerald-300"
                  : "grid size-7 place-items-center rounded-full border border-border text-xs text-muted-foreground"
              }
            >
              {done ? <Check className="size-4" role="img" aria-label="Concluído" /> : index + 1}
            </span>
            <div>
              <p className="text-sm font-medium">{title}</p>
              {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
            </div>
            {!done && (action || onGuide) && (
              <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-auto sm:justify-end">
                {onGuide && (
                  <button
                    type="button"
                    onClick={onGuide}
                    className="min-h-10 rounded-md px-2 text-sm font-medium text-brand-red hover:bg-primary/10"
                  >
                    Ver guia
                  </button>
                )}
                {action && (
                  <button
                    type="button"
                    onClick={run}
                    disabled={!run}
                    className="min-h-10 rounded-lg border border-primary/40 bg-primary/10 px-3 text-sm font-semibold text-brand-red hover:bg-primary/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-muted-foreground"
                  >
                    {action}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

const metaGuide = [
  {
    title: "Abra o portal de desenvolvedores",
    instruction:
      "Em Meus apps, escolha Criar app. Informe o nome e o e-mail de contato da sua operação.",
  },
  {
    title: "Escolha o caso de uso do Instagram",
    instruction:
      "Selecione o caso de uso para gerenciar conteúdo e mensagens do Instagram. Vincule o portfólio empresarial da operação e conclua a criação do app.",
  },
  {
    title: "Configure o Login Unificado",
    instruction:
      "Crie uma configuração para Instagram com token de usuário do sistema. Inclua as permissões de perfil e de publicação.",
  },
  {
    title: "Autorize a leitura de métricas",
    instruction:
      "Se quiser acompanhar o desempenho, inclua a permissão de insights do Instagram na configuração. O painel mostra as métricas que a Meta disponibilizar.",
  },
  {
    title: "Cadastre o endereço de retorno",
    instruction:
      "Na configuração da Meta, cole o endereço abaixo em URIs de redirecionamento OAuth válidos e salve.",
  },
  {
    title: "Preencha as credenciais no MouseHot",
    instruction:
      "Em Configurações do app → Básico, encontre o ID e o segredo do app. No Login Unificado, encontre o ID da configuração. Use os três campos do formulário de cadastro.",
  },
  {
    title: "Prepare a conta profissional",
    instruction:
      "Use uma conta profissional do Instagram. Se seu app Meta estiver em desenvolvimento, adicione o perfil como testador e aceite o convite no Instagram antes de conectar.",
  },
] as const;

export function InstagramWorkspaceSetup({
  app,
  workspaceId,
  onSaved,
  initialGuideStep,
  onBack,
  onConnect,
}: {
  app: WorkspaceAppStatus;
  workspaceId: string;
  onSaved: (continueGuide: boolean) => Promise<void>;
  initialGuideStep?: number;
  onBack: () => void;
  onConnect: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [guideStep, setGuideStep] = useState(initialGuideStep ?? 0);
  const [showGuide, setShowGuide] = useState(initialGuideStep !== undefined);
  const guide = metaGuide[guideStep];
  const firstSetup = app.mode === "missing";
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const appId = String(fields.get("appId") ?? "").trim();
    const configId = String(fields.get("configId") ?? "").trim();
    const appSecret = String(fields.get("appSecret") ?? "").trim();
    if (
      !/^\d{1,32}$/.test(appId) ||
      !/^\d{1,32}$/.test(configId) ||
      !/^[a-f0-9]{32}$/i.test(appSecret)
    ) {
      setError("Preencha os dois IDs numéricos e o segredo de 32 caracteres do app Meta.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const { outcome } = await registerInstagramWorkspaceApp({
        data: { workspaceId, appId, configId, appSecret },
      });
      if (outcome === "saved") {
        form.reset();
        await onSaved(showGuide);
        return;
      }
      setError(
        {
          access: "Peça a um administrador da operação para cadastrar o aplicativo.",
          credentials:
            "A Meta não aceitou o ID e o segredo do app. Confira os dois em Configurações do app.",
          unavailable: "A Meta não respondeu agora. Tente novamente.",
          reserved: "Esse aplicativo já está em uso. Use um app próprio desta operação.",
          locked: "Para trocar o ID do app, desconecte primeiro as contas desta operação.",
          storage: "Não foi possível salvar agora. Tente novamente.",
        }[outcome],
      );
    } catch {
      setError("Não foi possível concluir o cadastro. Confira sua conexão e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section
        aria-labelledby="instagram-app-setup"
        className="rounded-2xl border border-border bg-card p-4 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="instagram-app-setup"
            className="flex items-center gap-2 font-display text-xl font-semibold"
          >
            <KeyRound className="size-5 text-brand-red" aria-hidden />
            {firstSetup ? "Cadastrar app Meta" : "App Meta da operação"}
          </h2>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary"
          >
            <ArrowLeft className="size-4" aria-hidden /> Voltar à visão geral
          </button>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Cadastre o aplicativo da sua operação para conectar o Instagram e começar a publicar.
        </p>
        {!app.canManage ? (
          <p className="mt-4 text-sm">
            Peça ao responsável pela operação para concluir o cadastro.
          </p>
        ) : (
          <>
            <details
              open={showGuide}
              onToggle={(event) => setShowGuide(event.currentTarget.open)}
              className="mt-5 rounded-xl border border-border bg-background/50"
            >
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
                Guia de configuração
              </summary>
              <section
                className="space-y-4 border-t border-border p-4"
                aria-label="Guia de configuração do Meta"
              >
                <nav aria-label="Etapas do guia" className="flex flex-wrap gap-2">
                  {metaGuide.map(({ title }, index) => (
                    <button
                      key={title}
                      type="button"
                      aria-current={index === guideStep ? "step" : undefined}
                      aria-label={`Etapa ${index + 1} de ${metaGuide.length} — ${title}`}
                      onClick={() => setGuideStep(index)}
                      className={`min-h-10 min-w-10 rounded-lg border text-sm font-semibold hover:bg-secondary ${index === guideStep ? "border-brand-red bg-primary/15 text-brand-red" : "border-border"}`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </nav>
                <div aria-live="polite">
                  <p className="text-xs font-semibold text-brand-red">
                    Etapa {guideStep + 1} de {metaGuide.length}
                  </p>
                  <h3 className="mt-1 font-semibold">{guide.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{guide.instruction}</p>
                </div>
                {guideStep === 0 && (
                  <a
                    className="inline-flex items-center gap-1 font-semibold text-brand-red underline underline-offset-4"
                    href="https://developers.facebook.com/apps/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abra o Meta for Developers <ArrowUpRight className="size-4" aria-hidden />
                  </a>
                )}
                {guideStep === 4 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="break-all rounded-md bg-background px-2 py-1 text-xs">
                      {app.callbackUrl}
                    </code>
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-xs font-semibold"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(app.callbackUrl)
                          .then(() => setCopyStatus("Endereço copiado."))
                          .catch(() => setCopyStatus("Selecione e copie o endereço acima."))
                      }
                    >
                      <Copy className="size-4" aria-hidden /> Copiar endereço
                    </button>
                    {copyStatus && (
                      <p className="text-xs text-muted-foreground" role="status">
                        {copyStatus}
                      </p>
                    )}
                  </div>
                )}
                {guideStep === 6 && firstSetup && (
                  <p className="text-sm text-muted-foreground">
                    Cadastre seu app na etapa anterior para liberar a conexão.
                  </p>
                )}
                <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                  <button
                    type="button"
                    disabled={guideStep === 0}
                    onClick={() => setGuideStep(guideStep - 1)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary disabled:opacity-45"
                  >
                    <ArrowLeft className="size-4" aria-hidden /> Voltar
                  </button>
                  {guideStep < metaGuide.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setGuideStep(guideStep + 1)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
                    >
                      Próximo <ArrowRight className="size-4" aria-hidden />
                    </button>
                  )}
                  {guideStep === 6 && (
                    <button
                      type="button"
                      onClick={firstSetup ? () => setGuideStep(5) : onConnect}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
                    >
                      {firstSetup ? "Ir para o cadastro" : "Conectar a primeira conta"}
                      <ArrowRight className="size-4 shrink-0" aria-hidden />
                    </button>
                  )}
                </div>
              </section>
            </details>
            <form
              id="instagram-app-credentials"
              hidden={showGuide && guideStep !== 5}
              aria-label="Cadastro do app Meta"
              method="post"
              className="mt-5 space-y-4 border-t border-border pt-5"
              onSubmit={(event) => void submit(event)}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  ID do app Meta
                  <input
                    name="appId"
                    required
                    inputMode="numeric"
                    maxLength={32}
                    defaultValue={app.appId}
                    className="min-h-11 min-w-0 rounded-md border border-border bg-background px-3"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  ID da configuração do Login Unificado
                  <input
                    name="configId"
                    required
                    inputMode="numeric"
                    maxLength={32}
                    defaultValue={app.configId}
                    className="min-h-11 min-w-0 rounded-md border border-border bg-background px-3"
                  />
                </label>
              </div>
              <label className="grid gap-1.5 text-sm font-medium">
                Segredo do app
                <input
                  name="appSecret"
                  type="password"
                  autoComplete="off"
                  maxLength={32}
                  required
                  className="min-h-11 min-w-0 rounded-md border border-border bg-background px-3"
                />
              </label>
              {error && (
                <p role="alert" className="text-sm text-red-300">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {saving ? "Validando com a Meta…" : "Validar e salvar app"}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
