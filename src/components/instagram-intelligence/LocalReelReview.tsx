import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

import {
  requestLocalSuggestion,
  type LocalSuggestion,
  type VideoFrame,
} from "@/lib/instagram-intelligence-local";

const frameSize = 360;

export function sampleFrameTimes(duration: number) {
  const last = Math.max(0, duration - 0.05);
  return [
    ...new Set(
      [0, 0.5, 1, 2, 3, ...Array.from({ length: 10 }, (_, i) => (duration * (i + 1)) / 11)]
        .filter((value) => value <= last)
        .map((value) => Math.round(value * 1000) / 1000),
    ),
  ].sort((a, b) => a - b);
}

function waitForVideo(video: HTMLVideoElement, event: string, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    function finish(error?: Error) {
      window.clearTimeout(timer);
      video.removeEventListener(event, done);
      video.removeEventListener("error", failed);
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
    }
    const done = () => finish();
    const failed = () => finish(new Error("O navegador não conseguiu decodificar o vídeo."));
    const abort = () => finish(new Error("A leitura do vídeo foi cancelada."));
    const timer = window.setTimeout(
      () => finish(new Error("Tempo excedido ao ler o vídeo.")),
      8000,
    );
    video.addEventListener(event, done, { once: true });
    video.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

export function LocalReelReview({
  url,
  onSample,
  onSaveSuggestion,
}: {
  url: string;
  onSample: () => void;
  onSaveSuggestion: (suggestion: LocalSuggestion) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const controller = useRef<AbortController>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [frames, setFrames] = useState<VideoFrame[]>([]);
  const [running, setRunning] = useState(false);
  const [suggestion, setSuggestion] = useState<LocalSuggestion>();
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  const cleanup = useRef<() => void>(() => {});
  useEffect(
    () => () => {
      const active = controller.current;
      controller.current = null;
      active?.abort();
      cleanup.current();
    },
    [],
  );

  async function analyze() {
    if (controller.current || !frames.length) return;
    const pending = new AbortController();
    controller.current = pending;
    const timer = window.setTimeout(
      () => pending.abort(new Error("Tempo excedido na análise local.")),
      90000,
    );
    setAnalyzing(true);
    setError("");
    setSuggestion(undefined);
    try {
      setSuggestion(await requestLocalSuggestion(frames, pending.signal));
    } catch (reason) {
      if (pending.signal.aborted && controller.current !== pending) return;
      setError(reason instanceof Error ? reason.message : "Falha na análise local.");
    } finally {
      window.clearTimeout(timer);
      if (controller.current === pending) {
        controller.current = null;
        setAnalyzing(false);
      }
    }
  }

  async function sample() {
    const media = video.current;
    if (!media || !videoUrl || controller.current) return;
    const pending = new AbortController();
    controller.current = pending;
    setError("");
    setRunning(true);
    try {
      media.pause();
      if (media.readyState < 2) await waitForVideo(media, "loadeddata", pending.signal);
      if (!Number.isFinite(media.duration) || media.duration <= 0 || !media.videoWidth)
        throw new Error("Duração ou imagem indisponível.");
      const canvas = document.createElement("canvas");
      const ratio = frameSize / Math.max(media.videoWidth, media.videoHeight);
      canvas.width = Math.max(1, Math.round(media.videoWidth * ratio));
      canvas.height = Math.max(1, Math.round(media.videoHeight * ratio));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("O navegador não oferece captura de imagens.");
      const captured = [];
      for (const time of sampleFrameTimes(media.duration)) {
        if (Math.abs(media.currentTime - time) > 0.001) {
          const seek = waitForVideo(media, "seeked", pending.signal);
          media.currentTime = time;
          await seek;
        }
        context.drawImage(media, 0, 0, canvas.width, canvas.height);
        captured.push({ time, src: canvas.toDataURL("image/jpeg", 0.75) });
      }
      setFrames(captured);
      onSample();
    } catch (reason) {
      if (!pending.signal.aborted)
        setError(reason instanceof Error ? reason.message : "Falha ao extrair frames.");
    } finally {
      if (controller.current === pending) controller.current = null;
      if (!pending.signal.aborted) setRunning(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm text-muted-foreground">
        Abra o arquivo autorizado correspondente a este Reel. O vídeo e os frames ficam neste
        computador. Se usar a IA local, somente as observações anexadas à ficha são salvas no
        MauseHot.
      </p>
      <input
        type="file"
        accept="video/*"
        aria-label={"Vídeo local para " + url}
        disabled={running || analyzing}
        onChange={(event) => {
          const file = event.target.files?.[0];
          cleanup.current();
          const objectUrl = file ? URL.createObjectURL(file) : "";
          cleanup.current = () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
          };
          setFrames([]);
          setSuggestion(undefined);
          setError("");
          setVideoUrl(objectUrl);
        }}
      />
      {videoUrl && (
        <div className="space-y-2">
          <video
            ref={video}
            src={videoUrl}
            controls
            preload="auto"
            className="max-h-64 max-w-full rounded-md"
            aria-label="Prévia do vídeo local"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={running || analyzing}
            onClick={() => void sample()}
          >
            {running ? "Extraindo…" : "Extrair frames"}
          </Button>
        </div>
      )}
      {!!frames.length && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={running || analyzing}
          onClick={() => void analyze()}
        >
          {analyzing ? "Analisando no computador…" : "Sugerir observações com IA local"}
        </Button>
      )}
      {suggestion && (
        <div className="space-y-2 rounded-md border border-border p-3 text-sm">
          <p className="font-medium">Sugestões de {suggestion.model} para conferir</p>
          <ul className="space-y-1">
            {suggestion.observations.observations.map((item, index) => (
              <li key={index}>
                {item.seconds} s · {item.visible}
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onSaveSuggestion(suggestion);
              setSuggestion(undefined);
            }}
          >
            Anexar sugestões à ficha
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {!!frames.length && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {frames.map((frame) => (
            <li key={frame.time}>
              <img
                src={frame.src}
                alt={"Frame em " + frame.time + " segundos"}
                className="max-h-40 w-full rounded object-contain"
              />
              <span className="text-xs">{frame.time.toFixed(2)} s</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
