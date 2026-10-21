import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  Copy,
  Globe2,
  Info,
  Layers3,
  LoaderCircle,
  LogIn,
  LogOut,
  MonitorSmartphone,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  Square,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { getHotCloudSetup, hotCloudAction } from "@/lib/api/hot-cloud.functions";
import {
  cloudActive,
  cloudLabel,
  cloudProxySchema,
  type CloudCommand,
  type CloudProfile,
  type CloudSession,
  type CloudSetup,
  type CloudViewer,
  type CloudWorkspace as Workspace,
} from "@/lib/hot-cloud";
import type { HotProxy, ProfileKind } from "@/lib/hot-profiles";
import { CloudAuth, CloudConfiguration, CloudProfileForm } from "./CloudForms";
import { HotDialog, hotButton, hotInput, hotPrimary } from "./HotDialog";
import { ProxyForm } from "./HotForms";
import { CloudSessionView } from "./CloudSessionView";

const empty: Workspace = { profiles: [], proxies: [], sessions: [] };
async function call<T = unknown>(command: CloudCommand): Promise<T> {
  try {
    const result = await hotCloudAction({ data: command });
    if (!result.ok) throw new Error(result.error);
    return JSON.parse(result.data) as T;
  } catch (reason) {
    if (/unauthorized|jwt|authorization|no user/i.test((reason as Error).message))
      throw new Error("Sua sessão expirou. Entre novamente para continuar.");
    throw reason;
  }
}
const iconButton =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30";
export function CloudWorkspace() {
  const [setup, setSetup] = useState<CloudSetup | null>(null),
    [account, setAccount] = useState<Session | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace>(empty);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [tab, setTab] = useState<"profiles" | "proxies" | "sessions">("profiles");
  const [kind, setKind] = useState<"all" | ProfileKind>("all"),
    [search, setSearch] = useState("");
  const [authDialog, setAuthDialog] = useState(false),
    [settings, setSettings] = useState(false);
  const [profileForm, setProfileForm] = useState<{
    profile?: CloudProfile;
    initialKind: ProfileKind;
  } | null>(null);
  const [proxyForm, setProxyForm] = useState<{ proxy?: HotProxy } | null>(null);
  const [remove, setRemove] = useState<{
    kind: "profile" | "proxy";
    id: string;
    name: string;
  } | null>(null);
  const [androidStart, setAndroidStart] = useState<CloudProfile | null>(null),
    [selected, setSelected] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ id: string; value: CloudViewer } | null>(null);
  const [viewerError, setViewerError] = useState(""),
    [viewerBusy, setViewerBusy] = useState(false);
  const currentUser = useRef<string | null>(null),
    refreshing = useRef(false),
    generation = useRef(0);
  const userId = account?.user.id ?? null;

  useEffect(() => {
    let alive = true;
    void getHotCloudSetup()
      .then((value) => {
        if (alive) setSetup(value);
      })
      .catch(() => {
        if (alive) setError("Não consegui conferir a configuração da nuvem. Atualize a página.");
      });
    function update(session: Session | null) {
      if (!alive) return;
      const next = session?.user.id ?? null;
      if (currentUser.current !== next) {
        currentUser.current = next;
        generation.current++;
        setWorkspace(empty);
        setLoaded(false);
        setViewer(null);
        setSelected(null);
        setError("");
        setMessage("");
        setProfileForm(null);
        setProxyForm(null);
        setRemove(null);
        setAndroidStart(null);
        setAuthDialog(false);
        setBusy("");
      }
      setAccount(session);
      setAuthLoaded(true);
    }
    const { data } = supabase.auth.onAuthStateChange((_event, session) => update(session));
    void supabase.auth
      .getSession()
      .then(({ data }) => update(data.session))
      .catch(() => {
        if (alive) {
          setAuthLoaded(true);
          setError("Não consegui recuperar seu acesso. Entre novamente.");
        }
      });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  const refresh = useCallback(
    async (checkSessions = false) => {
      if (!userId || refreshing.current) return;
      const revision = generation.current;
      refreshing.current = true;
      try {
        const next = await call<Workspace>({ action: "workspace" });
        if (checkSessions) {
          const active = next.sessions.filter(cloudActive);
          const results = await Promise.allSettled(
            active.map((session) => call<CloudSession>({ action: "sync", id: session.id })),
          );
          results.forEach((result, index) => {
            if (result.status === "fulfilled")
              next.sessions = next.sessions.map((s) =>
                s.id === active[index].id ? result.value : s,
              );
            else
              next.sessions = next.sessions.map((s) =>
                s.id === active[index].id
                  ? { ...s, status: "attention", error: (result.reason as Error).message }
                  : s,
              );
          });
        }
        if (revision === generation.current) {
          setWorkspace(next);
          setLoaded(true);
        }
      } catch (reason) {
        if (revision === generation.current) setError((reason as Error).message);
      } finally {
        refreshing.current = false;
      }
    },
    [userId],
  );
  useEffect(() => {
    if (!userId) return;
    void refresh(true);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [refresh, userId]);
  async function act(key: string, action: () => Promise<unknown>, success = "") {
    const revision = generation.current;
    setBusy(key);
    setError("");
    setMessage("");
    try {
      await action();
      if (revision !== generation.current) return;
      await refresh();
      if (success) setMessage(success);
    } catch (reason) {
      if (revision === generation.current) setError((reason as Error).message);
    } finally {
      if (revision === generation.current) setBusy("");
    }
  }
  function requireAccount() {
    if (!account) throw new Error("Entre na sua conta pelo botão no topo para salvar na nuvem.");
    if (!setup?.storage)
      throw new Error("O banco de dados da nuvem ainda precisa ser configurado.");
  }
  async function start(profile: CloudProfile, confirmed = false) {
    requireAccount();
    const active = workspace.sessions.find((s) => s.profile_id === profile.id && cloudActive(s));
    if (active) {
      setSelected(active.id);
      setTab("sessions");
      return;
    }
    if (profile.kind === "android" && !confirmed) {
      setAndroidStart(profile);
      return;
    }
    const session = await call<CloudSession>({
      action: "start",
      id: profile.id,
      acceptEphemeralAndroid: confirmed,
    });
    setSelected(session.id);
    setTab("sessions");
    setAndroidStart(null);
    setViewer(null);
  }
  const sessions = workspace.sessions.filter(cloudActive);
  const selectedSession = sessions.find((s) => s.id === selected) ?? sessions[0];
  const selectedProfile = workspace.profiles.find((p) => p.id === selectedSession?.profile_id);
  const selectedId = selectedSession?.id,
    selectedStatus = selectedSession?.status;
  const loadViewer = useCallback(async () => {
    if (!selectedId || selectedStatus !== "running") return;
    const revision = generation.current;
    setViewerBusy(true);
    setViewerError("");
    try {
      const value = await call<CloudViewer>({ action: "viewer", id: selectedId });
      if (revision === generation.current) setViewer({ id: selectedId, value });
    } catch (reason) {
      if (revision === generation.current) setViewerError((reason as Error).message);
    } finally {
      if (revision === generation.current) setViewerBusy(false);
    }
  }, [selectedId, selectedStatus]);
  useEffect(() => {
    setViewer(null);
    setViewerError("");
    if (tab === "sessions") void loadViewer();
  }, [loadViewer, tab]);
  const profiles = workspace.profiles.filter(
    (p) =>
      (kind === "all" || p.kind === kind) &&
      `${p.name} ${p.tags.join(" ")} ${p.notes}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const proxies = workspace.proxies.filter((p) =>
    `${p.name} ${p.host}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const missing =
    setup &&
    (!setup.access || !setup.storage || !setup.encryption || !setup.browser || !setup.android);
  return (
    <AppShell>
      <main className="mx-auto min-h-screen max-w-screen-2xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <MonitorSmartphone className="size-6" />
            </span>
            <div>
              <p className="mb-1 text-xs font-bold tracking-widest text-primary">
                SEU ESPAÇO NA NUVEM
              </p>
              <h1 className="font-display text-2xl font-bold sm:text-3xl">Hot Profiles</h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Navegadores, celulares e proxies. Tudo pelo site.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={hotButton} onClick={() => setSettings(true)}>
              <Settings2 className="size-4" />
              Configurar nuvem
            </button>
            {account ? (
              <button
                disabled={!!busy}
                className={hotButton}
                onClick={() =>
                  void act("logout", async () => {
                    const { error } = await supabase.auth.signOut({ scope: "local" });
                    if (error) throw new Error("Não foi possível sair. Tente novamente.");
                  })
                }
              >
                <LogOut className="size-4" />
                Sair
              </button>
            ) : (
              <button
                disabled={!authLoaded}
                className={hotPrimary}
                onClick={() => setAuthDialog(true)}
              >
                <LogIn className="size-4" />
                Entrar na conta
              </button>
            )}
          </div>
        </header>
        <section className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Cloud className="size-3.5" />
                Execução na nuvem
              </div>
              <h2 className="font-display text-xl font-bold">Um ambiente para cada projeto.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Crie perfis separados, escolha sua proxy e acesse a tela do ambiente aqui. Seu
                computador fica livre: não precisa abrir o BlueStacks ou um conector local.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button onClick={() => setProxyForm({})} className={hotButton}>
                <ShieldCheck className="size-4" />
                Adicionar proxy
              </button>
              <button
                onClick={() => setProfileForm({ initialKind: "browser" })}
                className={hotPrimary}
              >
                <Plus className="size-4" />
                Novo perfil
              </button>
            </div>
          </div>
        </section>
        {(missing || !account) && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-sm leading-6 text-muted-foreground">
                {!account ? "Entre para salvar seus perfis e proxies na sua conta. " : ""}
                {missing ? "A execução ainda aguarda a configuração dos serviços de nuvem." : ""}
              </p>
            </div>
            <button
              className="text-sm font-semibold text-primary hover:underline"
              onClick={() => setSettings(true)}
            >
              Ver configuração
              <ArrowRight className="ml-1 inline size-4" />
            </button>
          </section>
        )}
        {account && (
          <p className="break-all text-xs text-muted-foreground">Espaço de {account.user.email}</p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm leading-6 text-destructive"
          >
            {error}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl border border-success/20 bg-success/5 p-4 text-sm"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
            {message}
          </p>
        )}
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            {
              label: "Navegadores",
              count: workspace.profiles.filter((p) => p.kind === "browser").length,
              Icon: Globe2,
            },
            {
              label: "Celulares Android",
              count: workspace.profiles.filter((p) => p.kind === "android").length,
              Icon: Smartphone,
            },
            { label: "Proxies salvas", count: workspace.proxies.length, Icon: ShieldCheck },
            { label: "Sessões abertas", count: sessions.length, Icon: Layers3 },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <item.Icon className="size-5 shrink-0 text-primary" />
              <div>
                <p className="text-2xl font-bold">{account && loaded ? item.count : "—"}</p>
                <p className="text-xs leading-5 text-muted-foreground">{item.label}</p>
              </div>
            </div>
          ))}
        </section>
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3 sm:p-4">
            <div
              className="flex gap-1 overflow-x-auto"
              role="tablist"
              aria-label="Áreas do Hot Profiles"
            >
              {(
                [
                  { value: "profiles", label: "Perfis" },
                  { value: "proxies", label: "Proxies" },
                  { value: "sessions", label: "Sessões" },
                ] as const
              ).map((item) => (
                <button
                  key={item.value}
                  role="tab"
                  aria-selected={tab === item.value}
                  className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${tab === item.value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"}`}
                  onClick={() => {
                    setTab(item.value);
                    setSearch("");
                  }}
                >
                  {item.label}
                  {item.value === "sessions" && sessions.length > 0 && (
                    <span className="ml-2 rounded-md bg-primary/15 px-1.5 py-0.5 text-xs">
                      {sessions.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              disabled={!!busy || !account}
              className={hotButton}
              onClick={() => void act("refresh", () => refresh(true))}
            >
              <RefreshCw className={`size-4 ${busy === "refresh" ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
          {tab !== "sessions" && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <label className="relative w-full sm:max-w-xs">
                <span className="sr-only">Buscar {tab === "profiles" ? "perfis" : "proxies"}</span>
                <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <input
                  className={`${hotInput} pl-9`}
                  placeholder={
                    tab === "profiles"
                      ? "Buscar nome, tag ou descrição…"
                      : "Buscar proxy ou endereço…"
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              {tab === "profiles" ? (
                <div className="flex gap-1">
                  {(
                    [
                      { value: "all", label: "Todos" },
                      { value: "browser", label: "Navegadores" },
                      { value: "android", label: "Android" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setKind(item.value)}
                      aria-pressed={kind === item.value}
                      className={`min-h-10 rounded-lg px-3 text-xs font-semibold ${kind === item.value ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : (
                <button onClick={() => setProxyForm({})} className={hotPrimary}>
                  <Plus className="size-4" />
                  Adicionar proxy
                </button>
              )}
            </div>
          )}
          {account && !loaded ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
              {error ? (
                <span>Dados indisponíveis. Confira a configuração da nuvem.</span>
              ) : (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Carregando seus dados…
                </>
              )}
            </div>
          ) : tab === "profiles" ? (
            profiles.length ? (
              <div className="divide-y divide-border">
                {profiles.map((profile) => {
                  const session = workspace.sessions.find(
                      (s) => s.profile_id === profile.id && cloudActive(s),
                    ),
                    proxy = workspace.proxies.find((p) => p.id === profile.proxy_id);
                  const Icon = profile.kind === "browser" ? Globe2 : Smartphone,
                    blocked =
                      (profile.kind === "android" && !!proxy) || proxy?.protocol === "socks5";
                  return (
                    <article
                      key={profile.id}
                      className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                          <Icon className="size-5 text-primary" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="break-words font-bold">{profile.name}</h3>
                          <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                            {profile.kind === "browser"
                              ? "Navegador · dados separados"
                              : "Android web · temporário"}{" "}
                            · {proxy ? proxy.name : "Sem proxy"}
                          </p>
                          {profile.notes && (
                            <p className="mt-1 line-clamp-2 max-w-xl whitespace-pre-line break-words text-sm text-muted-foreground">
                              {profile.notes}
                            </p>
                          )}
                          {profile.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {profile.tags.map((tag, index) => (
                                <span
                                  key={`${tag}-${index}`}
                                  className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <span
                            className={`mt-2 inline-flex items-center gap-1.5 text-xs ${session?.status === "running" ? "text-success" : "text-muted-foreground"}`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${session?.status === "running" ? "bg-success" : "bg-muted-foreground"}`}
                            />
                            {blocked && !session
                              ? "Proxy não compatível com este ambiente"
                              : cloudLabel(session)}
                          </span>
                        </div>
                      </div>
                      <div className="flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto">
                        <button
                          disabled={!!busy || !!session}
                          className={iconButton}
                          aria-label={`Editar ${profile.name}`}
                          onClick={() => setProfileForm({ profile, initialKind: profile.kind })}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          disabled={!!busy}
                          className={iconButton}
                          aria-label={`Duplicar configuração de ${profile.name}`}
                          onClick={() =>
                            void act(
                              "duplicate",
                              () =>
                                call({
                                  action: "save-profile",
                                  profile: {
                                    kind: profile.kind,
                                    name: `${profile.name.slice(0, 70)} · cópia`,
                                    tags: profile.tags,
                                    notes: profile.notes,
                                    proxy_id: profile.proxy_id,
                                    viewport: profile.viewport,
                                  },
                                }),
                              "Configuração duplicada. O novo perfil começa sem contas ou dados de navegação.",
                            )
                          }
                        >
                          <Copy className="size-4" />
                        </button>
                        <button
                          disabled={!!busy || !!session}
                          className={iconButton}
                          aria-label={`Excluir ${profile.name}`}
                          onClick={() =>
                            setRemove({ kind: "profile", id: profile.id, name: profile.name })
                          }
                        >
                          <Trash2 className="size-4" />
                        </button>
                        {session && (
                          <button
                            disabled={!!busy}
                            className={iconButton}
                            aria-label={`Encerrar ${profile.name}`}
                            onClick={() =>
                              void act(
                                "stop",
                                () => call({ action: "stop", id: session.id }),
                                "Encerramento solicitado. O estado será confirmado pelo provedor.",
                              )
                            }
                          >
                            <Square className="size-4" />
                          </button>
                        )}
                        <button
                          disabled={!!busy || (!session && blocked)}
                          className={hotPrimary}
                          onClick={() => void act("start", () => start(profile))}
                        >
                          {busy === "start" ? (
                            <LoaderCircle className="size-4 animate-spin" />
                          ) : (
                            <Play className="size-4" />
                          )}
                          {session ? "Abrir sessão" : "Iniciar"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <Empty
                Icon={MonitorSmartphone}
                title={search ? "Nenhum perfil encontrado" : "Seu próximo projeto começa aqui"}
                detail={
                  search
                    ? "Tente outro nome ou tag."
                    : "Crie um navegador ou celular na nuvem e organize cada projeto em um perfil."
                }
                action={
                  !search ? (
                    <button
                      className={hotPrimary}
                      onClick={() => setProfileForm({ initialKind: "browser" })}
                    >
                      <Plus className="size-4" />
                      Criar primeiro perfil
                    </button>
                  ) : undefined
                }
              />
            )
          ) : tab === "proxies" ? (
            proxies.length ? (
              <div className="grid gap-4 p-4 lg:grid-cols-2">
                {proxies.map((proxy) => (
                  <article key={proxy.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="break-words font-bold">{proxy.name}</h3>
                        <p className="mt-1 break-all font-mono text-xs leading-5 text-muted-foreground">
                          {proxy.protocol.toUpperCase()} · {proxy.host}:{proxy.port}
                        </p>
                      </div>
                      <ShieldCheck className="size-5 shrink-0 text-primary" />
                    </div>
                    <p className="mt-3 break-all text-xs leading-6 text-muted-foreground">
                      {proxy.username ? `Usuário: ${proxy.username}` : "Sem usuário"} ·{" "}
                      {proxy.hasPassword ? "Senha protegida" : "Sem senha"}
                    </p>
                    <p className="text-xs leading-6 text-muted-foreground">
                      {workspace.profiles.filter((p) => p.proxy_id === proxy.id).length} perfil(is)
                      vinculado(s) ·{" "}
                      {proxy.protocol === "socks5"
                        ? "Não compatível com Browserbase"
                        : "Conexão verificada ao iniciar o navegador"}
                    </p>
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        disabled={!!busy}
                        className={hotButton}
                        onClick={() => setProxyForm({ proxy })}
                      >
                        <Pencil className="size-4" />
                        Editar
                      </button>
                      <button
                        disabled={!!busy}
                        className={iconButton}
                        aria-label={`Excluir proxy ${proxy.name}`}
                        onClick={() => setRemove({ kind: "proxy", id: proxy.id, name: proxy.name })}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                Icon={ShieldCheck}
                title={search ? "Nenhuma proxy encontrada" : "Suas conexões, organizadas"}
                detail="Adicione host, porta e credenciais. Depois escolha a proxy no perfil de navegador."
                action={
                  <button className={hotPrimary} onClick={() => setProxyForm({})}>
                    <Plus className="size-4" />
                    Adicionar proxy
                  </button>
                }
              />
            )
          ) : sessions.length ? (
            <div className="space-y-4 p-3 sm:p-4">
              <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Ambientes abertos">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    className={`min-h-11 shrink-0 rounded-xl border px-4 text-sm font-semibold ${selectedId === session.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                    onClick={() => setSelected(session.id)}
                  >
                    {workspace.profiles.find((p) => p.id === session.profile_id)?.name ??
                      "Ambiente"}
                    <span className="ml-2 text-xs font-normal">{cloudLabel(session)}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs leading-6 text-muted-foreground">
                  Cada sessão tem limite de 30 minutos. Fechar a página não encerra o ambiente.
                </p>
                <button
                  disabled={!!busy}
                  className={hotButton}
                  onClick={() =>
                    selectedId &&
                    void act(
                      "stop",
                      () => call({ action: "stop", id: selectedId }),
                      "Encerramento solicitado ao provedor.",
                    )
                  }
                >
                  <Square className="size-4" />
                  Encerrar ambiente
                </button>
              </div>
              {selectedSession?.error && (
                <p
                  role="alert"
                  className="rounded-xl border border-destructive/20 p-3 text-sm text-destructive"
                >
                  {selectedSession.error}
                </p>
              )}
              {selectedStatus === "running" && viewer?.id === selectedId ? (
                <CloudSessionView
                  viewer={viewer.value}
                  name={selectedProfile?.name ?? "Ambiente"}
                  onRefresh={loadViewer}
                  onNavigate={async (url) => {
                    if (selectedId) {
                      await call({ action: "navigate", id: selectedId, url });
                      await loadViewer();
                    }
                  }}
                />
              ) : (
                <Empty
                  Icon={selectedSession?.kind === "android" ? Smartphone : Globe2}
                  title={viewerBusy ? "Conectando à tela…" : cloudLabel(selectedSession)}
                  detail={
                    viewerError ||
                    "Aguardando a confirmação do provedor. O painel atualiza automaticamente; você também pode atualizar agora."
                  }
                  action={
                    <button
                      className={hotButton}
                      disabled={viewerBusy || !!busy}
                      onClick={() =>
                        void act("sync", async () => {
                          if (selectedId) await call({ action: "sync", id: selectedId });
                          await refresh();
                          await loadViewer();
                        })
                      }
                    >
                      <RefreshCw className="size-4" />
                      Atualizar sessão
                    </button>
                  }
                />
              )}
            </div>
          ) : (
            <Empty
              Icon={Layers3}
              title="Seus ambientes aparecem aqui"
              detail="Inicie um perfil para abrir a tela do navegador ou Android em uma aba deste painel."
              action={
                <button className={hotButton} onClick={() => setTab("profiles")}>
                  Ver meus perfis
                  <ArrowRight className="size-4" />
                </button>
              }
            />
          )}
        </section>
        <footer className="flex items-start gap-2 text-xs leading-6 text-muted-foreground">
          <ShieldCheck className="mt-1 size-4 shrink-0" />
          <p>
            As senhas das proxies ficam protegidas no servidor. Dados locais anteriores continuam no
            computador de origem e não são enviados automaticamente para a nuvem.
          </p>
        </footer>
        {authDialog && <CloudAuth onClose={() => setAuthDialog(false)} />}
        {settings && <CloudConfiguration setup={setup} onClose={() => setSettings(false)} />}
        {profileForm && (
          <CloudProfileForm
            {...profileForm}
            proxies={workspace.proxies}
            onClose={() => setProfileForm(null)}
            onSave={async (profile, id) => {
              requireAccount();
              await call({ action: "save-profile", profile, id });
              setProfileForm(null);
              await refresh();
              setMessage("Perfil salvo na sua conta.");
            }}
          />
        )}
        {proxyForm && (
          <ProxyForm
            {...proxyForm}
            storage="cloud"
            onClose={() => setProxyForm(null)}
            onSave={async (input, id) => {
              requireAccount();
              const parsed = cloudProxySchema.safeParse(input);
              if (!parsed.success)
                throw new Error(
                  "Confira host, porta e credenciais. Use apenas o host ou IPv4, sem protocolo no campo de host.",
                );
              await call({ action: "save-proxy", proxy: parsed.data, id });
              setProxyForm(null);
              await refresh();
              setMessage("Proxy salva na sua conta. Vincule-a a um perfil de navegador.");
            }}
          />
        )}
        {remove && (
          <HotDialog
            title={`Excluir ${remove.kind === "profile" ? "perfil" : "proxy"}`}
            description={remove.name}
            busy={!!busy}
            onClose={() => {
              setRemove(null);
              setError("");
            }}
          >
            <p className="text-sm leading-6 text-muted-foreground">
              {remove.kind === "profile"
                ? "Esta ação remove o cadastro e o histórico de sessões do painel. O ambiente deve estar encerrado. O contexto do navegador permanece no provedor; sua exclusão definitiva deve ser feita no painel do provedor."
                : "A proxy será removida da sua conta. Desvincule-a dos perfis antes de excluir."}
            </p>
            {error && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                disabled={!!busy}
                className={hotButton}
                onClick={() => {
                  setRemove(null);
                  setError("");
                }}
              >
                Cancelar
              </button>
              <button
                disabled={!!busy}
                className={`${hotButton} text-destructive`}
                onClick={() =>
                  void act(
                    "delete",
                    async () => {
                      await call({
                        action: remove.kind === "profile" ? "delete-profile" : "delete-proxy",
                        id: remove.id,
                      });
                      setRemove(null);
                    },
                    "Cadastro removido.",
                  )
                }
              >
                {busy && <LoaderCircle className="size-4 animate-spin" />}Excluir cadastro
              </button>
            </div>
          </HotDialog>
        )}
        {androidStart && (
          <HotDialog
            title="Iniciar Android temporário"
            description={androidStart.name}
            onClose={() => {
              setAndroidStart(null);
              setError("");
            }}
            busy={!!busy}
          >
            <div className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                Um Android real será iniciado na Genymotion. Nesta primeira integração, seus
                aplicativos, arquivos e contas serão apagados ao encerrar ou atingir o limite de 30
                minutos.
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                O provedor pode cobrar pelo tempo de execução. Se você precisa manter contas de
                forma permanente, aguarde a integração de armazenamento persistente.
              </p>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  className={hotButton}
                  disabled={!!busy}
                  onClick={() => setAndroidStart(null)}
                >
                  Cancelar
                </button>
                <button
                  className={hotPrimary}
                  disabled={!!busy}
                  onClick={() => void act("start", () => start(androidStart, true))}
                >
                  {busy ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  Iniciar temporário
                </button>
              </div>
            </div>
          </HotDialog>
        )}
      </main>
    </AppShell>
  );
}
function Empty({
  Icon,
  title,
  detail,
  action,
}: {
  Icon: typeof Cloud;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-5 py-14 text-center">
      <span className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-secondary">
        <Icon className="size-7 text-primary" />
      </span>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mb-5 mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{detail}</p>
      {action}
    </div>
  );
}
