import { useEffect, useRef, useState } from "react";
import { createClientOnlyFn } from "@tanstack/react-start";
import { Code2, Copy, Download, FileImage, FileText, LoaderCircle, Upload, X } from "lucide-react";
import type { Funnel } from "@/lib/funnel-model";
import {
  createFunnelCode,
  flowFilename,
  MAX_FLOW_CODE_BYTES,
  parseFunnelCode,
} from "@/lib/funnel-sharing";

const loadExportTools = createClientOnlyFn(() => import("@/lib/funnel-export.client"));

export function FunnelShareDialog({
  funnel,
  initialMode,
  canvas,
  readImage,
  onImport,
  onClose,
}: {
  funnel: Funnel | null;
  initialMode: "export" | "import";
  canvas: () => HTMLElement | null;
  readImage: (key: string) => Promise<Blob | undefined>;
  onImport: (funnel: Funnel) => Promise<void>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState(initialMode);
  const [code, setCode] = useState("");
  const [incoming, setIncoming] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, []);
  const run = async (label: string, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(label);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Não foi possível concluir. Tente novamente.",
      );
    } finally {
      setBusy("");
    }
  };
  const prepareCode = async () => {
    if (!funnel) throw new Error("Abra um funil para exportar.");
    const value = code || (await createFunnelCode(funnel, readImage));
    setCode(value);
    return value;
  };
  const exportFile = (format: "pdf" | "png") =>
    run(`Gerando ${format.toUpperCase()}…`, async () => {
      const element = canvas();
      if (!funnel || !element) throw new Error("Abra o fluxo e aguarde os elementos carregarem.");
      const { exportFunnelFile } = await loadExportTools();
      await exportFunnelFile(funnel, element, format, flowFilename(funnel.name));
      setMessage(`${format.toUpperCase()} gerado. Confira os downloads do navegador.`);
    });
  const buttonClass =
    "flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-40";
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Compartilhar fluxo"
        className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-600 bg-[#141a25] text-slate-200 shadow-2xl outline-none"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) {
            event.stopPropagation();
            onClose();
          }
          if (event.key === "Tab") {
            const controls = Array.from(
              dialog.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled),textarea,input:not([type="file"])',
              ) ?? [],
            ).filter((element) => element.getClientRects().length);
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (
              event.shiftKey &&
              (document.activeElement === first || document.activeElement === dialog.current)
            ) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-700 p-5">
          <div>
            <h2 className="text-lg font-bold text-white">Compartilhar fluxo</h2>
            <p className="mt-1 text-xs text-slate-400">
              {funnel?.name ?? "Importe um projeto para começar."}
            </p>
          </div>
          <button
            disabled={!!busy}
            onClick={onClose}
            aria-label="Fechar compartilhamento"
            className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-40"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="flex gap-2 border-b border-slate-700 px-5 py-3">
          {funnel && (
            <button
              disabled={!!busy}
              onClick={() => {
                setMode("export");
                setError("");
                setMessage("");
              }}
              aria-pressed={mode === "export"}
              className={`${buttonClass} ${mode === "export" ? "border-blue-400/50 bg-blue-500/15 text-blue-200" : ""}`}
            >
              <Download className="size-4" />
              Exportar fluxo
            </button>
          )}
          <button
            disabled={!!busy}
            onClick={() => {
              setMode("import");
              setError("");
              setMessage("");
            }}
            aria-pressed={mode === "import"}
            className={`${buttonClass} ${mode === "import" ? "border-blue-400/50 bg-blue-500/15 text-blue-200" : ""}`}
          >
            <Code2 className="size-4" />
            Inserir código
          </button>
        </div>
        <div className="space-y-5 overflow-y-auto p-5" aria-busy={!!busy}>
          {mode === "export" && funnel ? (
            <>
              <p className="text-sm leading-6 text-slate-300">
                Exporte o fluxo inteiro com seus elementos e conexões, independentemente do zoom
                atual.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  disabled={!!busy || !funnel.nodes.length}
                  onClick={() => void exportFile("pdf")}
                  className={`${buttonClass} flex-col !items-start border-blue-400/30 bg-blue-500/10 text-left`}
                >
                  <span className="flex items-center gap-2">
                    <FileText className="size-5" />
                    Baixar PDF
                  </span>
                  <span className="text-xs font-normal leading-5 text-slate-400">
                    Uma página com o fluxo completo para ampliar e compartilhar.
                  </span>
                </button>
                <button
                  disabled={!!busy || !funnel.nodes.length}
                  onClick={() => void exportFile("png")}
                  className={`${buttonClass} flex-col !items-start text-left`}
                >
                  <span className="flex items-center gap-2">
                    <FileImage className="size-5" />
                    Baixar imagem PNG
                  </span>
                  <span className="text-xs font-normal leading-5 text-slate-400">
                    Imagem em alta resolução com o fundo quadriculado.
                  </span>
                </button>
              </div>
              <section className="space-y-3 rounded-xl border border-slate-700 bg-[#0d1119]/60 p-4">
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <Code2 className="size-5" />
                  Código editável do fluxo
                </h3>
                <p className="text-xs leading-5 text-slate-400">
                  Inclui textos, cores, tamanhos, conexões e imagens enviadas. Links de imagens
                  externas continuam vinculados à origem. Quem receber pode usar “Inserir código”.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    disabled={!!busy}
                    onClick={() =>
                      void run("Preparando código…", async () => {
                        const value = await prepareCode();
                        try {
                          await navigator.clipboard.writeText(value);
                          setMessage(
                            "Código copiado. Compartilhe com quem quiser importar o fluxo.",
                          );
                        } catch {
                          setMessage(
                            "Código preparado abaixo. Selecione o texto e copie para compartilhar.",
                          );
                        }
                      })
                    }
                    className={`${buttonClass} border-blue-400/40 bg-blue-500/15`}
                  >
                    <Copy className="size-4" />
                    Copiar código
                  </button>
                  <button
                    disabled={!!busy}
                    onClick={() =>
                      void run("Preparando arquivo…", async () => {
                        const value = await prepareCode();
                        const { downloadBlob } = await loadExportTools();
                        downloadBlob(
                          new Blob([value], { type: "application/json;charset=utf-8" }),
                          `${flowFilename(funnel.name)}.json`,
                        );
                        setMessage("Código salvo como arquivo JSON.");
                      })
                    }
                    className={buttonClass}
                  >
                    <Download className="size-4" />
                    Baixar código
                  </button>
                </div>
                {code && (
                  <textarea
                    aria-label="Código do fluxo para copiar"
                    readOnly
                    value={code}
                    onFocus={(event) => event.target.select()}
                    spellCheck={false}
                    className="h-36 w-full rounded-lg border border-slate-600 bg-[#0d1119] p-3 font-mono text-xs text-slate-300 outline-none focus:border-blue-400"
                  />
                )}
              </section>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-slate-300">
                Cole um código exportado pelo Funil ou abra um arquivo JSON. Ele será adicionado
                como um novo projeto.
              </p>
              <textarea
                aria-label="Inserir código do fluxo"
                disabled={!!busy}
                value={incoming}
                onChange={(event) => {
                  setIncoming(event.target.value);
                  setError("");
                }}
                spellCheck={false}
                placeholder="Cole o código completo aqui…"
                className="h-56 w-full rounded-xl border border-slate-600 bg-[#0d1119] p-3 font-mono text-xs text-slate-200 outline-none focus:border-blue-400"
              />
              <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file)
                    void run("Abrindo arquivo…", async () => {
                      if (file.size > MAX_FLOW_CODE_BYTES)
                        throw new Error("O arquivo excede o limite de 24 MB.");
                      setIncoming(await file.text());
                    });
                }}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  disabled={!!busy}
                  onClick={() => fileInput.current?.click()}
                  className={buttonClass}
                >
                  <Upload className="size-4" />
                  Abrir arquivo JSON
                </button>
                <button
                  disabled={!!busy || !incoming.trim()}
                  onClick={() =>
                    void run("Importando fluxo…", async () => {
                      await onImport(parseFunnelCode(incoming));
                      onClose();
                    })
                  }
                  className={`${buttonClass} border-blue-400/40 bg-blue-500/20`}
                >
                  <Code2 className="size-4" />
                  Importar como novo funil
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Limite: 24 MB. Seus projetos existentes são mantidos.
              </p>
            </>
          )}
          {busy && (
            <p role="status" className="flex items-center gap-2 text-sm text-blue-200">
              <LoaderCircle className="size-4 animate-spin" />
              {busy}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm leading-5 text-emerald-200"
            >
              {message}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm leading-5 text-rose-200"
            >
              {error}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
