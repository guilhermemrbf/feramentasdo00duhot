import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import {
  UploadCloud,
  Copy,
  Check,
  ExternalLink,
  RotateCcw,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { AppShell, PageIntro } from "@/components/AppShell";
import { ACCEPTED_IMAGE_TYPES, uploadToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/image-links")({
  head: () => ({
    meta: [
      { title: "Image Links — Scale Up Hub" },
      {
        name: "description",
        content:
          "Envie várias imagens de uma vez e receba links públicos diretos em URL, Markdown, HTML ou prompt de IA.",
      },
      { property: "og:title", content: "Image Links — Scale Up Hub" },
      {
        property: "og:description",
        content:
          "Envie várias imagens de uma vez e receba links públicos diretos em URL, Markdown, HTML ou prompt de IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImageLinks,
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

const FORMATS: [Format, string][] = [
  ["url", "URL direta"],
  ["markdown", "Markdown"],
  ["html", "HTML"],
  ["ai", "Prompt IA"],
];

function ImageLinks() {
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
    const id = Math.random().toString(36).slice(2);
    const preview = URL.createObjectURL(file);

    setUploads((prev) => [
      { id, url: "", fileName: file.name, progress: 0, uploading: true, error: null, preview },
      ...prev,
    ]);

    const patch = (p: Partial<UploadedImage>) =>
      setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...p } : u)));

    uploadToCloudinary(file, (progress) => patch({ progress }))
      .then((url) => patch({ url, uploading: false, progress: 100 }))
      .catch((e: Error) => patch({ uploading: false, error: e.message }));
  }, []);

  const uploadFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(uploadFile);
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

  const done = uploads.filter((u) => u.url).length;

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="Ferramenta"
          title="Image Links"
          description="Envie várias imagens ao mesmo tempo e copie o link público de cada uma no formato que você precisa."
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
              dragOver ? "border-primary bg-primary/5" : "hover:border-primary/60 hover:bg-accent/40",
            )}
          >
            <span className="mb-4 flex size-11 items-center justify-center rounded-md bg-secondary text-muted-foreground">
              <UploadCloud className="size-5" />
            </span>
            <p className="text-sm font-semibold text-foreground">
              Arraste as imagens aqui ou clique para selecionar
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PNG, JPG, GIF ou WEBP · vários arquivos de uma vez
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              className="hidden"
              onChange={(e) => uploadFiles(e.target.files)}
            />
          </label>

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
                    <div className="aspect-video overflow-hidden rounded-md border border-border bg-secondary/40">
                      <img
                        src={item.preview}
                        alt={item.fileName}
                        className="size-full object-contain"
                      />
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
                          <Loader2 className="size-3 animate-spin" /> Enviando · {item.progress}%
                        </p>
                      </div>
                    )}

                    {item.error && (
                      <p className="flex items-center gap-1.5 text-xs text-destructive">
                        <AlertCircle className="size-3" /> {item.error}
                      </p>
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
                          title="Abrir imagem"
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
          As imagens ficam hospedadas publicamente no Cloudinary.
        </p>
      </main>
    </AppShell>
  );
}
