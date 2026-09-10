import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import {
  UploadCloud,
  Copy,
  Check,
  ExternalLink,
  RotateCcw,
  ImageIcon,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { ACCEPTED_IMAGE_TYPES, uploadToCloudinary } from "@/lib/cloudinary";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Image Link Generator" },
      {
        name: "description",
        content:
          "Faça upload de imagens e gere links curtos diretos hospedados no Cloudinary.",
      },
      { property: "og:title", content: "Image Link Generator" },
      {
        property: "og:description",
        content:
          "Faça upload de imagens e gere links curtos diretos hospedados no Cloudinary.",
      },
    ],
  }),
  component: Index,
});

type Format = "url" | "markdown" | "html" | "ai";

interface UploadedImage {
  id: string;
  url: string;
  fileName: string;
  progress: number;
  uploading: boolean;
  error: string | null;
  preview: string;
}

const ACCEPTED = ACCEPTED_IMAGE_TYPES;

function Index() {
  const [uploads, setUploads] = useState<UploadedImage[]>([]);
  const [format, setFormat] = useState<Format>("url");
  const [dragOver, setDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setUploads([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const uploadFile = useCallback((file: File) => {
    const id = Math.random().toString(36).substring(7);
    const preview = URL.createObjectURL(file);

    const newUpload: UploadedImage = {
      id,
      url: "",
      fileName: file.name,
      progress: 0,
      uploading: true,
      error: null,
      preview,
    };

    setUploads((prev) => [newUpload, ...prev]);

    const patch = (p: Partial<UploadedImage>) =>
      setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...p } : u)));

    uploadToCloudinary(file, (progress) => patch({ progress }))
      .then((url) => patch({ url, uploading: false, progress: 100 }))
      .catch((e: Error) => patch({ uploading: false, error: e.message }));
  }, []);

  const uploadFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => uploadFile(file));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  };

  const getFormatted = (item: UploadedImage) => {
    if (!item.url) return "";
    switch (format) {
      case "markdown":
        return `![${item.fileName}](${item.url})`;
      case "html":
        return `<img src="${item.url}" alt="${item.fileName}" />`;
      case "ai":
        return `Use this image as reference: ${item.url}`;
      default:
        return item.url;
    }
  };

  const copy = async (item: UploadedImage) => {
    const text = getFormatted(item);
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary">
      <main className="mx-auto max-w-3xl px-4 py-12 md:py-20">
        <header className="mb-10 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <ImageIcon className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Image Link Generator
          </h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            Envie múltiplas imagens e receba links diretos instantaneamente.
          </p>
          <Link
            to="/criar-pagina"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10"
          >
            <Sparkles className="h-4 w-4" /> Criar Minha Página
          </Link>
        </header>

        <div className="space-y-6">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-card px-6 py-12 text-center transition shadow-sm ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-secondary/50"
            }`}
          >
            <UploadCloud className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-base font-medium text-foreground">
              Arraste as imagens aqui ou clique para selecionar
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PNG, JPG, GIF ou WEBP (Múltiplos arquivos)
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED.join(",")}
              className="hidden"
              onChange={(e) => uploadFiles(e.target.files)}
            />
          </label>

          {uploads.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["url", "URL direta"],
                    ["markdown", "Markdown"],
                    ["html", "HTML"],
                    ["ai", "Prompt IA"],
                  ] as [Format, string][]
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setFormat(k)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      format === k
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary"
              >
                <RotateCcw className="h-3 w-3" /> Limpar tudo
              </button>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {uploads.map((item) => (
              <div
                key={item.id}
                className="group relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="aspect-video overflow-hidden rounded-lg border border-border bg-secondary/30">
                  <img
                    src={item.preview}
                    alt={item.fileName}
                    className="h-full w-full object-contain"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-xs font-medium text-muted-foreground">
                      {item.fileName}
                    </p>
                    {item.progress === 100 && !item.error && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                  </div>

                  {item.uploading && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}

                  {item.error && (
                    <div className="flex items-center gap-1.5 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {item.error}
                    </div>
                  )}

                  {item.url && (
                    <div className="mt-1 flex gap-2">
                      <button
                        onClick={() => copy(item)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="h-3 w-3" /> Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copiar
                          </>
                        )}
                      </button>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition hover:bg-secondary"
                        title="Abrir imagem"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-12 text-center text-xs text-muted-foreground">
          Hospedado via Cloudinary · As imagens enviadas ficam públicas
        </p>
      </main>
    </div>
  );
}
