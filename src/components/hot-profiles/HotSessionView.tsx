import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Circle,
  Download,
  Expand,
  Home,
  Keyboard,
  LoaderCircle,
  Monitor,
  Plus,
  RefreshCw,
  Smartphone,
  Settings,
  Square,
  Triangle,
  X,
} from "lucide-react";
import {
  bridgeRequest,
  type HotConnection,
  type HotFrame,
  type HotSession,
  type HotNetwork,
} from "@/lib/hot-profiles";
import { hotButton, hotInput } from "./HotDialog";
import { AndroidVideo } from "./AndroidVideo";

export function HotSessionView({
  session,
  connection,
  onStop,
  onRetry,
}: {
  session: HotSession;
  connection: HotConnection;
  onStop: () => void;
  onRetry: () => void;
}) {
  const [frame, setFrame] = useState<HotFrame | null>(null);
  const [error, setError] = useState("");
  const [network, setNetwork] = useState<HotNetwork | null>(null);
  const [checkingNetwork, setCheckingNetwork] = useState(false);
  const [address, setAddress] = useState("");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [lastFrame, setLastFrame] = useState(0);
  const [videoLive, setVideoLive] = useState(false);
  const onVideoLive = useCallback((live: boolean) => setVideoLive(live), []);
  const [previewRate, setPreviewRate] = useState<"economy" | "balanced" | "responsive">("balanced");
  const screen = useRef<HTMLDivElement>(null);
  const currentFrame = useRef<HotFrame | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const prefix = `/v1/sessions/${session.profileId}`;
  const control = useCallback(
    async (input: unknown) => {
      try {
        await bridgeRequest(connection, `${prefix}/control`, input);
        setError("");
      } catch (reason) {
        setError((reason as Error).message);
      }
    },
    [connection, prefix],
  );

  useEffect(() => {
    if (session.status !== "running" || videoLive) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function capture() {
      if (abort.signal.aborted) return;
      try {
        if (document.visibilityState === "visible") {
          const next = await bridgeRequest<HotFrame>(
            connection,
            `${prefix}/frame`,
            undefined,
            "GET",
            AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
          );
          if (abort.signal.aborted) return;
          currentFrame.current = next;
          setFrame((previous) => (next.image ? next : { ...next, image: previous?.image || null }));
          setLastFrame(Date.now());
          setError("");
        }
      } catch (reason) {
        if (!abort.signal.aborted) setError((reason as Error).message);
      }
      if (!abort.signal.aborted)
        timer = setTimeout(
          () => void capture(),
          previewRate === "economy"
            ? 1800
            : previewRate === "responsive"
              ? session.kind === "android"
                ? 500
                : 300
              : session.kind === "android"
                ? 900
                : 600,
        );
    }
    void capture();
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [connection, prefix, session.status, session.kind, previewRate, videoLive]);
  const activeTab = frame?.tabs.find((tab) => tab.active);
  useEffect(() => {
    if (!editing)
      setAddress(activeTab?.url && activeTab.url !== "about:blank" ? activeTab.url : "");
  }, [activeTab?.url, editing]);
  useEffect(() => {
    const target = screen.current;
    if (!target || session.status !== "running") return;
    let pending = false;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const image = target.querySelector("canvas[data-live='true'],img");
      const current =
        image instanceof HTMLCanvasElement
          ? { width: image.width, height: image.height }
          : currentFrame.current;
      if (pending || !image || !current) return;
      const rect = image.getBoundingClientRect();
      pending = true;
      void control({
        action: "scroll",
        x: ((event.clientX - rect.left) * current.width) / rect.width,
        y: ((event.clientY - rect.top) * current.height) / rect.height,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
      }).finally(() => {
        pending = false;
      });
    };
    target.addEventListener("wheel", wheel, { passive: false });
    return () => target.removeEventListener("wheel", wheel);
  }, [control, session.status]);
  function position(event: ReactPointerEvent<HTMLDivElement>) {
    const image = screen.current?.querySelector("canvas[data-live='true'],img");
    if (!image || (!frame && !(image instanceof HTMLCanvasElement))) return null;
    const dimensions =
      image instanceof HTMLCanvasElement ? { width: image.width, height: image.height } : frame!;
    const rect = image.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      return null;
    return {
      x: ((event.clientX - rect.left) * dimensions.width) / rect.width,
      y: ((event.clientY - rect.top) * dimensions.height) / rect.height,
    };
  }
  function navigate(event: React.FormEvent) {
    event.preventDefault();
    if (!address.trim()) return;
    const value = address.trim();
    const url = /^https?:\/\//i.test(value)
      ? value
      : value.includes(".") && !value.includes(" ")
        ? `https://${value}`
        : `https://www.google.com/search?q=${encodeURIComponent(value)}`;
    setEditing(false);
    void control({ action: "navigate", url });
  }
  async function addTab() {
    try {
      await bridgeRequest(connection, `${prefix}/tabs`, {});
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  const iconButton = `${hotButton} min-w-11 px-2`;
  async function checkNetwork() {
    setCheckingNetwork(true);
    setNetwork(null);
    try {
      setNetwork(await bridgeRequest<HotNetwork>(connection, `${prefix}/network`, {}));
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setCheckingNetwork(false);
    }
  }
  if (session.status !== "running")
    return (
      <div className="flex min-h-96 flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-12 text-center">
        {session.status === "starting" || session.status === "stopping" ? (
          <LoaderCircle className="mb-4 size-10 animate-spin text-primary" />
        ) : session.kind === "android" ? (
          <Smartphone className="mb-4 size-10 text-muted-foreground" />
        ) : (
          <Monitor className="mb-4 size-10 text-muted-foreground" />
        )}
        <h3 className="text-lg font-bold">
          {session.status === "starting"
            ? "Preparando seu ambiente"
            : session.status === "stopping"
              ? "Encerrando a sessão"
              : session.status === "error"
                ? "Não foi possível abrir esta sessão"
                : "Sessão encerrada"}
        </h3>
        <p
          role={session.error ? "alert" : undefined}
          className="mt-3 max-w-lg text-sm leading-7 text-muted-foreground"
        >
          {session.error ||
            (session.status === "starting"
              ? session.kind === "android"
                ? "O Android pode levar alguns instantes para iniciar. Sua tela aparecerá aqui assim que estiver disponível."
                : "Abrindo o navegador com os dados e a conexão deste perfil."
              : "Os dados do ambiente continuam no seu computador.")}
        </p>
        {session.status === "starting" && (
          <button onClick={onStop} className={`${hotButton} mt-5`}>
            Cancelar abertura
          </button>
        )}
        {["error", "stopped"].includes(session.status) && (
          <button onClick={session.needsCleanup ? onStop : onRetry} className={`${hotButton} mt-5`}>
            <RefreshCw className="size-4" />
            {session.needsCleanup ? "Concluir desconexão" : "Abrir novamente"}
          </button>
        )}
      </div>
    );
  return (
    <section
      aria-label={`Sessão de ${session.name}`}
      className={
        expanded
          ? "fixed inset-0 z-[75] flex flex-col overflow-y-auto bg-background p-3"
          : "overflow-hidden rounded-2xl border border-border bg-card"
      }
    >
      <label className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        {videoLive ? "Vídeo ao vivo" : "Atualização por capturas"}{" "}
        {!videoLive && (
          <select
            aria-label="Velocidade da prévia"
            value={previewRate}
            onChange={(event) => setPreviewRate(event.target.value as typeof previewRate)}
            className="rounded border border-border bg-background px-2 py-1"
          >
            <option value="economy">Econômica</option>
            <option value="balanced">Equilibrada</option>
            <option value="responsive">Mais rápida</option>
          </select>
        )}
        <span>
          {videoLive
            ? "Transmissão H.264 com baixa latência, sem áudio."
            : "Mais rápida usa mais CPU. Capturas são a alternativa quando o vídeo não está disponível."}
        </span>
      </label>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
        <div className="flex min-w-0 items-center gap-2">
          {session.kind === "android" ? (
            <Smartphone className="size-4 text-success" />
          ) : (
            <Monitor className="size-4 text-primary" />
          )}
          <h3 className="truncate text-sm font-bold">{session.name}</h3>
          <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-1 text-xs font-semibold text-success">
            <span className="size-1.5 rounded-full bg-success" />
            {videoLive ? "Vídeo conectado" : lastFrame ? "Tela conectada" : "Conectando tela"}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className={iconButton}
            aria-label={expanded ? "Reduzir sessão" : "Ampliar sessão"}
          >
            <Expand className="size-4" />
          </button>
          <button onClick={onStop} className={hotButton}>
            <Square className="size-3.5" />
            {session.kind === "android" && !session.androidBinding?.deviceId.startsWith("runtime:")
              ? "Desconectar"
              : "Encerrar"}
          </button>
        </div>
      </header>
      {session.kind === "android" && (
        <div className="space-y-2 border-b border-border bg-amber-500/5 p-3 text-xs leading-5">
          <p className="font-semibold">Isolamento de rede ainda não comprovado</p>
          {session.runtimeInfo && (
            <p>
              RAM efetiva: {session.runtimeInfo.effectiveRamMb} MB (solicitada:{" "}
              {session.runtimeInfo.requestedRamMb} MB) · CPU: {session.runtimeInfo.cpuCores} ·{" "}
              {session.runtimeInfo.resolution} · limite {session.runtimeInfo.targetFps} FPS ·
              gráficos {session.runtimeInfo.graphics}
            </p>
          )}
          <details>
            <summary className="cursor-pointer font-semibold">Detalhes da rede e conexão</summary>
            <p>
              {session.androidBinding?.deviceId.startsWith("runtime:")
                ? "Android próprio experimental: rede restrita e proxy HTTP por canal local. Aplicativos que ignoram proxy HTTP podem ficar sem conexão. Sem áudio ou câmera; isolamento integral em validação."
                : "O proxy HTTP do sistema pode ser ignorado por aplicativos. Esta sessão não garante IP exclusivo, DNS pela proxy ou bloqueio quando ela falha."}
            </p>
            {session.androidBinding && (
              <p>
                ADB: {session.androidBinding.endpoint} · vínculo persistido com a instância deste
                perfil.
              </p>
            )}
            <button
              className={hotButton}
              disabled={checkingNetwork}
              onClick={() => void checkNetwork()}
            >
              {checkingNetwork ? "Conferindo…" : "Conferir configuração de rede"}
            </button>
            {network && (
              <p role="status">
                {network.message} Conferido em{" "}
                {new Date(network.checkedAt).toLocaleTimeString("pt-BR")}.
              </p>
            )}
          </details>
        </div>
      )}
      {session.kind === "browser" && (
        <div
          className="flex items-center gap-1 overflow-x-auto border-b border-border bg-background/60 p-2"
          role="tablist"
          aria-label="Abas do navegador"
        >
          {frame?.tabs.map((tab) => (
            <div
              key={tab.id}
              className={`flex shrink-0 items-center rounded-lg border text-xs ${tab.active ? "border-primary/30 bg-primary/10 text-primary" : "border-transparent text-muted-foreground"}`}
            >
              <button
                role="tab"
                aria-selected={tab.active}
                onClick={() => void control({ action: "tab", tabId: tab.id })}
                className="max-w-48 truncate px-3 py-2.5"
              >
                {tab.title}
              </button>
              {frame.tabs.length > 1 && (
                <button
                  aria-label={`Fechar aba ${tab.title}`}
                  onClick={() => void control({ action: "closeTab", tabId: tab.id })}
                  className="rounded-md p-1.5 hover:bg-secondary"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => void addTab()}
            aria-label="Nova aba do navegador"
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
          >
            <Plus className="size-4" />
          </button>
        </div>
      )}
      <form onSubmit={navigate} className="flex gap-2 border-b border-border p-2">
        {session.kind === "browser" && (
          <>
            <button
              type="button"
              onClick={() => void control({ action: "back" })}
              className={iconButton}
              aria-label="Voltar página"
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => void control({ action: "forward" })}
              className={`${iconButton} hidden sm:inline-flex`}
              aria-label="Avançar página"
            >
              <ArrowRight className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => void control({ action: "reload" })}
              className={iconButton}
              aria-label="Recarregar página"
            >
              <RefreshCw className="size-4" />
            </button>
          </>
        )}
        <input
          aria-label="Endereço ou pesquisa"
          placeholder="Digite um site ou pesquise"
          value={address}
          onFocus={() => setEditing(true)}
          onChange={(event) => setAddress(event.target.value)}
          className={`${hotInput} min-w-0`}
        />
        <button className={iconButton} aria-label="Abrir endereço">
          <ArrowRight className="size-4" />
        </button>
      </form>
      {error && (
        <p
          role="alert"
          className="border-b border-destructive/20 bg-destructive/10 p-3 text-xs leading-5 text-destructive"
        >
          {error}
        </p>
      )}
      <div className="relative flex min-h-80 flex-1 items-start justify-center overflow-auto bg-background p-2 sm:p-4">
        {frame?.dialog && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 p-5">
            <div
              role="alertdialog"
              aria-label="Mensagem da página"
              className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-5"
            >
              <h4 className="font-bold">Mensagem da página</h4>
              <p className="max-h-44 overflow-y-auto whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {frame.dialog.message}
              </p>
              {frame.dialog.type === "prompt" && (
                <input
                  aria-label="Resposta à página"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  className={hotInput}
                />
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => void control({ action: "dialog", accept: false })}
                  className={hotButton}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void control({ action: "dialog", accept: true, text: prompt })}
                  className={hotButton}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
        <div
          ref={screen}
          tabIndex={0}
          role="application"
          aria-label={
            session.kind === "android"
              ? "Tela Android: toque, arraste e use o teclado para controlar"
              : "Tela do navegador: clique, role e digite para controlar"
          }
          className={`relative touch-none select-none overflow-hidden rounded-xl border border-border bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring ${session.kind === "android" ? "max-w-sm" : "w-full"}`}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.focus({ preventScroll: true });
            pointer.current = position(event);
            if (pointer.current) event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={(event) => {
            const start = pointer.current;
            pointer.current = null;
            const end = position(event);
            if (!start || !end) return;
            const drag = Math.hypot(start.x - end.x, start.y - end.y) > 8;
            void control({ action: drag ? "swipe" : "tap", ...start, toX: end.x, toY: end.y });
          }}
          onPointerCancel={() => {
            pointer.current = null;
          }}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (
              session.kind === "browser" &&
              (event.ctrlKey || event.metaKey) &&
              event.key.toLowerCase() === "a"
            ) {
              event.preventDefault();
              void control({ action: "key", key: "a", ctrl: true });
              return;
            }
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (event.key.length === 1) {
              event.preventDefault();
              void control({ action: "text", text: event.key });
            } else if (
              [
                "Enter",
                "Backspace",
                "Escape",
                "Delete",
                "ArrowLeft",
                "ArrowRight",
                "ArrowUp",
                "ArrowDown",
                "Home",
                "End",
                "PageUp",
                "PageDown",
              ].includes(event.key)
            ) {
              event.preventDefault();
              void control({ action: "key", key: event.key, shift: event.shiftKey });
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            void control({ action: "text", text: event.clipboardData.getData("text") });
          }}
        >
          {session.androidBinding?.deviceId.startsWith("runtime:") && session.runtimeInfo && (
            <AndroidVideo
              connection={connection}
              profileId={session.profileId}
              name={session.name}
              running={session.status === "running"}
              onLive={onVideoLive}
            />
          )}
          {frame?.image && !videoLive ? (
            <img
              src={frame.image}
              alt={`Tela atual de ${session.name}`}
              draggable={false}
              width={frame.width}
              height={frame.height}
              className={
                session.kind === "android"
                  ? "max-h-[68dvh] w-auto max-w-full object-contain"
                  : "h-auto w-full"
              }
            />
          ) : !videoLive ? (
            <div className="flex min-h-80 items-center justify-center gap-3 p-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-5 animate-spin" />
              Recebendo a tela…
            </div>
          ) : null}
        </div>
      </div>
      <footer className="space-y-3 border-t border-border p-3">
        {session.kind === "android" && (
          <div className="flex justify-center gap-6">
            <button
              onClick={() => void control({ action: "settings" })}
              className={iconButton}
              aria-label="Android: configurações"
            >
              <Settings className="size-4" />
            </button>
            <button
              onClick={() => void control({ action: "key", key: "back" })}
              className={iconButton}
              aria-label="Android: voltar"
            >
              <Triangle className="size-4 -rotate-90" />
            </button>
            <button
              onClick={() => void control({ action: "key", key: "home" })}
              className={iconButton}
              aria-label="Android: início"
            >
              <Circle className="size-4" />
            </button>
            <button
              onClick={() => void control({ action: "key", key: "recent" })}
              className={iconButton}
              aria-label="Android: aplicativos recentes"
            >
              <Square className="size-4" />
            </button>
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (text) {
              void control({ action: "text", text });
              setText("");
            }
          }}
          className="flex gap-2"
        >
          <label className="sr-only" htmlFor={`session-text-${session.profileId}`}>
            Texto para enviar ao ambiente
          </label>
          <input
            id={`session-text-${session.profileId}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Clique em um campo da tela e envie seu texto aqui"
            maxLength={session.kind === "android" ? 1000 : 4000}
            className={`${hotInput} min-w-0`}
          />
          <button disabled={!text} className={hotButton}>
            <Keyboard className="size-4" />
            <span className="hidden sm:inline">Enviar texto</span>
          </button>
          <button
            type="button"
            onClick={() => void control({ action: "key", key: "Enter" })}
            className={hotButton}
          >
            Enter
          </button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs leading-5 text-muted-foreground">
          <p>
            Clique ou toque na tela para interagir. Arraste para mover e use a roda para rolar.
            {session.kind === "android"
              ? " Texto via ADB: sem acentos nesta versão."
              : " Clique na tela antes de digitar."}
          </p>
          {frame?.image && (
            <a
              href={frame.image}
              download={`${session.name.replace(/[^a-z0-9_-]/gi, "-")}.${session.kind === "android" ? "png" : "jpg"}`}
              onClick={(event) => {
                const canvas = screen.current?.querySelector<HTMLCanvasElement>(
                  'canvas[data-live="true"]',
                );
                if (canvas) event.currentTarget.href = canvas.toDataURL("image/png");
              }}
              className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-primary"
            >
              <Download className="size-3.5" />
              Salvar captura
            </a>
          )}
        </div>
      </footer>
    </section>
  );
}
