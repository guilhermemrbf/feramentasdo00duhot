import { mediaItemId } from "@/lib/media/files";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  UploadCloud,
  Copy,
  Check,
  ExternalLink,
  RotateCcw,
  AlertCircle,
  Loader2,
  Film,
} from "lucide-react";
import { AppShell, PageIntro } from "@/components/AppShell";
import { ACCEPTED_MEDIA_TYPES, uploadToCloudinary } from "@/lib/cloudinary";
import { selectMediaFiles, formatMediaLink } from "@/lib/media/selection";
import { downloadBlob } from "@/lib/media/files";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/image-links")({
  head: () => ({
    meta: [
      { title: "Image Links — 00duHot" },
      {
        name: "description",
        content:
          "Envie imagens e vídeos e receba links públicos diretos em URL, Markdown, HTML ou prompt de IA.",
      },
      { property: "og:title", content: "Image Links — 00duHot" },
      {
        property: "og:description",
        content:
          "Envie imagens e vídeos e receba links públicos diretos em URL, Markdown, HTML ou prompt de IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImageLinks,
});

type Format = "url" | "markdown" | "html" | "ai";

interface UploadedMedia {
  id: string;
  url: string;
  fileName: string;
  progress: number;
  uploading: boolean;
  error: string | null;
  preview: string;
  type: "image" | "video";
  file: File;
}

const FORMATS: [Format, string][] = [
  ["url", "URL direta"],
  ["markdown", "Markdown"],
  ["html", "HTML"],
  ["ai", "Prompt IA"],
];

function ImageLinks() {
  const [uploads, setUploads] = useState<UploadedMedia[]>([]);
  const [format, setFormat] = useState<Format>("url");
  const [dragOver, setDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const operation = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const previews = useRef(new Set<string>());
  useEffect(
    () => () => {
      operation.current?.abort();
      previews.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  const reset = () => {
    if (inFlight.current) return;
    previews.current.forEach((url) => URL.revokeObjectURL(url));
    previews.current.clear();
    setUploads([]);
    setNotice("Lista limpa. Arquivos já enviados continuam na hospedagem.");
    if (inputRef.current) inputRef.current.value = "";
  };
  const patch = (id: string, value: Partial<UploadedMedia>) =>
    setUploads((current) => current.map((item) => (item.id === id ? { ...item, ...value } : item)));
  const run = async (records: UploadedMedia[]) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const controller = new AbortController();
    operation.current = controller;
    try {
      for (const item of records) {
        if (controller.signal.aborted) break;
        setActiveId(item.id);
        patch(item.id, { uploading: true, error: null, progress: 0 });
        try {
          const url = await uploadToCloudinary(
            item.file,
            (progress) => patch(item.id, { progress }),
            controller.signal,
          );
          patch(item.id, { url, uploading: false, progress: 100 });
        } catch (error) {
          patch(item.id, {
            uploading: false,
            error: error instanceof Error ? error.message : "Não foi possível enviar o arquivo.",
          });
        }
      }
    } finally {
      if (controller.signal.aborted)
        setUploads((current) =>
          current.map((item) =>
            item.uploading
              ? {
                  ...item,
                  uploading: false,
                  error: "Envio cancelado. Se necessário, envie novamente.",
                }
              : item,
          ),
        );
      setActiveId(null);
      setBusy(false);
      inFlight.current = false;
    }
  };
  const uploadFiles = (files: FileList | null) => {
    if (!files) return;
    if (inFlight.current) {
      setNotice("Aguarde os envios ou cancele a operação antes de adicionar novos arquivos.");
      return;
    }
    const selection = selectMediaFiles(
      Array.from(files),
      uploads.map((item) => item.file),
      ACCEPTED_MEDIA_TYPES,
    );
    const records: UploadedMedia[] = selection.accepted.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return {
        id: mediaItemId(),
        url: "",
        fileName: file.name,
        progress: 0,
        uploading: true,
        error: null,
        preview,
        type: file.type.startsWith("video/") ? "video" : "image",
        file,
      };
    });
    setNotice(
      `${records.length} arquivos adicionados${selection.rejected ? `; ${selection.rejected} ignorados por formato, arquivo vazio ou duplicidade` : ""}.`,
    );
    setUploads((current) => [...records, ...current]);
    if (records.length) void run(records);
  };
  const getFormatted = (item: UploadedMedia) => (item.url ? formatMediaLink(item, format) : "");
  const copy = async (item: UploadedMedia) => {
    try {
      await navigator.clipboard.writeText(getFormatted(item));
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setNotice(
        "Não foi possível copiar automaticamente. Selecione o texto do link e copie manualmente.",
      );
    }
  };
  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(
        uploads
          .filter((item) => item.url)
          .map(getFormatted)
          .join("\n"),
      );
      setNotice("Links prontos copiados.");
    } catch {
      setNotice("Não foi possível copiar. Use Baixar links para salvar os resultados.");
    }
  };
  const exportLinks = () =>
    downloadBlob(
      new Blob(
        [
          uploads
            .filter((item) => item.url)
            .map(getFormatted)
            .join("\n"),
        ],
        { type: "text/plain;charset=utf-8" },
      ),
      "00duhot-links.txt",
    );

  const done = uploads.filter((u) => u.url).length;

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="Ferramenta"
          title="Image Links"
          description="Envie imagens e vídeos ao mesmo tempo e copie o link público de cada arquivo no formato que você precisa."
        />

        <div className="mt-8 space-y-6">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              uploadFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center transition-colors",
              dragOver
                ? "border-primary bg-primary/5"
                : "hover:border-primary/60 hover:bg-accent/40",
            )}
          >
            <span className="mb-4 flex size-11 items-center justify-center rounded-md bg-secondary text-muted-foreground">
              <UploadCloud className="size-5" />
            </span>
            <p className="text-sm font-semibold text-foreground">
              Arraste imagens ou vídeos aqui ou clique para selecionar
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PNG, JPG, GIF, WEBP, MP4, WEBM ou MOV · vários arquivos de uma vez
            </p>
            <input
              ref={inputRef}
              type="file"
              disabled={busy}
              multiple
              accept={ACCEPTED_MEDIA_TYPES.join(",")}
              className="hidden"
              onChange={(e) => uploadFiles(e.target.files)}
            />
          </label>

          {notice && (
            <p role="status" className="text-xs leading-6 text-muted-foreground">
              {notice}
            </p>
          )}
          <p className="text-xs leading-6 text-muted-foreground">
            Os arquivos são enviados ao Cloudinary e ficam públicos. Limpar a lista não exclui
            arquivos da hospedagem.
          </p>
          {busy && (
            <button
              onClick={() => operation.current?.abort()}
              className="rounded-md border border-border px-3 py-2 text-xs"
            >
              Cancelar envios
            </button>
          )}
          {uploads.length > 0 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div className="flex flex-wrap gap-1.5">
                  {FORMATS.map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() => setFormat(k)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        format === k
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {done}/{uploads.length} prontas
                  </span>
                  <button
                    disabled={!done}
                    onClick={copyAll}
                    className="text-xs text-primary disabled:opacity-40"
                  >
                    Copiar todos
                  </button>
                  <button
                    disabled={!done}
                    onClick={exportLinks}
                    className="text-xs text-primary disabled:opacity-40"
                  >
                    Baixar links
                  </button>
                  <button
                    disabled={busy}
                    onClick={reset}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <RotateCcw className="size-3" /> Limpar tudo
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {uploads.map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-secondary/40">
                      {item.type === "video" ? (
                        <video
                          src={item.preview}
                          controls
                          muted
                          preload="metadata"
                          className="size-full object-contain"
                        />
                      ) : (
                        <img
                          src={item.preview}
                          alt={item.fileName}
                          className="size-full object-contain"
                        />
                      )}
                      {item.type === "video" && (
                        <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
                          <Film className="size-3" /> Vídeo
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-muted-foreground">{item.fileName}</p>
                      {item.url && <Check className="size-4 shrink-0 text-success" />}
                    </div>

                    {item.uploading && (
                      <div className="space-y-1.5">
                        <div className="h-1 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <p className="flex items-center gap-1.5 text-xs text-primary">
                          <Loader2 className="size-3 animate-spin" />{" "}
                          {activeId === item.id ? `Enviando · ${item.progress}%` : "Na fila"}
                        </p>
                      </div>
                    )}

                    {item.error && (
                      <p className="flex items-center gap-1.5 text-xs text-destructive">
                        <AlertCircle className="size-3" /> {item.error}
                      </p>
                    )}

                    {item.error && !busy && (
                      <button
                        onClick={() => void run([item])}
                        className="text-left text-xs text-primary"
                      >
                        Enviar novamente
                      </button>
                    )}
                    {item.url && (
                      <input
                        aria-label={`Link de ${item.fileName}`}
                        readOnly
                        value={getFormatted(item)}
                        onFocus={(event) => event.target.select()}
                        className="workspace-input"
                      />
                    )}
                    {item.url && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => copy(item)}
                          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-primary text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="size-3.5" /> Copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="size-3.5" /> Copiar link
                            </>
                          )}
                        </button>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={item.type === "video" ? "Abrir vídeo" : "Abrir imagem"}
                          className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
        </div>

        <p className="mt-12 text-xs text-muted-foreground">
          Imagens e vídeos ficam hospedados publicamente no Cloudinary.
        </p>
      </main>
    </AppShell>
  );
}
