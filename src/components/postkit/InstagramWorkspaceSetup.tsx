import { useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Copy, KeyRound } from "lucide-react";
import {
  getInstagramWorkspaceApp,
  registerInstagramWorkspaceApp,
} from "@/lib/api/instagram-workspace-app.functions";

export type WorkspaceAppStatus = Awaited<ReturnType<typeof getInstagramWorkspaceApp>>;
type Step = { title: string; done: boolean; action?: string; run?: () => void };

export const instagramOnboardingSteps = [
  "Conecte uma conta profissional do Instagram",
  "Adicione seu primeiro vídeo",
  "Agende uma publicação",
  "Confira a primeira publicação no ar",
];

export function InstagramFirstSteps({ steps }: { steps: Step[] }) {
  const completed = steps.filter((step) => step.done).length;
  return (
    <section
      aria-labelledby="instagram-first-steps"
      className="rounded-2xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="instagram-first-steps" className="font-display text-lg font-semibold">
          Primeiros passos
        </h2>
        <div className="flex items-center gap-2 text-xs font-medium">
          <progress
            value={completed}
            max={steps.length}
            aria-label="Progresso dos primeiros passos"
            className="h-2 w-24 accent-primary sm:w-36"
          />
          {completed} de {steps.length}
        </div>
      </div>
      <ol className="mt-3 divide-y divide-border">
        {steps.map(({ title, done, action, run }, index) => (
          <li key={title} className="flex flex-wrap items-center gap-3 py-3 last:pb-0">
            <span
              className={
                done
                  ? "grid size-7 place-items-center rounded-full bg-emerald-500/10 text-emerald-300"
                  : "grid size-7 place-items-center rounded-full border border-border text-xs text-muted-foreground"
              }
            >
              {done ? <Check className="size-4" role="img" aria-label="Concluído" /> : index + 1}
            </span>
            <span
              className={`min-w-40 flex-1 text-sm font-medium ${!done && !run ? "text-muted-foreground" : ""}`}
            >
              {title}
            </span>
            {!done && run && (
              <button
                type="button"
                onClick={run}
                className="min-h-10 rounded-md px-3 text-sm font-semibold text-brand-red hover:bg-primary/10"
              >
                {action}
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function InstagramWorkspaceSetup({
  app,
  workspaceId,
  onSaved,
}: {
  app: WorkspaceAppStatus;
  workspaceId: string;
  onSaved: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
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
        await onSaved();
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
      {firstSetup && (
        <InstagramFirstSteps
          steps={["Configure seu app Meta", ...instagramOnboardingSteps].map((title) => ({
            title,
            done: false,
          }))}
        />
      )}
      <section
        aria-labelledby="instagram-app-setup"
        className="rounded-2xl border border-border bg-card p-4 sm:p-6"
      >
        <KeyRound className="mb-3 size-5 text-brand-red" aria-hidden />
        <h2 id="instagram-app-setup" className="font-display text-xl font-semibold">
          {firstSetup ? "Configure seu app Meta" : "App Meta da operação"}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Cadastre o aplicativo da sua operação para conectar o Instagram e começar a publicar.
        </p>
        {!app.canManage ? (
          <p className="mt-4 text-sm">
            Peça ao responsável pela operação para concluir o cadastro.
          </p>
        ) : (
          <>
            <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm">
              <li>
                <a
                  className="inline-flex items-center gap-1 font-semibold text-brand-red underline underline-offset-4"
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Abra o Meta for Developers <ArrowUpRight className="size-4" aria-hidden />
                </a>{" "}
                e crie um app no seu portfólio empresarial. Escolha o caso de uso para gerenciar
                mensagens e conteúdo no Instagram.
              </li>
              <li>
                Em <strong>Login Unificado</strong>, crie uma configuração para Instagram com token
                de usuário do sistema. Inclua as permissões de perfil e publicação. Adicione a
                permissão de métricas se quiser acompanhar o desempenho.
              </li>
              <li>
                Em <strong>URIs de redirecionamento OAuth válidos</strong>, salve o endereço abaixo.
                <div className="mt-2 flex flex-wrap items-center gap-2">
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
                </div>
                {copyStatus && (
                  <p className="mt-1 text-xs text-muted-foreground" role="status">
                    {copyStatus}
                  </p>
                )}
              </li>
              <li>
                Em <strong>Configurações do app → Básico</strong>, copie o ID e o segredo do app. Em{" "}
                <strong>Login Unificado</strong>, copie o ID da configuração.
              </li>
            </ol>
            <p className="mt-4 text-xs text-muted-foreground">
              Use uma conta profissional. Em modo de desenvolvimento, aceite o convite de teste no
              próprio Instagram antes de conectar.{" "}
              <a
                className="font-semibold underline underline-offset-4"
                href="https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/get-started"
                target="_blank"
                rel="noreferrer"
              >
                Guia oficial da Meta
              </a>
            </p>
            <form
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
