import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  Image as ImageIcon,
  Loader2,
  PlaySquare,
  ShieldCheck,
  Type,
  UploadCloud,
} from "lucide-react";
import { AppShell, PageIntro } from "@/components/AppShell";

export const Route = createFileRoute("/otimizar-criativos")({
  head: () => ({
    meta: [
      { title: "Otimizar Criativos — 00duHot" },
      {
        name: "description",
        content:
          "Reexporte criativos localmente, aplique overlay visual de marca e gere versões otimizadas para campanhas.",
      },
    ],
  }),
  component: OtimizarCriativos,
});

type MediaType = "image" | "video";
type Position = "top" | "center" | "bottom";
type Status = "waiting" | "processing" | "done" | "error";

interface Item {
  id: string;
  file: File;
  status: Status;
  output: Blob | null;
  error: string | null;
}

function OtimizarCriativos() {
  const [type, setType] = useState<MediaType | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [overlayFile, setOverlayFile] = useState<File | null>(null);
  const [overlayText, setOverlayText] = useState("");
  const [position, setPosition] = useState<Position>("bottom");
  const [opacity, setOpacity] = useState(0.85);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayUrl = useObjectUrl(overlayFile);

  const reset = () => {
    setType(null);
    setItems([]);
    setOverlayFile(null);
    setOverlayText("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const add = (files: FileList | null) => {
    if (!files || !type) return;

    const accepted = type === "image"
      ? ["image/jpeg", "image/png", "image/webp", "image/avif"]
      : ["video/mp4", "video/webm", "video/quicktime"];

    const nextItems = Array.from(files)
      .filter((file) => accepted.includes(file.type))
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: "waiting" as const,
        output: null,
        error: null,
      }));

    setItems((current) => [...current, ...nextItems]);
  };

  const patch = (id: string, value: Partial<Item>) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...value } : item)),
    );

  const cleanImage = async (item: Item) => {
    const sourceUrl = URL.createObjectURL(item.file);

    try {
      const image = new Image();
      image.src = sourceUrl;
      await image.decode();

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Não foi possível preparar o criativo.");

      context.drawImage(image, 0, 0);
      await drawOverlay(context, canvas.width, canvas.height, overlayUrl, overlayText, position, opacity);

      const output = await canvasToBlob(canvas, "image/webp", 0.92);
      patch(item.id, { status: "done", output });
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  };

  const cleanVideo = async (item: Item) => {
    const sourceUrl = URL.createObjectURL(item.file);
    const video = document.createElement("video");

    video.src = sourceUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () =>
          reject(new Error("Este vídeo não pôde ser processado neste navegador."));
      });

      if (
        !video.captureStream ||
        !HTMLCanvasElement.prototype.captureStream ||
        !MediaRecorder.isTypeSupported("video/webm")
      ) {
        throw new Error("Seu navegador não oferece suporte ao processamento local de vídeos.");
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Não foi possível preparar o criativo.");

      const stream = canvas.captureStream(30);
      const sourceStream = video.captureStream();
      sourceStream.getAudioTracks().forEach((track) => stream.addTrack(track));

      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };

      const stopped = new Promise<void>((resolve, reject) => {
        recorder.onstop = () => resolve();
        recorder.onerror = () => reject(new Error("Erro ao gerar o criativo."));
      });

      recorder.start(250);
      await video.play();

      const drawFrame = () => {
        if (!video.ended && !video.paused) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          void drawOverlay(context, canvas.width, canvas.height, overlayUrl, overlayText, position, opacity);
          requestAnimationFrame(drawFrame);
        }
      };

      drawFrame();
      await new Promise<void>((resolve) => {
        video.onended = () => resolve();
      });

      recorder.stop();
      await stopped;

      stream.getTracks().forEach((track) => track.stop());
      sourceStream.getTracks().forEach((track) => track.stop());

      if (!chunks.length) throw new Error("Não foi possível gerar o criativo.");

      patch(item.id, {
        status: "done",
        output: new Blob(chunks, { type: "video/webm" }),
      });
    } finally {
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(sourceUrl);
    }
  };

  const optimizeAll = async () => {
    if (!items.length || !type) return;

    setBusy(true);

    for (const item of items) {
      patch(item.id, { status: "processing", error: null });

      try {
        if (type === "image") await cleanImage(item);
        else await cleanVideo(item);
      } catch (error) {
        patch(item.id, {
          status: "error",
          error: error instanceof Error ? error.message : "Não foi possível processar este arquivo.",
        });
      }
    }

    setBusy(false);
  };

  const download = (item: Item) => {
    if (!item.output || !type) return;
    const url = URL.createObjectURL(item.output);
    const extension = type === "image" ? "webp" : "webm";
    const baseName = item.file.name.replace(/\.[^.]+$/, "");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `otimizado-${baseName}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="Criativos"
          title="Otimizar Criativos"
          description="Reexporte seus criativos localmente, aplique um overlay visual de marca e gere arquivos prontos para diferentes operações de mídia."
        />

        {!type ? (
          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            <Choice
              icon={ImageIcon}
              title="Criativo de imagem"
              text="Reexporte imagens em WEBP, removendo dados incorporados do arquivo processado e aplicando seu overlay."
              onClick={() => setType("image")}
            />
            <Choice
              icon={PlaySquare}
              title="Criativo de vídeo"
              text="Regrave vídeos em WEBM, preserve o áudio quando disponível e aplique o overlay em todos os frames."
              onClick={() => setType("video")}
            />
          </section>
        ) : (
          <section className="mt-8 space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                Otimização de {type === "image" ? "imagens" : "vídeos"}
              </p>
              <button
                onClick={reset}
                className="rounded-md border border-border px-3 py-2 text-xs"
              >
                Trocar tipo
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
              <p className="text-sm font-semibold">Arraste os criativos aqui ou clique para selecionar</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {type === "image" ? "JPG, PNG, WEBP ou AVIF" : "MP4, WEBM ou MOV"} · vários arquivos
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={type === "image" ? "image/jpeg,image/png,image/webp,image/avif" : "video/mp4,video/webm,video/quicktime"}
                className="hidden"
                onChange={(event) => add(event.target.files)}
              />
            </label>

            <div className="grid gap-4 rounded-lg border border-border bg-card p-5 md:grid-cols-2">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ImageIcon className="size-4 text-primary" />
                  Overlay visual
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Adicione uma imagem transparente de marca, selo ou identidade visual sobre o criativo.
                </p>
                <label className="mt-4 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-border px-4 py-4 text-xs hover:border-primary/60">
                  {overlayFile ? overlayFile.name : "Selecionar imagem PNG/WebP"}
                  <input
                    type="file"
                    accept="image/png,image/webp"
                    className="hidden"
                    onChange={(event) => setOverlayFile(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Type className="size-4 text-primary" />
                  Texto de marca
                </div>
                <input
                  value={overlayText}
                  onChange={(event) => setOverlayText(event.target.value)}
                  placeholder="@sua_marca"
                  className="mt-3 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(["top", "center", "bottom"] as Position[]).map((value) => (
                    <button
                      key={value}
                      onClick={() => setPosition(value)}
                      className={`rounded-md border px-3 py-2 text-xs capitalize ${position === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      {value === "top" ? "Topo" : value === "center" ? "Centro" : "Base"}
                    </button>
                  ))}
                </div>
                <label className="mt-3 block text-xs text-muted-foreground">
                  Opacidade do overlay: {Math.round(opacity * 100)}%
                  <input
                    type="range"
                    min="0.2"
                    max="1"
                    step="0.05"
                    value={opacity}
                    onChange={(event) => setOpacity(Number(event.target.value))}
                    className="mt-2 w-full"
                  />
                </label>
              </div>
            </div>

            {items.length > 0 && (
              <>
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <span className="text-xs text-muted-foreground">
                    {items.filter((item) => item.status === "done").length}/{items.length} processados
                  </span>
                  <button
                    disabled={busy}
                    onClick={optimizeAll}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="size-3 animate-spin" /> : <ShieldCheck className="size-3" />}
                    {busy ? "Processando..." : "Otimizar criativos"}
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item) => (
                    <article key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
                      <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-primary">
                        {type === "image" ? <ImageIcon className="size-5" /> : <PlaySquare className="size-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{item.file.name}</p>
                        <p className="text-xs text-muted-foreground">{(item.file.size / 1048576).toFixed(2)} MB</p>
                        {item.error && <p className="mt-1 text-xs text-destructive">{item.error}</p>}
                      </div>
                      {item.status === "processing" && <Loader2 className="size-4 animate-spin text-primary" />}
                      {item.status === "done" && (
                        <>
                          <button
                            onClick={() => download(item)}
                            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                          >
                            <Download className="size-3" /> Baixar
                          </button>
                          <Check className="size-4 text-success" />
                        </>
                      )}
                    </article>
                  ))}
                </div>
              </>
            )}

            <div className="rounded-md border border-border bg-card p-4 text-xs leading-5 text-muted-foreground">
              <strong className="text-foreground">Processamento local:</strong> os arquivos permanecem no navegador.
              A ferramenta faz uma nova renderização/reexportação e não é um mecanismo para burlar revisão, políticas,
              antifraude ou sistemas de detecção de plataformas de anúncios.
            </div>
          </section>
        )}
      </main>
    </AppShell>
  );
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  return url;
}

