import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import {
  UploadCloud,
  Copy,
  Check,
  ExternalLink,
  RotateCcw,
  ImageIcon,
  AlertCircle,
} from "lucide-react";

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

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;
const ACCEPTED = ["image/png", "image/jpeg", "image/gif", "image/webp"];

function Index() {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<Format>("url");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPreview(null);
    setFileName("");
    setProgress(0);
    setUploading(false);
    setUrl(null);
    setError(null);
    setCopied(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const upload = useCallback((file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      setError("Formato inválido. Use PNG, JPG, GIF ou WEBP.");
      return;
    }
    if (!CLOUD_NAME || !UPLOAD_PRESET || CLOUD_NAME === "your_cloud_name") {
      setError(
        "Configure VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET no .env",
      );
      return;
    }

    setError(null);
    setUrl(null);
    setFileName(file.name);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    );

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      setUploading(false);
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && res.secure_url) {
          setUrl(res.secure_url);
          setProgress(100);
        } else {
          setError(res.error?.message || "Falha no upload. Verifique seu preset.");
        }
      } catch {
        setError("Resposta inválida do servidor.");
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setError("Erro de rede ao enviar a imagem.");
    };

    xhr.send(formData);
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  };

  const formatted = (() => {
    if (!url) return "";
    switch (format) {
      case "markdown":
        return `![${fileName}](${url})`;
      case "html":
        return `<img src="${url}" alt="${fileName}" />`;
      case "ai":
        return `Use this image as reference: ${url}`;
      default:
        return url;
    }
  })();

  const copy = async () => {
    if (!formatted) return;
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary">
      <main className="mx-auto max-w-2xl px-4 py-12 md:py-20">
        <header className="mb-10 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <ImageIcon className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Image Link Generator
          </h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            Envie uma imagem e receba um link direto instantaneamente.
          </p>
        </header>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
          {!preview && (
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-16 text-center transition ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-secondary/50"
              }`}
            >
              <UploadCloud className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-base font-medium text-foreground">
                Arraste a imagem aqui ou clique para selecionar
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PNG, JPG, GIF ou WEBP
              </p>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED.join(",")}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                }}
              />
            </label>
          )}

          {preview && (
            <div className="space-y-5">
              <div className="overflow-hidden rounded-xl border border-border bg-secondary/30">
                <img
                  src={preview}
                  alt={fileName}
                  className="mx-auto max-h-80 w-auto object-contain"
                />
              </div>

              {uploading && (
                <div>
                  <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                    <span>Enviando…</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {url && (
                <div className="space-y-3">
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

                  <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 p-2">
                    <input
                      readOnly
                      value={formatted}
                      onClick={(e) => e.currentTarget.select()}
                      className="flex-1 bg-transparent px-2 text-sm text-foreground outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={copy}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4" /> Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" /> Copiar link
                        </>
                      )}
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary"
                    >
                      <ExternalLink className="h-4 w-4" /> Abrir
                    </a>
                    <button
                      onClick={reset}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary"
                    >
                      <RotateCcw className="h-4 w-4" /> Nova
                    </button>
                  </div>
                </div>
              )}

              {!url && !uploading && (
                <button
                  onClick={reset}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary"
                >
                  <RotateCcw className="h-4 w-4" /> Nova imagem
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Hospedado via Cloudinary · As imagens enviadas ficam públicas
        </p>
      </main>
    </div>
  );
}
