import { useEffect, useRef, useState } from "react";
import { ArrowRight, Expand, LoaderCircle, RefreshCw } from "lucide-react";
import type { CloudViewer } from "@/lib/hot-cloud";
import { hotButton, hotInput } from "./HotDialog";

type Renderer = { VM_communication: { disconnect: () => void } };
type Player = {
  DeviceRendererFactory: new () => {
    setupRenderer: (
      element: HTMLElement,
      address: string,
      options: Record<string, unknown>,
    ) => Renderer;
  };
};
let sdkPromise: Promise<Player> | null = null;
function loadPlayer(): Promise<Player> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<Player>((resolve, reject) => {
    const current = (window as Window & { genyDeviceWebPlayer?: Player }).genyDeviceWebPlayer;
    if (current) {
      resolve(current);
      return;
    }
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href =
      "https://cdn.jsdelivr.net/npm/@genymotion/device-web-player@4.3.1/dist/css/device-renderer.min.css";
    document.head.appendChild(style);
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/@genymotion/device-web-player@4.3.1/dist/js/device-renderer.min.js";
    script.async = true;
    script.referrerPolicy = "no-referrer";
    const timer = setTimeout(() => failed(), 20000);
    function failed() {
      clearTimeout(timer);
      script.remove();
      style.remove();
      reject(
        new Error(
          "Não consegui carregar o visualizador Android. Confira a conexão e tente novamente.",
        ),
      );
    }
    script.onerror = failed;
    script.onload = () => {
      clearTimeout(timer);
      const player = (window as Window & { genyDeviceWebPlayer?: Player }).genyDeviceWebPlayer;
      if (player) resolve(player);
      else failed();
    };
    document.head.appendChild(script);
  }).catch((reason) => {
    sdkPromise = null;
    throw reason;
  });
  return sdkPromise;
}
function AndroidPlayer({ viewer }: { viewer: Extract<CloudViewer, { kind: "android" }> }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    let renderer: Renderer | undefined;
    setError("");
    setLoading(true);
    void loadPlayer()
      .then((sdk) => {
        if (cancelled || !container.current) return;
        renderer = new sdk.DeviceRendererFactory().setupRenderer(
          container.current,
          viewer.address,
          {
            token: viewer.token,
            fileUpload: false,
            gappsInstall: false,
            camera: false,
            microphone: false,
            identifiers: false,
            power: false,
            fullscreen: true,
            navbar: true,
            keyboard: true,
            mouse: true,
            touch: true,
            clipboard: true,
            rotation: true,
          },
        );
        setLoading(false);
      })
      .catch((reason) => {
        if (!cancelled) {
          setLoading(false);
          setError((reason as Error).message);
        }
      });
    const element = container.current;
    return () => {
      cancelled = true;
      renderer?.VM_communication.disconnect();
      element?.replaceChildren();
    };
  }, [viewer.address, viewer.token]);
  return (
    <div className="relative h-[70dvh] min-h-[480px] bg-[#1a1a1a]">
      {loading && (
        <p className="absolute inset-x-0 top-5 flex justify-center gap-2 text-sm text-white">
          <LoaderCircle className="size-4 animate-spin" />
          Carregando visualizador…
        </p>
      )}
      {error && (
        <p role="alert" className="p-5 text-sm text-red-300">
          {error}
        </p>
      )}
      <div ref={container} className="h-full w-full" />
    </div>
  );
}
export function CloudSessionView({
  viewer,
  name,
  onRefresh,
  onNavigate,
}: {
  viewer: CloudViewer;
  name: string;
  onRefresh: () => Promise<void>;
  onNavigate: (url: string) => Promise<void>;
}) {
  const frame = useRef<HTMLElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section ref={frame} className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
        <span className="text-sm font-semibold">
          {name}
          <span className="ml-2 text-xs font-normal text-muted-foreground">Sessão na nuvem</span>
        </span>
        <div className="flex gap-2">
          <button className={hotButton} disabled={busy} onClick={() => void action(onRefresh)}>
            <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
            Reconectar tela
          </button>
          <button
            className={hotButton}
            onClick={() =>
              void action(async () => {
                if (document.fullscreenElement) await document.exitFullscreen();
                else if (frame.current?.requestFullscreen) await frame.current.requestFullscreen();
                else throw new Error("Este navegador não oferece tela cheia.");
              })
            }
          >
            <Expand className="size-4" />
            Tela cheia
          </button>
        </div>
      </header>
      {viewer.kind === "browser" && (
        <form
          className="flex gap-2 border-b border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              await onNavigate(url);
              setUrl("");
            });
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Endereço da nova aba</span>
            <input
              required
              type="url"
              maxLength={2000}
              placeholder="https://… · abrir uma nova aba"
              className={hotInput}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <button className={hotButton} disabled={busy}>
            <ArrowRight className="size-4" />
            <span className="hidden sm:inline">Abrir aba</span>
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {viewer.kind === "browser" ? (
        <iframe
          title={`Navegador remoto · ${name}`}
          src={viewer.url}
          sandbox="allow-same-origin allow-scripts"
          allow="clipboard-read; clipboard-write; fullscreen"
          referrerPolicy="no-referrer"
          className="h-[70dvh] min-h-[480px] w-full bg-background"
        />
      ) : (
        <AndroidPlayer viewer={viewer} />
      )}
    </section>
  );
}
