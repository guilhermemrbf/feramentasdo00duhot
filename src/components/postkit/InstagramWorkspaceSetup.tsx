import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, X } from "lucide-react";
import {
  getInstagramWorkspaceApp,
  registerInstagramWorkspaceApp,
} from "@/lib/api/instagram-workspace-app.functions";
import { metaGuide } from "./instagram-meta-guide";

export type WorkspaceAppStatus = Awaited<ReturnType<typeof getInstagramWorkspaceApp>>;
type Step = {
  title: string;
  done: boolean;
  description?: string;
  action?: string;
  run?: () => void;
  onGuide?: () => void;
};

export const instagramAppStepTitle = "Criar o app na Meta e cadastrar aqui";
export const instagramOnboardingSteps = [
  "Conectar a primeira conta do Instagram",
  "Subir os primeiros vídeos",
  "Agendar o primeiro post ou lote",
  "Primeira publicação no ar",
];

export function InstagramFirstSteps({ steps, onHide }: { steps: Step[]; onHide: () => void }) {
  const completed = steps.filter(({ done }) => done).length;
  const active = steps.findIndex(({ done }) => !done);
  return (
    <section aria-labelledby="instagram-first-steps" className="postkit-card postkit-first-steps">
      <div className="postkit-steps-header">
        <div>
          <h2 id="instagram-first-steps">Primeiros passos</h2>
          <p>Do cadastro à primeira publicação. Cada passo se marca sozinho.</p>
        </div>
        <div className="postkit-steps-progress">
          <progress
            value={completed}
            max={steps.length}
            aria-label="Progresso dos primeiros passos"
          />
          <span>
            {completed} de {steps.length}
          </span>
          <button
            type="button"
            onClick={onHide}
            title="Ocultar primeiros passos"
            aria-label="Ocultar primeiros passos"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <ol>
        {steps.map(({ title, done, description, action, run, onGuide }, index) => (
          <li key={title} data-active={index === active} data-done={done}>
            <span className="postkit-step-number">
              {done ? <Check className="size-4" role="img" aria-label="Concluído" /> : index + 1}
            </span>
            <div>
              <p>
                {title}
                <span className="sr-only">{done ? " (concluído)" : " (falta)"}</span>
              </p>
              {description && <p className="postkit-step-description">{description}</p>}
            </div>
            {!done && (action || onGuide) && (
              <div className="postkit-step-actions">
                {onGuide && (
                  <button
                    type="button"
                    onClick={onGuide}
                    className="postkit-text-button postkit-muted"
                  >
                    ver como fazer
                  </button>
                )}
                {action && (
                  <button
                    type="button"
                    onClick={run}
                    disabled={!run}
                    className={index === active && run ? "postkit-primary" : "postkit-text-button"}
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

export function InstagramWorkspaceSetup({
  app,
  workspaceId,
  onSaved,
  initialGuideStep,
  onConnect,
}: {
  app: WorkspaceAppStatus;
  workspaceId: string;
  onSaved: () => Promise<void>;
  initialGuideStep?: number;
  onConnect: () => void;
}) {
  const firstSetup = app.mode === "missing";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [guideStep, setGuideStep] = useState(initialGuideStep ?? (firstSetup ? 0 : 5));
  const heading = useRef<HTMLHeadingElement>(null);
  const guide = metaGuide[guideStep];
  const goTo = (step: number) => {
    setGuideStep(step);
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "nearest" });
    });
  };

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
        goTo(6);
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
    <section className="postkit-card postkit-guide" aria-label="Guia de configuração do Meta">
      <h2>Como criar o app na Meta, passo a passo</h2>
      <div className="postkit-guide-body">
        <nav className="postkit-guide-steps" aria-label="Passos do guia">
          {metaGuide.map(({ title }, index) => (
            <button
              type="button"
              key={title}
              aria-current={index === guideStep ? "step" : undefined}
              aria-label={`Passo ${index + 1}: ${title}`}
              title={title}
              onClick={() => goTo(index)}
            />
          ))}
        </nav>
        <div className="postkit-guide-intro">
          <p className="postkit-muted">
            Passo {guideStep + 1} de {metaGuide.length}
          </p>
          <h3 ref={heading} tabIndex={-1}>
            {guide.title}
          </h3>
          <p className="postkit-guide-instruction">{guide.instruction}</p>
        </div>
        {guideStep === 0 && (
          <a
            className="postkit-outlined"
            href="https://developers.facebook.com"
            target="_blank"
            rel="noreferrer"
          >
            Abrir developers.facebook.com <ArrowRight className="size-4" aria-hidden />
          </a>
        )}
        <div>
          <p className="postkit-muted">Na Meta, clique em</p>
          <ol className="postkit-guide-controls">
            {guide.controls.map((control, index) => (
              <li key={control}>
                {index > 0 && <ArrowRight className="size-3.5" aria-hidden />}
                <span>{control}</span>
              </li>
            ))}
          </ol>
        </div>
        {guideStep === 3 && <code>instagram_manage_insights</code>}
        {guideStep === 4 && (
          <div className="postkit-callback">
            <code>{app.callbackUrl}</code>
            <button
              type="button"
              className="postkit-outlined"
              onClick={() => {
                void navigator.clipboard
                  .writeText(app.callbackUrl)
                  .then(() => setCopyStatus("Endereço copiado."))
                  .catch(() => setCopyStatus("Selecione e copie o endereço acima."));
              }}
            >
              <Copy className="size-4" aria-hidden /> Copiar
            </button>
            {copyStatus && <p role="status">{copyStatus}</p>}
          </div>
        )}
        <figure className="postkit-guide-visual">
          <p className="postkit-muted">O que você deve estar vendo</p>
          <figcaption>{guide.expected}</figcaption>
          {guide.images.map(([file, alt]) => {
            const src = `/tutorial-meta/meta-${file}.webp`;
            return (
              <a href={src} target="_blank" rel="noreferrer" key={file}>
                <img src={src} alt={alt} />
              </a>
            );
          })}
          <p className="postkit-muted">Clique ou toque na imagem para ver inteira.</p>
        </figure>
        {guide.tip && <p className="postkit-guide-tip">{guide.tip}</p>}
        {app.canManage ? (
          <form
            hidden={guideStep !== 5}
            aria-label="Cadastro do app Meta"
            method="post"
            className="postkit-credentials"
            onSubmit={(event) => void submit(event)}
          >
            <div className="postkit-credentials-grid">
              <label>
                ID do Aplicativo
                <input
                  name="appId"
                  required
                  inputMode="numeric"
                  maxLength={32}
                  defaultValue={app.appId}
                  placeholder="só números"
                />
              </label>
              <label>
                Chave Secreta do Aplicativo
                <input
                  name="appSecret"
                  type="password"
                  autoComplete="off"
                  maxLength={32}
                  required
                  placeholder="a chave secreta"
                />
              </label>
              <label>
                Identificação da configuração
                <input
                  name="configId"
                  required
                  inputMode="numeric"
                  maxLength={32}
                  defaultValue={app.configId}
                  placeholder="só números"
                />
              </label>
            </div>
            <p className="postkit-muted">
              O ID e a chave ficam em Configurações do app → Básico. A identificação da configuração
              fica no quadro API do Instagram (login unificado).
            </p>
            {error && (
              <p role="alert" className="text-red-300">
                {error}
              </p>
            )}
            <button type="submit" className="postkit-primary" disabled={saving}>
              {saving ? "Validando com a Meta…" : "Cadastrar"}
            </button>
          </form>
        ) : guideStep === 5 ? (
          <p>Peça ao responsável pela operação para concluir o cadastro.</p>
        ) : null}
        {guide.commonIssue && (
          <details key={guideStep} className="postkit-guide-issues">
            <summary>Erros comuns neste passo</summary>
            <p>{guide.commonIssue}</p>
          </details>
        )}
        <div className="postkit-guide-footer">
          <button
            type="button"
            className="postkit-outlined"
            disabled={guideStep === 0}
            onClick={() => goTo(guideStep - 1)}
          >
            <ArrowLeft className="size-4" aria-hidden /> Voltar
          </button>
          {guideStep < metaGuide.length - 1 ? (
            <button type="button" className="postkit-primary" onClick={() => goTo(guideStep + 1)}>
              Próximo <ArrowRight className="size-4" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              className="postkit-primary"
              onClick={firstSetup ? () => goTo(5) : onConnect}
            >
              {firstSetup ? "Ir para o cadastro" : "Conectar a primeira conta"}{" "}
              <ArrowRight className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
