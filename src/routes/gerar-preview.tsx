import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Check,
  Download,
  Image as ImageIcon,
  Loader2,
  PlaySquare,
  Scan,
  UploadCloud,
} from "lucide-react";
import { AppShell, PageIntro } from "@/components/AppShell";

export const Route = createFileRoute("/gerar-preview")({
  head: () => ({
    meta: [
      { title: "Gerar Preview — 00duHot" },
      {
        name: "description",
        content:
          "Gere previews completos de fotos e vídeos com blur ou pixelização em diferentes intensidades.",
      },
    ],
  }),
  component: GerarPreview,
});

type MediaType = "image" | "video";
type Effect = "blur" | "pixel";
type Intensity = "light" | "medium" | "heavy";
type Status = "waiting" | "processing" | "done" | "error";

interface Item {
  id: string;
  file: File;
  status: Status;
  output: Blob | null;
  progress: number;
  error: string | null;
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

function GerarPreview() {
  const [type, setType] = useState<MediaType | null>(null);
  const [effect, setEffect] = useState<Effect>("blur");
  const [intensity, setIntensity] = useState<Intensity>("medium");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setType(null);
    setItems([]);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const add = (files: FileList | null) => {
    if (!files || !type) return;
    const accepted = type === "image" ? IMAGE_TYPES : VIDEO_TYPES;
    const nextItems = Array.from(files)
      .filter((file) => accepted.includes(file.type))
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: "waiting" as const,
        output: null,
        progress: 0,
        error: null,
      }));
    setItems((current) => [...current, ...nextItems]);
  };

  const patch = (id: string, value: Partial<Item>) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...value } : item)),
    );

  const processImage = async (item: Item) => {
    const sourceUrl = URL.createObjectURL(item.file);
    try {
      const image = new Image();
      image.src = sourceUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Não foi possível preparar a imagem.");
      renderEffect(context, image, canvas.width, canvas.height, effect, intensity);
      const output = await canvasToBlob(canvas, "image/webp", 0.92);
      patch(item.id, { status: "done", output, progress: 100 });
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  };

  const processVideo = async (item: Item) => {
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
          reject(new Error("Este vídeo não pôde ser processado neste navegador. Tente MP4, WEBM ou MOV."));
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
      if (!context) throw new Error("Não foi possível preparar o vídeo.");

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
        recorder.onerror = () => reject(new Error("Erro ao gerar o preview."));
      });

      recorder.start(250);
      await video.play();

      const renderFrame = () => {
        if (video.ended || video.paused) return;
        renderEffect(context, video, canvas.width, canvas.height, effect, intensity);
        const progress = video.duration
          ? Math.min(99, Math.round((video.currentTime / video.duration) * 100))
          : 0;
        patch(item.id, { progress });
        requestAnimationFrame(renderFrame);
      };

      renderFrame();
      await new Promise<void>((resolve) => {
        video.onended = () => resolve();
      });

      renderEffect(context, video, canvas.width, canvas.height, effect, intensity);
      recorder.stop();
      await stopped;

      stream.getTracks().forEach((track) => track.stop());
      sourceStream.getTracks().forEach((track) => track.stop());

      if (!chunks.length) throw new Error("Não foi possível gerar o preview.");

      patch(item.id, {
        status: "done",
        output: new Blob(chunks, { type: "video/webm" }),
        progress: 100,
      });
    } finally {
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(sourceUrl);
    }
  };

  const processAll = async () => {
    if (!items.length || !type) return;
    setBusy(true);

    for (const item of items) {
      patch(item.id, { status: "processing", progress: 0, error: null });
      try {
        if (type === "image") await processImage(item);
        else await processVideo(item);
      } catch (error) {
        patch(item.id, {
          status: "error",
          error: error instanceof Error ? error.message : "Não foi possível gerar este preview.",
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
    anchor.download = "preview-" + baseName + "." + extension;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="Preview"
          title="Gerar Preview"
          description="Crie versões completas de fotos e vídeos com blur ou pixelização, controlando o nível de intensidade antes de exportar."
        />

        {!type ? (
          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            <Choice
              icon={ImageIcon}
              title="Preview de foto"
              text="Escolha a imagem, defina o efeito e gere uma nova versão pronta para usar como preview."
              onClick={() => setType("image")}
            />
            <Choice
              icon={PlaySquare}
              title="Preview de vídeo"
              text="Processe o vídeo inteiro, do primeiro ao último frame, mantendo o áudio quando disponível."
              onClick={() => setType("video")}
            />
          </section>
        ) : (
          <section className="mt-8 space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                Preview de {type === "image" ? "fotos" : "vídeos"}
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
              <p className="text-sm font-semibold">Arraste os arquivos aqui ou clique para selecionar</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {type === "image" ? "JPG, PNG, WEBP ou AVIF" : "MP4, WEBM ou MOV"} · vários arquivos
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={(type === "image" ? IMAGE_TYPES : VIDEO_TYPES).join(",")}
                className="hidden"
                onChange={(event) => add(event.target.files)}
              />
            </label>

            <div className="grid gap-4 rounded-lg border border-border bg-card p-5 md:grid-cols-2">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Scan className="size-4 text-primary" />
                  Tipo de efeito
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => setEffect("blur")} className={optionClass(effect === "blur")}>Blur</button>
                  <button onClick={() => setEffect("pixel")} className={optionClass(effect === "pixel")}>Pixelado</button>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  O efeito cobre todo o quadro. Em vídeos, ele é aplicado durante toda a duração.
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold">Intensidade</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(["light", "medium", "heavy"] as Intensity[]).map((value) => (
                    <button
                      key={value}
                      onClick={() => setIntensity(value)}
                      className={optionClass(intensity === value)}
                    >
                      {value === "light" ? "Leve" : value === "medium" ? "Médio" : "Pesado"}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  Ajuste a força do blur ou o tamanho dos blocos do efeito pixelado.
                </p>
              </div>
            </div>

            {items.length > 0 && (
              <>
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <span className="text-xs text-muted-foreground">
                    {items.filter((item) => item.status === "done").length}/{items.length} previews gerados
                  </span>
                  <button
                    disabled={busy}
                    onClick={processAll}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="size-3 animate-spin" /> : <Scan className="size-3" />}
                    {busy ? "Gerando..." : "Gerar previews"}
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item) => (
                    <article key={item.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-primary">
                          {type === "image" ? <ImageIcon className="size-5" /> : <PlaySquare className="size-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{item.file.name}</p>
                          <p className="text-xs text-muted-foreground">{(item.file.size / 1048576).toFixed(2)} MB</p>
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
                      </div>

                      {item.status === "processing" && (
                        <div className="mt-4">
                          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                            <span>Processando vídeo inteiro</span>
                            <span>{item.progress}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: item.progress + "%" }} />
                          </div>
                        </div>
                      )}

                      {item.error && <p className="mt-3 text-xs text-destructive">{item.error}</p>}
                    </article>
                  ))}
                </div>
              </>
            )}

            <div className="rounded-md border border-border bg-card p-4 text-xs leading-5 text-muted-foreground">
              <strong className="text-foreground">Processamento local:</strong>{" "}
              os arquivos permanecem no navegador. O preview é gerado por re-renderização do conteúdo e, no caso de vídeos, o efeito é aplicado continuamente durante toda a duração.
            </div>
          </section>
        )}
      </main>
    </AppShell>
  );
}

