import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Copy, Check, RotateCcw, Loader2 } from "lucide-react";
import { AppShell, PageIntro } from "@/components/AppShell";
import { ImageField } from "@/components/ImageField";
import { buildPrompt, type PageData } from "@/lib/prompt-template";

export const Route = createFileRoute("/criar-pagina")({
  head: () => ({
    meta: [
      { title: "Criar Minha Página — Scale Up Hub" },
      {
        name: "description",
        content:
          "Envie suas fotos, informe nome, @ e descrição e receba um prompt completo pronto para colar na Lovable.",
      },
      { property: "og:title", content: "Criar Minha Página — Scale Up Hub" },
      {
        property: "og:description",
        content:
          "Envie suas fotos, informe nome, @ e descrição e receba um prompt completo pronto para colar na Lovable.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CriarPagina,
});

type Stage = "form" | "processing" | "done";

const EMPTY: PageData = {
  fotoPerfilUrl: "",
  fotoCapaUrl: "",
  nomePerfil: "",
  arrobaPerfil: "",
  descricaoPerfil: "",
};

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

function CriarPagina() {
  const [data, setData] = useState<PageData>(EMPTY);
  const [stage, setStage] = useState<Stage>("form");
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof PageData>(key: K, value: PageData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const ready = Boolean(
    data.fotoPerfilUrl &&
      data.fotoCapaUrl &&
      data.nomePerfil.trim() &&
      data.arrobaPerfil.trim() &&
      data.descricaoPerfil.trim(),
  );

  const generate = () => {
    if (!ready) return;
    setStage("processing");
    setTimeout(() => {
      setPrompt(buildPrompt(data));
      setStage("done");
    }, 700);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="Ferramenta"
          title="Criar Minha Página"
          description="Preencha as informações abaixo e receba o prompt completo, pronto para colar e gerar sua página."
        />

        <div className="mt-8">
          {stage === "form" && (
            <div className="space-y-4">
              <ImageField
                step={1}
                label="Foto de perfil"
                value={data.fotoPerfilUrl}
                onChange={(url) => set("fotoPerfilUrl", url)}
              />
              <ImageField
                step={2}
                label="Foto de capa"
                value={data.fotoCapaUrl}
                onChange={(url) => set("fotoCapaUrl", url)}
              />

              <Field step={3} label="Nome do perfil">
                <input
                  className={inputClass}
                  placeholder="Maria Silva"
                  value={data.nomePerfil}
                  onChange={(e) => set("nomePerfil", e.target.value)}
                />
              </Field>

              <Field step={4} label="@ do perfil">
                <input
                  className={inputClass}
                  placeholder="@mariasilva"
                  value={data.arrobaPerfil}
                  onChange={(e) => set("arrobaPerfil", e.target.value)}
                />
              </Field>

              <Field
                step={5}
                label="Descrição do perfil"
                hint="Usada exatamente como você escrever, sem alterações."
              >
                <textarea
                  className={`${inputClass} min-h-28 resize-y`}
                  placeholder="Escreva a descrição da sua página..."
                  value={data.descricaoPerfil}
                  onChange={(e) => set("descricaoPerfil", e.target.value)}
                />
              </Field>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={generate}
                  disabled={!ready}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sparkles className="size-4" /> Gerar meu prompt
                </button>
                {!ready && (
                  <p className="text-xs text-muted-foreground">
                    Envie as duas fotos e preencha todos os campos.
                  </p>
                )}
              </div>
            </div>
          )}

          {stage === "processing" && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-20">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processando informações...</p>
            </div>
          )}

          {stage === "done" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Check className="size-4 text-success" /> Seu prompt está pronto
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStage("form")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <RotateCcw className="size-3" /> Editar dados
                  </button>
                  <button
                    onClick={copy}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3.5" /> Prompt copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" /> Copiar prompt
                      </>
                    )}
                  </button>
                </div>
              </div>
              <pre className="max-h-[30rem] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-4 font-mono text-xs leading-relaxed text-foreground">
                {prompt}
              </pre>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}

function Field({
  step,
  label,
  hint,
  children,
}: {
  step: number;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="inline-flex size-6 items-center justify-center rounded-md bg-secondary text-xs text-primary">
          {step}
        </span>
        {label}
      </label>
      {children}
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
