import { mediaItemId } from "@/lib/media/files";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  FileImage,
  FileVideo,
  Loader2,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { selectMediaFiles } from "@/lib/media/selection";
import { renderLocalVideo } from "@/lib/media/render";
import {
  downloadBlob,
  outputName,
  queueCandidates,
  throwIfAborted,
  isAbort,
} from "@/lib/media/files";
import { AppShell, PageIntro } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { BatchCleaner } from "@/components/metadata/BatchCleaner";

export const Route = createFileRoute("/limpar-metadados")({
  head: () => ({
    meta: [
      { title: "Limpar Metadados — 00duHot" },
      {
        name: "description",
        content:
          "Sanitize fotos e vídeos localmente, removendo metadados incorporados no arquivo processado.",
      },
      { property: "og:title", content: "Limpar Metadados — 00duHot" },
      {
        property: "og:description",
        content:
          "Limpeza individual e em massa de imagens e vídeos, com processamento local e exportação ZIP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LimparMetadados,
});

type MediaType = "photos" | "videos";
type ItemStatus = "waiting" | "processing" | "done" | "error";

interface Item {
  id: string;
  file: File;
  status: ItemStatus;
  output: Blob | null;
  error: string | null;
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

function LimparMetadados() {
  const [type, setType] = useState<MediaType | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectionNotice, setSelectionNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);

  const reset = () => {
    if (busy) return;
    setType(null);
    setItems([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const select = (next: MediaType) => {
    if (busy) return;
    setType(next);
    setItems([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const add = (files: FileList | null) => {
    if (busy || !files || !type) return;

    const accepted = type === "photos" ? IMAGE_TYPES : VIDEO_TYPES;
    const selection = selectMediaFiles(
      Array.from(files),
      items.map((item) => item.file),
      accepted,
    );
    setSelectionNotice(
      `${selection.accepted.length} arquivos adicionados${selection.rejected ? `; ${selection.rejected} ignorados por formato, arquivo vazio ou duplicidade` : ""}.`,
    );
    const nextItems = selection.accepted.map((file) => ({
      id: mediaItemId(),
      file,
      status: "waiting" as const,
      output: null,
      error: null,
    }));

    setItems((current) => [...current, ...nextItems]);
  };

  const patch = (id: string, value: Partial<Item>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...value } : item)));

  const cleanPhoto = async (item: Item) => {
    const url = URL.createObjectURL(item.file);

    try {
      const image = new Image();
      image.src = url;
      await image.decode();

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      const context = canvas.getContext("2d", { alpha: true });
      if (!context) {
        throw new Error("Não foi possível preparar a imagem.");
      }

      context.drawImage(image, 0, 0);

      const outputType = item.file.type === "image/jpeg" ? "image/jpeg" : item.file.type;
      const output = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("Não foi possível gerar a imagem limpa.")),
          outputType,
          outputType === "image/png" ? undefined : 0.95,
        );
      });

      throwIfAborted(operation.current?.signal);
      patch(item.id, { status: "done", output });
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const cleanVideo = async (item: Item) => {
    const output = await renderLocalVideo(
      item.file,
      (context, video, width, height) => context.drawImage(video, 0, 0, width, height),
      operation.current!.signal,
    );
    patch(item.id, { status: "done", output });
  };

  const cleanAll = async () => {
    if (!items.length || !type) return;

    if (busy) return;
    operation.current = new AbortController();
    setBusy(true);

    for (const item of queueCandidates(items)) {
      if (operation.current.signal.aborted) break;
      patch(item.id, { status: "processing", error: null });

      try {
        if (type === "photos") {
          await cleanPhoto(item);
        } else {
          await cleanVideo(item);
        }
      } catch (error) {
        if (isAbort(error)) {
          patch(item.id, { status: "waiting", error: null });
          break;
        }
        patch(item.id, {
          status: "error",
          error: error instanceof Error ? error.message : "Não foi possível limpar este arquivo.",
        });
      }
    }

    setBusy(false);
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="Privacidade"
          title="Limpar Metadados"
          description="Reprocesse fotos e vídeos localmente para remover os metadados incorporados no arquivo final."
        />

        {!type ? (
          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            <Choice
              icon={FileImage}
              title="Fotos"
              text="Recrie a imagem sem os blocos de metadados incorporados, incluindo EXIF, GPS, IPTC e XMP quando presentes."
              onClick={() => select("photos")}
            />
            <Choice
              icon={FileVideo}
              title="Vídeos"
              text="Regrave o vídeo em um novo contêiner WEBM, removendo os metadados do arquivo original."
              onClick={() => select("videos")}
            />
          </section>
        ) : (
          <section className="mt-8 space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                Limpeza de {type === "photos" ? "fotos" : "vídeos"}
              </p>
              <button
                disabled={busy}
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs"
              >
                <RotateCcw className="size-3" /> Trocar tipo
              </button>
            </div>

            <label
              onDrop={(event) => {
                event.preventDefault();
                add(event.dataTransfer.files);
              }}
              onDragOver={(event) => event.preventDefault()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center hover:border-primary/60"
            >
              <UploadCloud className="mb-4 size-6 text-primary" />
              <p className="text-sm font-semibold">
                Arraste os arquivos aqui ou clique para selecionar
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {type === "photos" ? "JPG, PNG, WEBP ou AVIF" : "MP4, WEBM ou MOV"} · vários
                arquivos
              </p>
              <input
                ref={inputRef}
                type="file"
                disabled={busy}
                multiple
                accept={(type === "photos" ? IMAGE_TYPES : VIDEO_TYPES).join(",")}
                className="hidden"
                onChange={(event) => add(event.target.files)}
              />
            </label>

            {selectionNotice && (
              <p role="status" className="text-xs text-muted-foreground">
                {selectionNotice}
              </p>
            )}
            {busy && (
              <div
                role="status"
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-4 text-xs"
              >
                <span>
                  Processando neste dispositivo. Você pode cancelar sem perder os arquivos já
                  concluídos.
                </span>
                <button
                  onClick={() => operation.current?.abort()}
                  className="shrink-0 rounded border border-border px-3 py-2"
                >
                  Cancelar processamento
                </button>
              </div>
            )}

            {items.length > 0 && (
              <>
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <span className="text-xs text-muted-foreground">
                    {items.filter((item) => item.status === "done").length}/{items.length} limpos
                  </span>
                  <button
                    disabled={busy}
                    onClick={cleanAll}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <ShieldCheck className="size-3" />
                    )}
                    {busy ? "Limpando..." : "Limpar metadados"}
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item) => (
                    <article
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"
                    >
                      <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-primary">
                        {type === "photos" ? (
                          <FileImage className="size-5" />
                        ) : (
                          <FileVideo className="size-5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{item.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(item.file.size / 1048576).toFixed(2)} MB
                        </p>
                        {item.error && (
                          <p className="mt-1 text-xs text-destructive">{item.error}</p>
                        )}
                      </div>

                      {item.status === "processing" && (
                        <Loader2 className="size-4 animate-spin text-primary" />
                      )}

                      {item.status === "done" && item.output && (
                        <button
                          onClick={() =>
                            downloadBlob(
                              item.output!,
                              outputName(item.file.name, "limpo-", item.output!.type),
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                        >
                          <Download className="size-3" />
                          Baixar
                        </button>
                      )}

                      {item.status === "done" && <Check className="size-4 text-success" />}
                    </article>
                  ))}
                </div>
              </>
            )}

            <div className="rounded-md border border-border bg-card p-4 text-xs leading-5 text-muted-foreground">
              <strong className="text-foreground">Processamento local:</strong> os arquivos não são
              enviados para um servidor. O resultado é um novo arquivo, recriado no navegador, sem
              os metadados incorporados no arquivo original.
            </div>

            <p className="text-xs text-muted-foreground">
              A ferramenta cobre formatos de foto e vídeo suportados pelo navegador. Arquivos que
              não puderem ser decodificados localmente são recusados em vez de serem entregues como
              se estivessem limpos. Vídeos são entregues em WEBM.
            </p>
          </section>
        )}
        <BatchCleaner />
      </main>
    </AppShell>
  );
}

function Choice({
  icon: Icon,
  title,
  text,
  onClick,
}: {
  icon: typeof FileImage;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border border-border bg-card p-6 text-left transition-colors hover:border-primary/60",
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-md bg-secondary text-primary">
        <Icon className="size-5" />
      </span>
      <h2 className="mt-4 font-display text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </button>
  );
}