async function drawOverlay(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  overlayUrl: string | null,
  text: string,
  position: Position,
  opacity: number,
) {
  context.save();
  context.globalAlpha = opacity;

  if (overlayUrl) {
    const overlay = new Image();
    overlay.src = overlayUrl;
    await overlay.decode();

    const maxWidth = width * 0.34;
    const maxHeight = height * 0.22;
    const scale = Math.min(maxWidth / overlay.naturalWidth, maxHeight / overlay.naturalHeight, 1);
    const overlayWidth = overlay.naturalWidth * scale;
    const overlayHeight = overlay.naturalHeight * scale;
    const x = width - overlayWidth - width * 0.05;
    const y =
      position === "top"
        ? height * 0.05
        : position === "center"
          ? (height - overlayHeight) / 2
          : height - overlayHeight - height * 0.05;

    context.drawImage(overlay, x, y, overlayWidth, overlayHeight);
  }

  if (text.trim()) {
    const fontSize = Math.max(18, Math.round(Math.min(width, height) * 0.045));
    const y =
      position === "top"
        ? fontSize + height * 0.05
        : position === "center"
          ? height / 2
          : height - height * 0.06;

    context.font = `700 ${fontSize}px Arial, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineWidth = Math.max(2, fontSize * 0.12);
    context.strokeStyle = "rgba(0, 0, 0, 0.72)";
    context.fillStyle = "#ffffff";
    context.strokeText(text.trim(), width / 2, y);
    context.fillText(text.trim(), width / 2, y);
  }

  context.restore();
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível gerar o arquivo otimizado."))),
      type,
      quality,
    );
  });
}

function Choice({
  icon: Icon,
  title,
  text,
  onClick,
}: {
  icon: typeof ImageIcon;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-border bg-card p-6 text-left transition-colors hover:border-primary/60"
    >
      <span className="flex size-11 items-center justify-center rounded-md bg-secondary text-primary">
        <Icon className="size-5" />
      </span>
      <h2 className="mt-4 font-display text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </button>
  );
}