function renderEffect(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
  effect: Effect,
  intensity: Intensity,
) {
  context.clearRect(0, 0, width, height);

  if (effect === "blur") {
    context.filter = "blur(" + blurAmount(intensity) + "px)";
    context.drawImage(source, 0, 0, width, height);
    context.filter = "none";
    return;
  }

  const scale = pixelScale(intensity);
  const smallWidth = Math.max(1, Math.ceil(width / scale));
  const smallHeight = Math.max(1, Math.ceil(height / scale));
  const pixelCanvas = document.createElement("canvas");
  pixelCanvas.width = smallWidth;
  pixelCanvas.height = smallHeight;

  const pixelContext = pixelCanvas.getContext("2d");
  if (!pixelContext) throw new Error("Não foi possível preparar o efeito pixelado.");

  pixelContext.imageSmoothingEnabled = true;
  pixelContext.drawImage(source, 0, 0, smallWidth, smallHeight);
  context.imageSmoothingEnabled = false;
  context.drawImage(pixelCanvas, 0, 0, width, height);
  context.imageSmoothingEnabled = true;
}

function blurAmount(intensity: Intensity) {
  return intensity === "light" ? 8 : intensity === "medium" ? 22 : 48;
}

function pixelScale(intensity: Intensity) {
  return intensity === "light" ? 12 : intensity === "medium" ? 24 : 42;
}

function optionClass(active: boolean) {
  return "rounded-md border px-3 py-2 text-xs transition-colors " +
    (active
      ? "border-primary bg-primary/10 text-primary"
      : "border-border text-muted-foreground hover:border-primary/50");
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Não foi possível gerar o preview.")),
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
