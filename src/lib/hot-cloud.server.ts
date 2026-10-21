import { z } from "zod";
import type {
  CloudCommand,
  CloudProfile,
  CloudSession,
  CloudSetup,
  CloudViewer,
  CloudWorkspace,
} from "./hot-cloud";
import type { HotProxy } from "./hot-profiles";

export class CloudError extends Error {}
class ProviderError extends CloudError {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
type ProfileRow = CloudProfile & { user_id: string; context_id: string | null };
type ProxyRow = {
  id: string;
  user_id: string;
  name: string;
  protocol: HotProxy["protocol"];
  host: string;
  port: number;
  username: string;
  password_ciphertext: string | null;
  updated_at: string;
};
type SessionRow = CloudSession & {
  user_id: string;
  provider_id: string | null;
  updated_at: string;
};
const env = (name: string) => process.env[name]?.trim() ?? "";
export function cloudSetup(): CloudSetup {
  return {
    access: !!env("HOT_PROFILES_ALLOWED_USER_IDS"),
    auth: !!env("SUPABASE_URL") && !!env("SUPABASE_PUBLISHABLE_KEY"),
    storage: !!env("SUPABASE_URL") && !!env("SUPABASE_SERVICE_ROLE_KEY"),
    encryption: /^[a-f0-9]{64}$/i.test(env("HOT_PROFILES_ENCRYPTION_KEY")),
    browser: !!env("BROWSERBASE_API_KEY") && !!env("BROWSERBASE_PROJECT_ID"),
    android:
      !!env("GENYMOTION_API_TOKEN") &&
      z.string().uuid().safeParse(env("GENYMOTION_RECIPE_ID")).success,
  };
}
function required(name: string) {
  const value = env(name);
  if (!value)
    throw new CloudError("O serviço de nuvem ainda precisa ser configurado pelo administrador.");
  return value;
}
async function database<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const key = required("SUPABASE_SERVICE_ROLE_KEY");
  let response: Response;
  try {
    response = await fetch(`${required("SUPABASE_URL")}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: key,
        ...(key.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${key}` }),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
  } catch {
    throw new CloudError("Não consegui acessar os dados na nuvem. Tente novamente.");
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
    const messages: Record<string, string> = {
      HOT_NOT_FOUND: "Este cadastro não foi encontrado na sua conta.",
      HOT_BUSY: "Encerre a sessão antes de alterar este cadastro.",
      HOT_LIMIT: "Encerre um ambiente: o limite é de quatro sessões simultâneas por conta.",
      HOT_RATE: "Limite de inicializações atingido. Aguarde antes de abrir novos ambientes.",
      HOT_PROXY_IN_USE: "Remova esta proxy dos perfis antes de excluí-la.",
      HOT_KIND: "O tipo de um perfil existente não pode ser alterado.",
    };
    for (const [code, message] of Object.entries(messages))
      if (error.message?.includes(code)) throw new CloudError(message);
    if (error.message?.includes("HOT_STALE"))
      throw new CloudError("Este perfil ou sua proxy mudou. Atualize o painel antes de iniciar.");
    if (["42P01", "PGRST202", "PGRST205"].includes(error.code ?? ""))
      throw new CloudError(
        "Falta preparar as tabelas do Hot Profiles no banco de dados. Consulte a configuração da nuvem.",
      );
    throw new CloudError(
      "Não foi possível salvar ou consultar os dados. Atualize o painel antes de tentar novamente.",
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
async function mutate<T>(owner: string, action: string, id?: string, data?: unknown) {
  return database<T>("rpc/hot_cloud_mutate", "POST", {
    p_owner: owner,
    p_action: action,
    p_id: id ?? null,
    p_data: data ?? {},
  });
}
async function owned<T>(table: string, owner: string, id: string): Promise<T> {
  const rows = await database<T[]>(`${table}?user_id=eq.${owner}&id=eq.${id}&limit=1`);
  if (!rows[0]) throw new CloudError("Este cadastro não foi encontrado na sua conta.");
  return rows[0];
}
function sessionPatch(
  owner: string,
  id: string,
  data: Partial<SessionRow>,
  expectedStatus?: CloudSession["status"],
) {
  return database<SessionRow[]>(
    `hot_cloud_sessions?user_id=eq.${owner}&id=eq.${id}&status=${expectedStatus ? `eq.${expectedStatus}` : "neq.stopped"}`,
    "PATCH",
    { ...data, updated_at: new Date().toISOString() },
  );
}
function publicProfile(row: ProfileRow): CloudProfile {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    tags: row.tags,
    notes: row.notes,
    proxy_id: row.proxy_id,
    viewport: row.viewport,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
function publicProxy(row: ProxyRow): HotProxy {
  return {
    id: row.id,
    name: row.name,
    protocol: row.protocol,
    host: row.host,
    port: row.port,
    username: row.username,
    hasPassword: !!row.password_ciphertext,
  };
}
function publicSession(row: SessionRow): CloudSession {
  return {
    id: row.id,
    profile_id: row.profile_id,
    kind: row.kind,
    status: row.status,
    created_at: row.created_at,
    error: row.error,
  };
}
async function workspace(owner: string): Promise<CloudWorkspace> {
  const [profiles, proxies, sessions] = await Promise.all([
    database<ProfileRow[]>(
      `hot_cloud_profiles?user_id=eq.${owner}&order=created_at.desc&limit=500`,
    ),
    database<ProxyRow[]>(`hot_cloud_proxies?user_id=eq.${owner}&order=created_at.desc&limit=500`),
    database<SessionRow[]>(
      `hot_cloud_sessions?user_id=eq.${owner}&status=neq.stopped&order=created_at.desc&limit=20`,
    ),
  ]);
  return {
    profiles: profiles.map(publicProfile),
    proxies: proxies.map(publicProxy),
    sessions: sessions.map(publicSession),
  };
}
async function secretKey() {
  const value = required("HOT_PROFILES_ENCRYPTION_KEY");
  if (!/^[a-f0-9]{64}$/i.test(value))
    throw new CloudError("A proteção das senhas ainda precisa ser configurada.");
  const bytes = Uint8Array.from(value.match(/.{2}/g)!, (pair) => parseInt(pair, 16));
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const encode = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (x) => String.fromCharCode(x)).join(""));
const decode = (text: string) => Uint8Array.from(atob(text), (x) => x.charCodeAt(0));
async function encrypt(owner: string, id: string, password: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(`${owner}:${id}`) },
    await secretKey(),
    new TextEncoder().encode(password),
  );
  return `v1.${encode(iv)}.${encode(new Uint8Array(ciphertext))}`;
}
async function decrypt(row: ProxyRow) {
  if (!row.password_ciphertext) return "";
  const [version, iv, value] = row.password_ciphertext.split(".");
  if (version !== "v1" || !iv || !value)
    throw new CloudError("Não foi possível abrir a senha desta proxy.");
  try {
    return new TextDecoder().decode(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: decode(iv),
          additionalData: new TextEncoder().encode(`${row.user_id}:${row.id}`),
        },
        await secretKey(),
        decode(value),
      ),
    );
  } catch {
    throw new CloudError(
      "Não foi possível abrir a senha desta proxy. Confira a chave do servidor.",
    );
  }
}
async function provider<T>(
  kind: "browser" | "android",
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const browser = kind === "browser";
  let response: Response;
  try {
    response = await fetch(
      `${browser ? "https://api.browserbase.com/v1" : "https://api.geny.io/cloud"}${path}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          [browser ? "X-BB-API-Key" : "x-api-token"]: required(
            browser ? "BROWSERBASE_API_KEY" : "GENYMOTION_API_TOKEN",
          ),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(18000),
      },
    );
  } catch (reason) {
    if (reason instanceof CloudError) throw reason;
    throw new CloudError(
      "A nuvem não confirmou a operação. Atualize a sessão antes de tentar novamente.",
    );
  }
  if (!response.ok) {
    const message =
      response.status === 401 || response.status === 403
        ? "A nuvem recusou o acesso. Confira as credenciais, o plano e as permissões do provedor."
        : response.status === 429
          ? "O provedor atingiu seu limite de uso. Aguarde antes de tentar novamente."
          : "O provedor não concluiu a operação. Confira a configuração e a disponibilidade no painel do provedor.";
    // Never return vendor response bodies: they may echo proxy credentials.
    throw new ProviderError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
type BrowserSession = {
  id: string;
  status: string;
  connectUrl?: string;
  userMetadata?: { hotSessionId?: string };
};
type AndroidInstance = { uuid: string; name: string; state: string; webrtc_url?: string };
function androidState(instance: AndroidInstance): CloudSession["status"] {
  if (["ONLINE", "READY"].includes(instance.state)) return "running";
  if (["STOPPING", "SAVING", "DELETING"].includes(instance.state)) return "stopping";
  if (["OFFLINE", "STOPPED", "DELETED", "ERROR"].includes(instance.state)) return "stopped";
  return "starting";
}
async function resolveProviderId(session: SessionRow) {
  if (session.provider_id) return session.provider_id;
  // If a create timed out, recover by the immutable request identifier instead of creating again.
  if (Date.now() - Date.parse(session.created_at) < 60000)
    throw new CloudError("Aguarde um minuto para a nuvem confirmar a criação e atualize a sessão.");
  if (session.kind === "browser") {
    const rows = await provider<BrowserSession[]>("browser", `/sessions`);
    const matches = rows.filter((row) => row.userMetadata?.hotSessionId === session.id);
    if (matches.length > 1)
      throw new CloudError(
        "Há mais de uma sessão remota para esta solicitação. Confira o painel do provedor.",
      );
    if (!matches[0])
      throw new CloudError(
        "A criação não foi localizada no provedor. Confira o painel Browserbase antes de liberar este perfil com o administrador.",
      );
    return matches[0].id;
  }
  let page = 1;
  while (page <= 20) {
    const result = await provider<{ results: AndroidInstance[]; next: string | null }>(
      "android",
      `/v2/instances?page=${page}&page_size=100`,
    );
    const match = result.results.find((row) => row.name === `hot-${session.id}`);
    if (match) return match.uuid;
    if (!result.next)
      throw new CloudError(
        "A criação não foi localizada no provedor. Confira o painel Genymotion antes de liberar este perfil com o administrador.",
      );
    page++;
  }
  throw new CloudError(
    "Não foi possível conferir todas as instâncias. Confira o painel do provedor.",
  );
}
async function sync(owner: string, id: string): Promise<CloudSession> {
  const session = await owned<SessionRow>("hot_cloud_sessions", owner, id);
  if (session.status === "stopped") return publicSession(session);
  const remote = await resolveProviderId(session);
  if (!remote) {
    await sessionPatch(owner, id, { status: "stopped", error: null });
    return { ...publicSession(session), status: "stopped", error: null };
  }
  let status: CloudSession["status"];
  try {
    if (session.kind === "browser") {
      const value = await provider<BrowserSession>(
        "browser",
        `/sessions/${encodeURIComponent(remote)}`,
      );
      status =
        value.status === "RUNNING"
          ? "running"
          : value.status === "PENDING"
            ? "starting"
            : ["COMPLETED", "ERROR", "TIMED_OUT"].includes(value.status)
              ? "stopped"
              : "attention";
    } else
      status = androidState(
        await provider<AndroidInstance>("android", `/v1/instances/${encodeURIComponent(remote)}`),
      );
  } catch (reason) {
    if (reason instanceof ProviderError && reason.status === 404) status = "stopped";
    else throw reason;
  }
  // Never undo a pending stop when the provider still reports RUNNING.
  if (session.status === "stopping" && status === "running") status = "stopping";
  const updated = await sessionPatch(
    owner,
    id,
    { provider_id: remote, status, error: null },
    session.status,
  );
  return publicSession(updated[0] ?? (await owned<SessionRow>("hot_cloud_sessions", owner, id)));
}
async function start(owner: string, id: string, acceptEphemeralAndroid: boolean) {
  const profile = await owned<ProfileRow>("hot_cloud_profiles", owner, id);
  const setup = cloudSetup();
  if (!setup[profile.kind === "browser" ? "browser" : "android"])
    throw new CloudError("Este tipo de ambiente ainda precisa ser conectado ao provedor de nuvem.");
  if (profile.kind === "android" && profile.proxy_id)
    throw new CloudError(
      "Android com proxy ainda requer um serviço de rede dedicado. A sessão foi bloqueada para não usar a rede padrão no lugar da proxy escolhida.",
    );
  if (profile.kind === "android" && !acceptEphemeralAndroid)
    throw new CloudError(
      "Confirme que este Android é temporário: aplicativos e contas não são preservados ao encerrar.",
    );
  const proxy = profile.proxy_id
    ? await owned<ProxyRow>("hot_cloud_proxies", owner, profile.proxy_id)
    : null;
  if (proxy?.protocol === "socks5")
    throw new CloudError(
      "O navegador na nuvem aceita proxies HTTP e HTTPS. Selecione uma dessas opções.",
    );
  // Decrypt before reserving to avoid an ambiguous session on an invalid encryption key.
  const password = proxy ? await decrypt(proxy) : "";
  const session = await mutate<SessionRow>(owner, "start", id, {
    expectedProfile: profile.updated_at,
    expectedProxy: proxy?.updated_at,
  });
  let remote: string | null = null;
  let requested = false;
  try {
    if (profile.kind === "browser") {
      let context = profile.context_id;
      if (!context) {
        context = (
          await provider<{ id: string }>("browser", "/contexts", "POST", {
            projectId: required("BROWSERBASE_PROJECT_ID"),
          })
        ).id;
        if (!context) throw new CloudError("A nuvem não retornou o identificador do perfil.");
        await database(`hot_cloud_profiles?user_id=eq.${owner}&id=eq.${id}`, "PATCH", {
          context_id: context,
        });
      }
      requested = true;
      const value = await provider<BrowserSession>("browser", "/sessions", "POST", {
        projectId: required("BROWSERBASE_PROJECT_ID"),
        timeout: 1800,
        keepAlive: true,
        browserSettings: {
          context: { id: context, persist: true },
          viewport: profile.viewport,
          recordSession: false,
          logSession: false,
          solveCaptchas: false,
        },
        proxies: proxy
          ? [
              {
                type: "external",
                server: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
                username: proxy.username || undefined,
                password: password || undefined,
              },
            ]
          : false,
        userMetadata: { hotSessionId: session.id },
      });
      remote = value.id;
    } else {
      requested = true;
      const value = await provider<AndroidInstance>(
        "android",
        `/v1/recipes/${required("GENYMOTION_RECIPE_ID")}/start-disposable`,
        "POST",
        {
          instance_name: `hot-${session.id}`,
          rename_on_conflict: false,
          timeouts: { global: 1800, inactivity: 600 },
        },
      );
      remote = value.uuid;
    }
    if (!remote) throw new CloudError("O provedor não confirmou o identificador da sessão.");
    await sessionPatch(owner, session.id, { provider_id: remote, status: "starting" });
    return publicSession({ ...session, provider_id: remote });
  } catch (reason) {
    const definitive =
      !requested ||
      (reason instanceof ProviderError && [400, 401, 403, 404, 422, 429].includes(reason.status));
    const message =
      reason instanceof CloudError ? reason.message : "A sessão precisa ser conferida no provedor.";
    await sessionPatch(owner, session.id, {
      provider_id: remote,
      status: definitive ? "stopped" : "attention",
      error: message,
    }).catch(() => {});
    throw new CloudError(message);
  }
}
async function stop(owner: string, id: string) {
  const session = await owned<SessionRow>("hot_cloud_sessions", owner, id);
  if (session.status === "stopped") return publicSession(session);
  const remote = await resolveProviderId(session);
  if (!remote) {
    await sessionPatch(owner, id, { status: "stopped", error: null });
    return;
  }
  await sessionPatch(owner, id, { status: "stopping", provider_id: remote, error: null });
  try {
    if (session.kind === "browser")
      await provider("browser", `/sessions/${encodeURIComponent(remote)}`, "POST", {
        projectId: required("BROWSERBASE_PROJECT_ID"),
        status: "REQUEST_RELEASE",
      });
    else
      await provider(
        "android",
        `/v1/instances/${encodeURIComponent(remote)}/stop-disposable`,
        "POST",
        {},
      );
  } catch (reason) {
    if (reason instanceof ProviderError && reason.status === 404) {
      await sessionPatch(owner, id, { status: "stopped" });
      return;
    }
    await sessionPatch(owner, id, {
      status: "attention",
      error: "O encerramento não foi confirmado. Atualize e tente encerrar novamente.",
    });
    throw reason;
  }
  // Provider acknowledgement is not proof of termination. sync confirms the final state.
  return sync(owner, id);
}
async function viewer(owner: string, id: string): Promise<CloudViewer> {
  const state = await sync(owner, id);
  if (state.status !== "running")
    throw new CloudError(
      "O ambiente ainda não está pronto. Atualize a sessão em alguns instantes.",
    );
  const session = await owned<SessionRow>("hot_cloud_sessions", owner, id);
  if (!session.provider_id) throw new CloudError("A nuvem ainda não confirmou esta sessão.");
  if (session.kind === "browser") {
    const result = await provider<{ debuggerFullscreenUrl: string }>(
      "browser",
      `/sessions/${encodeURIComponent(session.provider_id)}/debug`,
    );
    const url = new URL(result.debuggerFullscreenUrl);
    if (
      url.protocol !== "https:" ||
      !["www.browserbase.com", "browserbase.com"].includes(url.hostname)
    )
      throw new CloudError("O provedor retornou um endereço de visualização inválido.");
    return { kind: "browser", url: url.href };
  }
  const instance = await provider<AndroidInstance>(
    "android",
    `/v1/instances/${encodeURIComponent(session.provider_id)}`,
  );
  const address = new URL(instance.webrtc_url ?? "");
  if (
    address.protocol !== "wss:" ||
    !/(^|\.)geny\.io$|(^|\.)genymotion\.com$/i.test(address.hostname)
  )
    throw new CloudError("O provedor retornou um endereço de transmissão inválido.");
  const token = await provider<{ access_token: string }>(
    "android",
    "/v1/instances/access-token",
    "POST",
    { instance_uuid: session.provider_id },
  );
  if (!token.access_token) throw new CloudError("A nuvem não liberou a transmissão deste Android.");
  return { kind: "android", address: address.href, token: token.access_token };
}
async function navigate(owner: string, id: string, value: string) {
  const target = new URL(value);
  if (!["https:", "http:"].includes(target.protocol) || target.username || target.password)
    throw new CloudError("Use um endereço HTTP ou HTTPS sem credenciais.");
  const session = await owned<SessionRow>("hot_cloud_sessions", owner, id);
  if (session.kind !== "browser" || session.status !== "running" || !session.provider_id)
    throw new CloudError("Abra uma sessão de navegador para navegar.");
  const remote = await provider<BrowserSession>(
    "browser",
    `/sessions/${encodeURIComponent(session.provider_id)}`,
  );
  const address = new URL(remote.connectUrl ?? "");
  if (address.protocol !== "wss:" || !/(^|\.)browserbase\.com$/i.test(address.hostname))
    throw new CloudError("Conexão do navegador indisponível.");
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(address.href);
    let settled = false;
    const timer = setTimeout(
      () => finish(new CloudError("O navegador não confirmou a abertura da página.")),
      10000,
    );
    function finish(error?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        /* Connection may still be opening. */
      }
      if (error) reject(error);
      else resolve();
    }
    socket.onopen = () =>
      socket.send(
        JSON.stringify({ id: 1, method: "Target.createTarget", params: { url: target.href } }),
      );
    socket.onmessage = (event) => {
      const response = JSON.parse(String(event.data)) as {
        id?: number;
        result?: { targetId?: string };
        error?: unknown;
      };
      if (response.id === 1 && response.result?.targetId)
        socket.send(
          JSON.stringify({
            id: 2,
            method: "Target.activateTarget",
            params: { targetId: response.result.targetId },
          }),
        );
      else if (response.id === 2)
        finish(response.error ? new CloudError("A página não pôde ser aberta.") : undefined);
      else if (response.id === 1 && response.error)
        finish(new CloudError("A página não pôde ser aberta."));
    };
    socket.onerror = () => finish(new CloudError("A conexão de controle do navegador falhou."));
    socket.onclose = () => finish(new CloudError("A conexão de controle foi encerrada."));
  });
}
export async function executeCloudCommand(owner: string, command: CloudCommand): Promise<unknown> {
  if (!z.string().uuid().safeParse(owner).success)
    throw new CloudError("Entre na sua conta para continuar.");
  const allowed = env("HOT_PROFILES_ALLOWED_USER_IDS")
    .split(",")
    .map((value) => value.trim());
  if (!allowed.includes(owner))
    throw new CloudError(
      "Sua conta ainda não foi liberada para o Hot Profiles na nuvem. Solicite a liberação ao administrador.",
    );
  switch (command.action) {
    case "workspace":
      return workspace(owner);
    case "save-profile":
      return mutate(owner, "save-profile", command.id, command.profile);
    case "save-proxy": {
      await secretKey();
      // Allocate UUID first: encryption authenticates both record ID and owner.
      const id = command.id ?? crypto.randomUUID();
      if (command.id) await owned("hot_cloud_proxies", owner, id);
      const ciphertext = command.proxy.password
        ? await encrypt(owner, id, command.proxy.password)
        : null;
      if (!command.id) {
        // The transaction verifies that this new ID is absent (no overwrite).
        return mutate(owner, "create-proxy", id, {
          ...command.proxy,
          password: undefined,
          password_ciphertext: ciphertext,
        });
      }
      return mutate(owner, "save-proxy", id, {
        ...command.proxy,
        password: undefined,
        password_ciphertext: ciphertext,
      });
    }
    case "delete-profile":
      return mutate(owner, "delete-profile", command.id);
    case "delete-proxy":
      return mutate(owner, "delete-proxy", command.id);
    case "start":
      return start(owner, command.id, command.acceptEphemeralAndroid ?? false);
    case "stop":
      return stop(owner, command.id);
    case "sync":
      return sync(owner, command.id);
    case "viewer":
      return viewer(owner, command.id);
    case "navigate":
      return navigate(owner, command.id, command.url);
  }
}
