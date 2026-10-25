import { WorkspaceMode } from "./WorkspaceMode";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Cable,
  CheckCircle2,
  Copy,
  Globe2,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Monitor,
  MonitorSmartphone,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Square,
  Tag,
  Trash2,
  Unplug,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ConnectComputer, ProfileForm, ProxyForm } from "@/components/hot-profiles/HotForms";
import { HotDialog, hotButton, hotInput, hotPrimary } from "@/components/hot-profiles/HotDialog";
import { HotSessionView } from "@/components/hot-profiles/HotSessionView";
import {
  bridgeRequest,
  EMPTY_WORKSPACE,
  HOT_CONNECTION_KEY,
  connectorUrl,
  sessionActive,
  sessionLabel,
  type HotConnection,
  type HotDevices,
  type HotProfile,
  type HotProxy,
  type HotWorkspace,
  type ProfileKind,
} from "@/lib/hot-profiles";

function clearSavedConnection() {
  try {
    sessionStorage.removeItem(HOT_CONNECTION_KEY);
  } catch {
    return;
  }
}

function DesktopShell({ children }: { children: ReactNode }) {
  return <div className="app-workspace min-h-screen bg-background text-foreground">{children}</div>;
}

export function LegacyLocalWorkspace({
  standalone = false,
  desktopConnection,
}: { standalone?: boolean; desktopConnection?: HotConnection } = {}) {
  const [connection, setConnection] = useState<HotConnection | null>(null);
  const [workspace, setWorkspace] = useState<HotWorkspace>(EMPTY_WORKSPACE);
  const [devices, setDevices] = useState<HotDevices | null>(null);
  const [online, setOnline] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [tab, setTab] = useState<"profiles" | "proxies" | "sessions">("profiles");
  const [kind, setKind] = useState<"all" | ProfileKind>("all");
  const [search, setSearch] = useState("");
  const [proxyFilter, setProxyFilter] = useState("all");
  const [profileForm, setProfileForm] = useState<{
    initialKind: ProfileKind;
    profile?: HotProfile;
  } | null>(null);
  const [proxyForm, setProxyForm] = useState<{ proxy?: HotProxy } | null>(null);
  const [remove, setRemove] = useState<{
    type: "profiles" | "proxies";
    id: string;
    name: string;
  } | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [checks, setChecks] = useState<
    Record<string, { ok: boolean; latency?: number; message: string }>
  >({});
  const refreshing = useRef(false);
  const currentConnection = useRef<HotConnection | null>(null);
  useEffect(() => {
    currentConnection.current = connection;
    return () => {
      currentConnection.current = null;
    };
  }, [connection]);
  useEffect(() => {
    if (desktopConnection) {
      setConnection(desktopConnection);
      setLoaded(true);
      return;
    }
    try {
      const saved = sessionStorage.getItem(HOT_CONNECTION_KEY);
      if (saved) {
        const value = JSON.parse(saved);
        if (typeof value.token === "string" && typeof value.computer === "string") {
          connectorUrl(value.url);
          setConnection(value);
        }
      }
    } catch {
      clearSavedConnection();
    }
    setLoaded(true);
  }, [desktopConnection]);
  const refresh = useCallback(async () => {
    if (!connection || refreshing.current) return;
    refreshing.current = true;
    try {
      const next = await bridgeRequest<HotWorkspace>(
        connection,
        "/v1/state",
        undefined,
        "GET",
        AbortSignal.timeout(5000),
      );
      if (currentConnection.current !== connection) return;
      setWorkspace(next);
      setOnline(true);
    } catch (reason) {
      if (currentConnection.current !== connection) return;
      setOnline(false);
      if ((reason as { status?: number }).status === 401) {
        setConnection(null);
        clearSavedConnection();
        setError("O conector foi reiniciado. Conecte novamente com o novo código.");
      }
    } finally {
      refreshing.current = false;
    }
  }, [connection]);
  useEffect(() => {
    if (!connection) return;
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [connection, refresh]);
  const refreshDevices = useCallback(async () => {
    if (!connection) return;
    setDevices(await bridgeRequest<HotDevices>(connection, "/v1/devices"));
  }, [connection]);
  useEffect(() => {
    if (connection) void refreshDevices().catch(() => {});
  }, [connection, refreshDevices]);
  async function connect(value: HotConnection) {
    setConnecting(true);
    try {
      const next = await bridgeRequest<HotWorkspace>(value, "/v1/state");
      let temporary = false;
      try {
        sessionStorage.setItem(HOT_CONNECTION_KEY, JSON.stringify(value));
      } catch {
        temporary = true;
      }
      setWorkspace(next);
      setConnection(value);
      setOnline(true);
      setShowConnect(false);
      setError("");
      setMessage(
        temporary
          ? "Computador conectado. Este navegador não permite salvar a conexão; será preciso conectar novamente ao recarregar a página."
          : "Computador conectado. Seus ambientes estão prontos para organizar.",
      );
    } finally {
      setConnecting(false);
    }
  }
  async function act(key: string, action: () => Promise<void>, success = "") {
    setBusy(key);
    setError("");
    setMessage("");
    try {
      await action();
      await refresh();
      if (success) setMessage(success);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy("");
    }
  }
  function create(kind: ProfileKind = "browser") {
    if (!online) {
      setShowConnect(true);
      return;
    }
    setProfileForm({ initialKind: kind });
    void refreshDevices().catch(() => {});
  }
  function createProxy() {
    if (!online) {
      setShowConnect(true);
      return;
    }
    setProxyForm({});
  }
  async function start(profile: HotProfile) {
    if (!connection) return;
    const current = workspace.sessions.find((session) => session.profileId === profile.id);
    if (!sessionActive(current)) {
      await bridgeRequest(connection, `/v1/profiles/${profile.id}/start`, {});
      await refresh();
    }
    setSessionId(profile.id);
    setTab("sessions");
  }
  async function stop(id: string) {
    if (connection) await bridgeRequest(connection, `/v1/profiles/${id}/stop`, {});
  }
  async function openManager() {
    if (!connection) return;
    await bridgeRequest(connection, "/v1/android/manager", {});
    setMessage(
      "Gerenciador do BlueStacks aberto no computador. Crie uma nova instância e depois atualize os dispositivos aqui.",
    );
  }
  const profiles = workspace.profiles.filter(
    (profile) =>
      (kind === "all" || profile.kind === kind) &&
      `${profile.name} ${profile.tags.join(" ")} ${profile.notes}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const proxies = workspace.proxies.filter((proxy) => {
    const owners = workspace.profiles.filter((profile) => profile.proxyId === proxy.id);
    return (
      `${proxy.name} ${proxy.host} ${owners.map((item) => item.name).join(" ")}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()) &&
      (proxyFilter === "all" || (proxyFilter === "available" ? !owners.length : !!owners.length))
    );
  });
  const running = workspace.sessions.filter(sessionActive);
  const visibleSessions = workspace.sessions.filter((session) => session.status !== "stopped");
  const selectedSession =
    workspace.sessions.find((session) => session.profileId === sessionId) ?? visibleSessions[0];
  const currentProfile = workspace.profiles.find(
    (profile) => profile.id === selectedSession?.profileId,
  );
  const browserCount = workspace.profiles.filter((profile) => profile.kind === "browser").length;
  const androidCount = workspace.profiles.filter((profile) => profile.kind === "android").length;
  const iconButton =
    "inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30";
  const Shell = standalone ? DesktopShell : AppShell;
  return (
    <Shell>
      <main className="mx-auto min-h-screen max-w-screen-2xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {!standalone && <WorkspaceMode mode="local" />}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <MonitorSmartphone className="size-6" />
            </span>
            <div>
              <p className="mb-1 text-xs font-bold tracking-widest text-primary">
                SEUS AMBIENTES, SEU CONTROLE
              </p>
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Hot Profiles
              </h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Navegadores e celulares Android no mesmo espaço.
              </p>
            </div>
          </div>
          <button disabled={standalone} onClick={() => setShowConnect(true)} className={hotButton}>
            <Cable className="size-4" />
            <span>
              {standalone
                ? online
                  ? "Aplicativo local conectado"
                  : "Aguardando serviço local"
                : online
                  ? connection?.computer
                  : "Conectar computador"}
            </span>
            <span
              className={`size-2 rounded-full ${online ? "bg-success" : "bg-muted-foreground"}`}
            />
          </button>
        </header>
        {!online && (
          <section className="flex flex-col justify-between gap-5 rounded-2xl border border-primary/25 bg-primary/5 p-5 sm:flex-row sm:items-center">
            <div className="flex gap-3">
              <Cable className="mt-1 size-5 shrink-0 text-primary" />
              <div>
                <h2 className="font-semibold">
                  {connection
                    ? "Seu computador está desconectado"
                    : "Conecte seu computador para começar"}
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {standalone
                    ? "Aguarde a conexão local. Se ela não voltar, feche o conector antigo e reabra o aplicativo; seus dados ficam preservados."
                    : connection
                      ? "Mantenha o conector aberto para acessar suas sessões. Seus perfis continuam salvos no computador."
                      : "O conector executa os ambientes no seu computador e traz a tela para cá. Você organiza tudo pelo painel, inclusive no site publicado."}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {connection && (
                <button onClick={() => void refresh()} className={hotButton}>
                  <RefreshCw className="size-4" />
                  Reconectar
                </button>
              )}
              {!standalone && (
                <button onClick={() => setShowConnect(true)} className={hotPrimary}>
                  {connection ? "Novo código" : "Conectar agora"}
                  <ArrowRight className="size-4" />
                </button>
              )}
            </div>
          </section>
        )}
        {online && workspace.performance && (
          <section
            aria-label="Capacidade do computador"
            className="rounded-lg border border-border bg-card p-4 text-sm"
          >
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <span>
                RAM: <strong>{workspace.performance.freeGB} GB livres</strong> /{" "}
                {workspace.performance.totalGB} GB
              </span>
              <span>{workspace.performance.cores} processadores lógicos</span>
              <span>
                Sessões:{" "}
                <strong>
                  {running.length} / {workspace.performance.maxSessions}
                </strong>
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              O limite inicial é conservador. Android consome mais recursos e exige virtualização
              ativa. Encerrar o controle de um Android não desliga o emulador; feche instâncias que
              não estiver usando no gerenciador.
            </p>
          </section>
        )}
        {message && (
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-xl border border-success/25 bg-success/10 p-3 text-sm leading-6 text-success"
          >
            <span className="flex items-start gap-2">
              <CheckCircle2 className="mt-1 size-4 shrink-0" />
              {message}
            </span>
            <button onClick={() => setMessage("")} aria-label="Fechar aviso">
              <X className="size-4" />
            </button>
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm leading-6 text-destructive"
          >
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Fechar erro">
              <X className="size-4" />
            </button>
          </div>
        )}
        <section
          aria-label="Resumo dos ambientes"
          className="grid grid-cols-2 gap-3 xl:grid-cols-4"
        >
          {[
            {
              title: "Navegadores",
              count: browserCount,
              detail: "Dados separados por perfil",
              Icon: Monitor,
            },
            {
              title: "Celulares Android",
              count: androidCount,
              detail: "Instâncias independentes",
              Icon: Smartphone,
            },
            {
              title: "Proxies",
              count: workspace.proxies.length,
              detail: "Conexões dos seus ambientes",
              Icon: Globe2,
            },
            {
              title: "Em execução",
              count: online ? running.length : "—",
              detail: online ? "Neste computador" : "Conecte para acompanhar",
              Icon: Activity,
            },
          ].map((metric) => (
            <div key={metric.title} className="rounded-2xl border border-border bg-card/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">{metric.title}</p>
                <metric.Icon className="size-4 text-primary" />
              </div>
              <p className="mt-3 font-display text-3xl font-bold">{metric.count}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{metric.detail}</p>
            </div>
          ))}
        </section>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <nav aria-label="Áreas do Hot Profiles" className="flex gap-1">
            {(
              [
                { id: "profiles", title: "Perfis", Icon: Layers3 },
                { id: "proxies", title: "Proxies", Icon: Globe2 },
                { id: "sessions", title: "Sessões", Icon: MonitorSmartphone },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                aria-current={tab === item.id ? "page" : undefined}
                onClick={() => {
                  setTab(item.id);
                  setSearch("");
                }}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${tab === item.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                <item.Icon className="size-4" />
                {item.title}
                {item.id === "sessions" && running.length > 0 && (
                  <span className="rounded-md bg-primary/15 px-1.5 text-xs">{running.length}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="flex gap-2">
            {online && (
              <button
                onClick={() =>
                  void act("refresh", async () => {
                    await refreshDevices();
                  })
                }
                disabled={!!busy}
                className={hotButton}
                aria-label="Atualizar ambientes"
              >
                <RefreshCw className={`size-4 ${busy === "refresh" ? "animate-spin" : ""}`} />
              </button>
            )}
            <button
              onClick={() =>
                tab === "proxies"
                  ? createProxy()
                  : create(kind === "android" ? "android" : "browser")
              }
              className={hotPrimary}
            >
              <Plus className="size-4" />
              {tab === "proxies" ? "Adicionar proxy" : "Novo perfil"}
            </button>
          </div>
        </div>
        {tab === "profiles" && (
          <section aria-label="Seus perfis" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
                {(
                  [
                    { value: "all", name: "Todos" },
                    { value: "browser", name: "Navegadores" },
                    { value: "android", name: "Android" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.value}
                    aria-pressed={kind === item.value}
                    onClick={() => setKind(item.value)}
                    className={`min-h-9 rounded-lg px-3 text-xs font-semibold ${kind === item.value ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              <label className="relative w-full sm:max-w-xs">
                <span className="sr-only">Buscar perfis</span>
                <Search className="absolute top-3 left-3 size-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar nome, tag ou observação"
                  className={`${hotInput} pl-9`}
                />
              </label>
            </div>
            {profiles.length ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="hidden grid-cols-12 gap-4 border-b border-border bg-background/40 px-5 py-3 text-xs font-bold tracking-wide text-muted-foreground xl:grid">
                  <span className="col-span-4">PERFIL</span>
                  <span className="col-span-3">CONEXÃO</span>
                  <span className="col-span-2">ESTADO</span>
                  <span className="col-span-3 text-right">AÇÕES</span>
                </div>
                {profiles.map((profile) => {
                  const session = workspace.sessions.find((item) => item.profileId === profile.id);
                  const proxy = workspace.proxies.find((item) => item.id === profile.proxyId);
                  const active = sessionActive(session);
                  const adbPending =
                    profile.kind === "android" &&
                    devices?.devices.find((device) => device.id === profile.deviceId)
                      ?.adbEnabled === false &&
                    !active;
                  return (
                    <article
                      key={profile.id}
                      className="grid gap-4 border-b border-border px-5 py-5 last:border-b-0 xl:grid-cols-12 xl:items-center"
                    >
                      <div className="flex min-w-0 gap-3 xl:col-span-4">
                        <span
                          className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${profile.kind === "android" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}
                        >
                          {profile.kind === "android" ? (
                            <Smartphone className="size-5" />
                          ) : (
                            <Monitor className="size-5" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <h3 className="break-words text-sm font-bold">{profile.name}</h3>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {profile.kind === "android"
                              ? devices?.devices.find((device) => device.id === profile.deviceId)
                                  ?.name || "Android"
                              : "Navegador isolado"}
                          </p>
                          {profile.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {profile.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {profile.notes && (
                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                              {profile.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 text-xs xl:col-span-3">
                        <div className="flex items-center gap-2">
                          <Globe2 className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate font-semibold">
                            {proxy?.name ||
                              (profile.kind === "android"
                                ? "Rede atual do Android"
                                : "Conexão do computador")}
                          </span>
                        </div>
                        <p className="mt-1 truncate pl-5 text-muted-foreground">
                          {proxy
                            ? `${proxy.protocol.toUpperCase()} · ${proxy.host}:${proxy.port}`
                            : "Sem proxy aplicado pelo Hot Profiles"}
                        </p>
                      </div>
                      <div className="xl:col-span-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ${!online ? "bg-muted text-muted-foreground" : session?.status === "running" ? "bg-success/10 text-success" : session?.status === "error" ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"}`}
                        >
                          <span className="size-1.5 rounded-full bg-current" />
                          {online
                            ? adbPending
                              ? "ADB pendente"
                              : sessionLabel(session)
                            : "Sem comunicação"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 xl:col-span-3 xl:justify-end">
                        <button
                          onClick={() =>
                            adbPending
                              ? setProfileForm({ initialKind: profile.kind, profile })
                              : void act(profile.id, () => start(profile))
                          }
                          disabled={!online || !!busy || session?.status === "stopping"}
                          className={`${hotButton} ${active ? "border-primary/30 text-primary" : "bg-primary/10 text-primary"}`}
                        >
                          {busy === profile.id ? (
                            <LoaderCircle className="size-4 animate-spin" />
                          ) : adbPending ? (
                            <Pencil className="size-3.5" />
                          ) : (
                            <Play className="size-3.5" />
                          )}
                          {adbPending ? "Configurar" : active ? "Abrir" : "Iniciar"}
                        </button>
                        <button
                          aria-label={`Editar ${profile.name}`}
                          disabled={!online || active || !!busy}
                          onClick={() => {
                            setProfileForm({ initialKind: profile.kind, profile });
                            void refreshDevices().catch(() => {});
                          }}
                          className={iconButton}
                        >
                          <Pencil className="size-4" />
                        </button>
                        {profile.kind === "browser" && (
                          <button
                            aria-label={`Duplicar configuração de ${profile.name}`}
                            disabled={!online || !!busy}
                            className={iconButton}
                            onClick={() =>
                              void act(
                                `copy-${profile.id}`,
                                async () => {
                                  if (connection)
                                    await bridgeRequest(connection, "/v1/profiles", {
                                      ...profile,
                                      proxyId: null,
                                      name: `${profile.name.slice(0, 70)} · cópia`,
                                    });
                                },
                                "Configuração duplicada sem reutilizar o proxy. Edite o novo perfil para escolher outra conexão.",
                              )
                            }
                          >
                            <Copy className="size-4" />
                          </button>
                        )}
                        <button
                          aria-label={`Excluir cadastro de ${profile.name}`}
                          disabled={!online || active || !!busy}
                          onClick={() => {
                            setError("");
                            setRemove({ type: "profiles", id: profile.id, name: profile.name });
                          }}
                          className={`${iconButton} hover:text-destructive`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center sm:p-12">
                <Layers3 className="mx-auto mb-4 size-10 text-primary/70" />
                <h2 className="font-display text-xl font-bold">
                  {search
                    ? "Nenhum perfil encontrado"
                    : "Seu próximo projeto começa com um ambiente"}
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
                  {search
                    ? "Tente outro nome ou tag para encontrar o que procura."
                    : "Crie um navegador com seus próprios dados ou conecte um celular Android. Cada ambiente fica organizado em um perfil."}
                </p>
                {!search && (
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button onClick={() => create("browser")} className={hotPrimary}>
                      <Monitor className="size-4" />
                      Criar navegador
                    </button>
                    <button onClick={() => create("android")} className={hotButton}>
                      <Smartphone className="size-4" />
                      Criar celular Android
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex gap-3 rounded-xl border border-border bg-card/40 p-4">
                <LockKeyhole className="mt-1 size-5 shrink-0 text-primary" />
                <div>
                  <h3 className="text-sm font-semibold">Um espaço para cada perfil</h3>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">
                    Navegadores têm armazenamento próprio. Celulares usam instâncias independentes
                    do Android. As sessões continuam no seu computador.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-xl border border-border bg-card/40 p-4">
                <MonitorSmartphone className="mt-1 size-5 shrink-0 text-primary" />
                <div>
                  <h3 className="text-sm font-semibold">Organize aqui, trabalhe nas sessões</h3>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">
                    Abra vários ambientes, alterne entre as abas e controle as telas. O conector
                    precisa permanecer aberto para manter a conexão.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
        {tab === "proxies" && (
          <section aria-label="Seus proxies" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Sua central de conexões HTTP, HTTPS e SOCKS5. Use um cadastro diferente em cada
                perfil.
              </p>
              <label className="relative w-full sm:max-w-xs">
                <span className="sr-only">Buscar proxies</span>
                <Search className="absolute top-3 left-3 size-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar nome ou host"
                  className={`${hotInput} pl-9`}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <label>
                Mostrar{" "}
                <select
                  aria-label="Filtrar proxies por vínculo"
                  value={proxyFilter}
                  onChange={(event) => setProxyFilter(event.target.value)}
                  className="ml-2 rounded border border-border bg-background p-2"
                >
                  <option value="all">Todos</option>
                  <option value="available">Disponíveis</option>
                  <option value="assigned">Vinculados</option>
                </select>
              </label>
              <span>
                {
                  workspace.proxies.filter(
                    (proxy) => !workspace.profiles.some((profile) => profile.proxyId === proxy.id),
                  ).length
                }{" "}
                disponíveis para novos perfis
              </span>
              <span>A verificação testa conectividade; não garante IP exclusivo ou reputação.</span>
            </div>
            {proxies.length ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {proxies.map((proxy) => (
                  <article key={proxy.id} className="rounded-2xl border border-border bg-card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Globe2 className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold">{proxy.name}</h3>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {proxy.host}:{proxy.port}
                          </p>
                        </div>
                      </div>
                      <span className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold">
                        {proxy.protocol.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <LockKeyhole className="size-3.5" />
                        {proxy.username ? "Com autenticação" : "Sem autenticação"}
                      </span>
                      <span>
                        {
                          workspace.profiles.filter((profile) => profile.proxyId === proxy.id)
                            .length
                        }{" "}
                        perfis vinculados
                      </span>
                      <span>
                        {workspace.profiles
                          .filter((profile) => profile.proxyId === proxy.id)
                          .map((profile) => profile.name)
                          .join(", ") || "Disponível para um novo perfil"}
                      </span>
                    </div>
                    {checks[proxy.id] && (
                      <p
                        role="status"
                        className={`mt-3 rounded-xl p-3 text-xs leading-5 ${checks[proxy.id].ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
                      >
                        {checks[proxy.id].ok
                          ? `Conexão aceita · ${checks[proxy.id].latency} ms. `
                          : ""}
                        {checks[proxy.id].message}
                      </p>
                    )}
                    <footer className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                      <button
                        disabled={!online || !!busy}
                        onClick={() =>
                          void act(proxy.id, async () => {
                            if (connection) {
                              const result = await bridgeRequest<{
                                ok: boolean;
                                latency?: number;
                                message: string;
                              }>(connection, `/v1/proxies/${proxy.id}/check`, {});
                              setChecks((current) => ({ ...current, [proxy.id]: result }));
                            }
                          })
                        }
                        className={hotButton}
                      >
                        {busy === proxy.id ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="size-4" />
                        )}
                        Verificar conexão
                      </button>
                      <button
                        aria-label={`Editar proxy ${proxy.name}`}
                        disabled={!online || !!busy}
                        onClick={() => setProxyForm({ proxy })}
                        className={iconButton}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        aria-label={`Excluir proxy ${proxy.name}`}
                        disabled={!online || !!busy}
                        onClick={() => {
                          setError("");
                          setRemove({ type: "proxies", id: proxy.id, name: proxy.name });
                        }}
                        className={`${iconButton} hover:text-destructive`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
                <Globe2 className="mx-auto mb-4 size-10 text-primary/70" />
                <h2 className="text-xl font-bold">
                  {search
                    ? "Nenhum proxy encontrado"
                    : "As conexões dos seus projetos, em um só lugar"}
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
                  Adicione seu proxy e escolha o perfil que vai utilizá-lo. As senhas não ficam
                  salvas no navegador do painel.
                </p>
                <button onClick={createProxy} className={`${hotPrimary} mt-5`}>
                  <Plus className="size-4" />
                  Adicionar proxy
                </button>
              </div>
            )}
          </section>
        )}
        {tab === "sessions" && (
          <section aria-label="Sessões dos perfis" className="space-y-4">
            {visibleSessions.length > 0 && (
              <div
                className="flex gap-2 overflow-x-auto pb-1"
                role="tablist"
                aria-label="Ambientes abertos"
              >
                {visibleSessions.map((session) => (
                  <button
                    key={session.profileId}
                    role="tab"
                    aria-selected={selectedSession?.profileId === session.profileId}
                    onClick={() => setSessionId(session.profileId)}
                    className={`${hotButton} max-w-xs shrink-0 ${selectedSession?.profileId === session.profileId ? "border-primary/40 bg-primary/10 text-primary" : ""}`}
                  >
                    {session.kind === "android" ? (
                      <Smartphone className="size-4 shrink-0" />
                    ) : (
                      <Monitor className="size-4 shrink-0" />
                    )}
                    <span className="truncate">{session.name}</span>
                    {session.status === "starting" && (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    )}
                  </button>
                ))}
              </div>
            )}
            {selectedSession && connection && online ? (
              <HotSessionView
                key={`${selectedSession.profileId}-${selectedSession.startedAt}`}
                session={selectedSession}
                connection={connection}
                onStop={() => void act("stop", () => stop(selectedSession.profileId))}
                onRetry={() =>
                  currentProfile && void act(currentProfile.id, () => start(currentProfile))
                }
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
                <MonitorSmartphone className="mx-auto mb-4 size-10 text-primary/70" />
                <h2 className="text-xl font-bold">
                  {online ? "Seu espaço de trabalho ao vivo" : "Conecte para acessar suas sessões"}
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
                  {online
                    ? "Inicie um perfil para abrir a tela aqui. Você poderá alternar entre navegadores e celulares nas abas acima."
                    : "As telas vêm do computador conectado. Abra o conector para continuar."}
                </p>
                <button
                  onClick={() => (online ? setTab("profiles") : setShowConnect(true))}
                  className={`${hotPrimary} mt-5`}
                >
                  {online ? "Escolher perfil" : "Conectar computador"}
                  <ArrowRight className="size-4" />
                </button>
              </div>
            )}
          </section>
        )}
        {online && workspace.activities.length > 0 && tab === "profiles" && (
          <details className="rounded-xl border border-border bg-card/40 p-4">
            <summary className="cursor-pointer text-sm font-semibold">Atividade recente</summary>
            <ul className="mt-3 space-y-3">
              {workspace.activities.slice(0, 6).map((activity) => (
                <li
                  key={activity.id}
                  className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"
                >
                  <span>
                    {activity.action} · {activity.name}
                  </span>
                  <time dateTime={activity.at}>
                    {new Date(activity.at).toLocaleString("pt-BR")}
                  </time>
                </li>
              ))}
            </ul>
          </details>
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs leading-6 text-muted-foreground">
          <p className="flex items-center gap-2">
            <LockKeyhole className="size-3.5" />
            Dados e credenciais no computador conectado.
          </p>
          {connection && !standalone && (
            <button
              onClick={() => {
                clearSavedConnection();
                setConnection(null);
                setOnline(false);
                setWorkspace(EMPTY_WORKSPACE);
                setDevices(null);
                setMessage(
                  "Painel desconectado. As sessões continuam no conector; feche-as antes de encerrar o conector se não quiser mantê-las abertas.",
                );
              }}
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <Unplug className="size-3.5" />
              Desconectar painel
            </button>
          )}
        </footer>
        {(!loaded || connecting) && (
          <div className="sr-only" role="status">
            Conectando ambientes…
          </div>
        )}
        {showConnect && !standalone && (
          <ConnectComputer onClose={() => setShowConnect(false)} onConnect={connect} />
        )}
        {profileForm && (
          <ProfileForm
            profile={profileForm.profile}
            initialKind={profileForm.initialKind}
            proxies={workspace.proxies}
            profiles={workspace.profiles}
            devices={devices}
            onCreateProxy={async (input) => {
              if (!connection) throw new Error("Conecte seu computador primeiro.");
              const created = await bridgeRequest<HotProxy>(connection, "/v1/proxies", input);
              await refresh();
              return created;
            }}
            onClose={() => setProfileForm(null)}
            onRefresh={refreshDevices}
            onManager={openManager}
            onSave={async (input, id) => {
              if (!connection)
                throw new Error("Conecte seu computador novamente para salvar este perfil.");
              await bridgeRequest(
                connection,
                `/v1/profiles${id ? `/${id}` : ""}`,
                input,
                id ? "PATCH" : "POST",
              );
              await refresh();
              setProfileForm(null);
              setMessage(
                id
                  ? "Perfil atualizado."
                  : "Perfil criado. Clique em Iniciar para abrir seu ambiente.",
              );
            }}
          />
        )}
        {proxyForm && (
          <ProxyForm
            proxy={proxyForm.proxy}
            onClose={() => setProxyForm(null)}
            onSave={async (input, id) => {
              if (!connection)
                throw new Error("Conecte seu computador novamente para salvar este proxy.");
              await bridgeRequest(
                connection,
                `/v1/proxies${id ? `/${id}` : ""}`,
                input,
                id ? "PATCH" : "POST",
              );
              await refresh();
              if (id)
                setChecks((current) => {
                  const next = { ...current };
                  delete next[id];
                  return next;
                });
              setProxyForm(null);
              setMessage("Proxy salvo no computador.");
            }}
          />
        )}
        {remove && (
          <HotDialog
            title="Excluir este cadastro?"
            onClose={() => setRemove(null)}
            busy={busy === "delete"}
          >
            <p className="text-sm leading-7 text-muted-foreground">
              O cadastro de <strong className="text-foreground">{remove.name}</strong> será removido
              do Hot Profiles.
              {remove.type === "profiles"
                ? " Os dados do navegador no disco e a instância Android permanecem preservados."
                : " Um proxy associado a perfis não pode ser excluído."}
            </p>
            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm leading-6 text-destructive"
              >
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button disabled={!!busy} onClick={() => setRemove(null)} className={hotButton}>
                Cancelar
              </button>
              <button
                disabled={!!busy}
                onClick={() =>
                  void act(
                    "delete",
                    async () => {
                      if (!connection)
                        throw new Error(
                          "Conecte seu computador novamente para excluir este cadastro.",
                        );
                      if (connection)
                        await bridgeRequest(
                          connection,
                          `/v1/${remove.type}/${remove.id}`,
                          {},
                          "DELETE",
                        );
                      setRemove(null);
                    },
                    "Cadastro removido.",
                  )
                }
                className={`${hotButton} border-destructive/30 bg-destructive/10 text-destructive`}
              >
                {busy === "delete" && <LoaderCircle className="size-4 animate-spin" />}Excluir
                cadastro
              </button>
            </div>
          </HotDialog>
        )}
      </main>
    </Shell>
  );
}
