import { throwIfAborted } from "./files.ts";
/** Local rendering only. No network requests and no changes to the batch FFmpeg worker. */
export async function renderLocalVideo(
  file: File,
  draw: (
    context: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    width: number,
    height: number,
  ) => void,
  signal: AbortSignal,
): Promise<Blob> {
  throwIfAborted(signal);
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported("video/webm"))
    throw new Error(
      "Este navegador não permite exportar vídeos WEBM. Use uma versão compatível do Chrome ou Edge.",
    );
  const source = URL.createObjectURL(file),
    video = document.createElement("video"),
    canvas = document.createElement("canvas");
  let stream: MediaStream | undefined,
    sourceStream: MediaStream | undefined,
    recorder: MediaRecorder | undefined,
    frame = 0;
  video.src = source;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        video.onloadeddata = null;
        video.onerror = null;
      };
      const abort = () => {
        cleanup();
        reject(new DOMException("Processamento cancelado.", "AbortError"));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("O vídeo demorou para abrir. Verifique o arquivo e tente novamente."));
      }, 30000);
      video.onloadeddata = () => {
        cleanup();
        resolve();
      };
      video.onerror = () => {
        cleanup();
        reject(new Error("O navegador não conseguiu abrir este vídeo."));
      };
      signal.addEventListener("abort", abort, { once: true });
    });
    throwIfAborted(signal);
    if (!video.captureStream || !canvas.captureStream)
      throw new Error("Seu navegador não oferece suporte à renderização local deste vídeo.");
    if (!video.videoWidth || !video.videoHeight || !Number.isFinite(video.duration))
      throw new Error("Este arquivo não tem dimensões ou duração válidas.");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar o vídeo.");
    draw(context, video, canvas.width, canvas.height);
    stream = canvas.captureStream(30);
    sourceStream = video.captureStream();
    sourceStream.getAudioTracks().forEach((track) => stream!.addTrack(track));
    recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    const recording = await new Promise<Blob>((resolve, reject) => {
      const cleanup = () => {
        signal.removeEventListener("abort", abort);
        video.onended = null;
        video.onerror = null;
      };
      const abort = () => {
        cleanup();
        reject(new DOMException("Processamento cancelado.", "AbortError"));
      };
      signal.addEventListener("abort", abort, { once: true });
      recorder!.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder!.onerror = () => {
        cleanup();
        reject(new Error("Não foi possível exportar o vídeo."));
      };
      recorder!.onstop = () => {
        cleanup();
        if (signal.aborted)
          return reject(new DOMException("Processamento cancelado.", "AbortError"));
        if (!chunks.length) return reject(new Error("A exportação não gerou um vídeo válido."));
        resolve(new Blob(chunks, { type: "video/webm" }));
      };
      video.onerror = () => {
        cleanup();
        reject(new Error("A leitura do vídeo foi interrompida."));
      };
      video.onended = () => {
        if (recorder!.state !== "inactive") recorder!.stop();
      };
      const paint = () => {
        if (signal.aborted) return;
        try {
          draw(context, video, canvas.width, canvas.height);
        } catch (error) {
          cleanup();
          reject(error);
          return;
        }
        if (!video.ended) frame = requestAnimationFrame(paint);
      };
      recorder!.start(250);
      video
        .play()
        .then(paint)
        .catch((error) => {
          cleanup();
          reject(error);
        });
    });
    return recording;
  } finally {
    cancelAnimationFrame(frame);
    video.onended = null;
    video.onerror = null;
    video.pause();
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    stream?.getTracks().forEach((track) => track.stop());
    sourceStream?.getTracks().forEach((track) => track.stop());
    video.removeAttribute("src");
    video.load();
    canvas.width = 0;
    canvas.height = 0;
    URL.revokeObjectURL(source);
  }
}
