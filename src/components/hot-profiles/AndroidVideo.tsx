import { useEffect, useRef, useState } from "react";
import { AnnexBFrames } from "@/lib/h264";
import type { HotConnection } from "@/lib/hot-profiles";

export function AndroidVideo({
  connection,
  profileId,
  name,
  running,
  onLive,
}: {
  connection: HotConnection;
  profileId: string;
  name: string;
  running: boolean;
  onLive: (live: boolean) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false),
    [fps, setFps] = useState(0),
    [notice, setNotice] = useState("Conectando vídeo…"),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!running || !canvas.current) return;
    let disposed = false,
      active: AbortController | undefined,
      decoder: VideoDecoder | undefined;
    const stop = () => {
      active?.abort();
      if (decoder?.state !== "closed") decoder?.close();
      setLive(false);
      onLive(false);
    };
    const start = async () => {
      if (disposed || document.visibilityState !== "visible") return;
      if (typeof VideoDecoder === "undefined") {
        setNotice("Vídeo não suportado neste navegador; usando capturas.");
        return;
      }
      const abort = new AbortController();
      active = abort;
      let streamDecoder: VideoDecoder | undefined;
      let count = 0,
        windowFrames = 0,
        since = performance.now(),
        codec = "",
        timestamp = 0;
      const timeout = setTimeout(() => {
        if (!count) abort.abort();
      }, 20000);
      try {
        while (!abort.signal.aborted && !disposed) {
          const response = await fetch(`${connection.url}/v1/sessions/${profileId}/video`, {
            headers: { Authorization: `Bearer ${connection.token}` },
            signal: abort.signal,
          });
          if (
            !response.ok ||
            !response.body ||
            !response.headers.get("Content-Type")?.includes("video/h264")
          )
            throw new Error("Vídeo indisponível");
          codec = "";
          if (streamDecoder?.state !== "closed") streamDecoder?.close();
          streamDecoder = new VideoDecoder({
            output(frame) {
              try {
                const target = canvas.current;
                if (!target || disposed || abort.signal.aborted) return;
                if (target.width !== frame.displayWidth || target.height !== frame.displayHeight) {
                  target.width = frame.displayWidth;
                  target.height = frame.displayHeight;
                }
                target.getContext("2d", { alpha: false })?.drawImage(frame, 0, 0);
                count++;
                windowFrames++;
                target.dataset.frames = String(count);
                target.dataset.live = "true";
                if (count === 1) {
                  setLive(true);
                  onLive(true);
                  setNotice("");
                  clearTimeout(timeout);
                }
                if (performance.now() - since >= 1000) {
                  setFps(Math.round((windowFrames * 1000) / (performance.now() - since)));
                  since = performance.now();
                  windowFrames = 0;
                }
              } finally {
                frame.close();
              }
            },
            error() {
              abort.abort();
            },
          });
          decoder = streamDecoder;
          const parser = new AnnexBFrames((unit) => {
            if (!streamDecoder || streamDecoder.state === "closed")
              throw new Error("Decoder encerrado");
            if (unit.key && codec !== unit.codec) {
              streamDecoder.configure({ codec: unit.codec, optimizeForLatency: true });
              codec = unit.codec;
            }
            if (streamDecoder.state !== "configured") return;
            if (streamDecoder.decodeQueueSize > 12)
              throw new Error("Decodificação não acompanhou o vídeo");
            streamDecoder.decode(
              new EncodedVideoChunk({
                type: unit.key ? "key" : "delta",
                timestamp: (timestamp += 16667),
                data: unit.data,
              }),
            );
          });
          const reader = response.body.getReader();
          try {
            while (!abort.signal.aborted) {
              const next = await reader.read();
              if (next.done) break;
              parser.push(next.value);
            }
            parser.finish();
          } finally {
            await reader.cancel().catch(() => {});
            reader.releaseLock();
          }
          if (!count) throw new Error("O motor não produziu vídeo");
          // screenrecord has a bounded lifetime. Reconnect with fresh SPS/PPS.
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch {
        if (!disposed && document.visibilityState === "visible")
          setNotice(
            "Vídeo indisponível ou sobrecarregado; usando capturas. Reduza resolução/FPS e tente novamente.",
          );
      } finally {
        clearTimeout(timeout);
        abort.abort();
        if (streamDecoder?.state !== "closed") streamDecoder?.close();
        if (active === abort && canvas.current) canvas.current.dataset.live = "false";
        if (!disposed && active === abort) {
          setLive(false);
          onLive(false);
        }
      }
    };
    const visibility = () => {
      if (document.visibilityState === "visible") void start();
      else stop();
    };
    document.addEventListener("visibilitychange", visibility);
    void start();
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", visibility);
      stop();
    };
  }, [connection, profileId, running, retry, onLive]);
  return (
    <>
      <canvas
        ref={canvas}
        aria-label={`Tela em vídeo de ${name}`}
        data-live="false"
        className={live ? "max-h-[68dvh] w-auto max-w-full object-contain" : "hidden"}
      />
      <div
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        className="pointer-events-auto absolute bottom-2 left-2 right-2 rounded-lg bg-black/75 p-2 text-xs text-white"
      >
        {live ? `Vídeo H.264 · ${fps} quadros/s recebidos` : notice}
        {!live && (
          <button
            type="button"
            className="ml-2 underline"
            onClick={(event) => {
              event.stopPropagation();
              setRetry((n) => n + 1);
            }}
          >
            Tentar vídeo
          </button>
        )}
      </div>
    </>
  );
}
