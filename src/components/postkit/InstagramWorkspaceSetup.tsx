import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Copy, KeyRound } from "lucide-react";
import {
  getInstagramWorkspaceApp,
  registerInstagramWorkspaceApp,
} from "@/lib/api/instagram-workspace-app.functions";
import { metaGuide } from "./instagram-meta-guide";

export type WorkspaceAppStatus = Awaited<ReturnType<typeof getInstagramWorkspaceApp>>;
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
  onSaved: () => Promise<void>;
  initialGuideStep?: number;
  onBack: () => void;
  onConnect: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [guideStep, setGuideStep] = useState(initialGuideStep ?? 0);
  const showGuide = app.mode === "missing" || initialGuideStep !== undefined;
  const guide = metaGuide[guideStep] ?? metaGuide[0];
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
        setGuideStep(metaGuide.length - 1);
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

  const credentialForm = (
    <form
      id="instagram-app-credentials"
      aria-label="Cadastro do app Meta"
      method="post"
      className="space-y-4"
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
    </form>
  );
  const saveButton = (
    <button
      type="submit"
      form="instagram-app-credentials"
      disabled={saving}
      className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
    >
      {saving ? "Validando com a Meta…" : "Validar e salvar app"}
    </button>
  );

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
        ) : showGuide ? (
          <section
            className="mt-5 space-y-4 rounded-xl border border-border bg-background/50 p-4"
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
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                href="https://developers.facebook.com/apps/"
                target="_blank"
                rel="noreferrer"
              >
                Abrir developers.facebook.com <ArrowUpRight className="size-4" aria-hidden />
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
            <div className="grid gap-4 lg:grid-cols-2">
              {guide.images.map(([filename, alt]) => {
                const src = `/tutorial-meta/meta-${filename}.webp`;
                return (
                  <figure key={filename} className="min-w-0">
                    <a
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="group grid gap-1.5 text-sm text-muted-foreground"
                      aria-label={`Ampliar captura: ${alt}`}
                    >
                      <img src={src} alt={alt} className="w-full rounded-lg border border-border" />
                      <span className="inline-flex items-center gap-1 group-hover:text-foreground">
                        Ampliar captura <ArrowUpRight className="size-3.5" aria-hidden />
                      </span>
                    </a>
                  </figure>
                );
              })}
            </div>
            {guide.tip && <p className="text-sm text-muted-foreground">{guide.tip}</p>}
            {guideStep === 6 && firstSetup && (
              <p className="text-sm text-muted-foreground">
                Cadastre seu app na etapa anterior para liberar a conexão.
              </p>
            )}
            {guideStep === 5 && credentialForm}
            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <button
                type="button"
                disabled={guideStep === 0}
                onClick={() => setGuideStep(guideStep - 1)}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary disabled:opacity-45"
              >
                <ArrowLeft className="size-4" aria-hidden /> Voltar
              </button>
              {guideStep === 5 && saveButton}
              {guideStep < metaGuide.length - 1 && guideStep !== 5 && (
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
        ) : (
          <div className="mt-5 space-y-4 border-t border-border pt-5">
            {credentialForm}
            {saveButton}
          </div>
        )}
      </section>
    </div>
  );
}
