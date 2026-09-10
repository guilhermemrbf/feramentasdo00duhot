import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Copy, Check, RotateCcw, Loader2, ArrowLeft } from "lucide-react";
import { ImageField } from "@/components/ImageField";
import { buildPrompt, type PageData } from "@/lib/prompt-template";

export const Route = createFileRoute("/criar-pagina")({
  head: () => ({
    meta: [
      { title: "Criar Minha Página — Gerador de Prompt" },
      {
        name: "description",
        content:
          "Envie suas fotos, informe nome, @ e descrição e receba um prompt completo pronto para colar na Lovable.",
      },
      { property: "og:title", content: "Criar Minha Página — Gerador de Prompt" },
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

function CriarPagina() {
  const [data, setData] = useState<PageData>(EMPTY);
  const [stage, setStage] = useState<Stage>("form");
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof PageData>(key: K, value: PageData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const ready =
    data.fotoPerfilUrl &&
    data.fotoCapaUrl &&
    data.nomePerfil.trim() &&
    data.arrobaPerfil.trim() &&
    data.descricaoPerfil.trim();

  const generate = () => {
    if (!ready) return;
    setStage("processing");
    setTimeout(() => {
      setPrompt(buildPrompt(data));
      setStage("done");
    }, 900);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary">
      <main className="mx-auto max-w-3xl px-4 py-12 md:py-20">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Gerador de links
        </Link>

        <header className="mb-10 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Criar Minha Página
          </h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            Preencha as informações e receba um prompt completo pronto para colar na Lovable.
          </p>
        </header>

        {stage === "form" && (
          <div className="space-y-5">
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
              label="Nova descrição do perfil"
              hint="Será usada exatamente como você escrever."
            >
              <textarea
                className={`${inputClass} min-h-32 resize-y`}
                placeholder="Escreva a descrição da sua página..."
                value={data.descricaoPerfil}
                onChange={(e) => set("descricaoPerfil", e.target.value)}
              />
            </Field>

            <button
              onClick={generate}
              disabled={!ready}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="h-4 w-4" /> Gerar Meu Prompt
            </button>
            {!ready && (
              <p className="text-center text-xs text-muted-foreground">
                Envie as duas fotos e preencha todos os campos para continuar.
              </p>
            )}
          </div>
        )}

        {stage === "processing" && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card py-20 shadow-sm">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Processando informações...</p>
          </div>
        )}

        {stage === "done" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Check className="h-5 w-5 text-green-500" /> Seu prompt está pronto!
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setStage("form")}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition hover:bg-secondary"
                >
                  <RotateCcw className="h-3 w-3" /> Gerar Novamente
                </button>
                <button
                  onClick={copy}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3" /> Prompt copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copiar Prompt
                    </>
                  )}
                </button>
              </div>
            </div>
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-border bg-card p-5 font-mono text-xs leading-relaxed text-foreground shadow-sm">
              {prompt}
            </pre>
            <p className="text-center text-xs text-muted-foreground">
              Cole este prompt na Lovable para clonar e personalizar sua página.
            </p>
          </div>
        )}
      </main>
    </div>
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
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
          {step}
        </span>
        {label}
      </label>
      {children}
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
