export type ProfileKind = "browser" | "android";
export type AndroidSettings = {
  ramMb: number;
  cpuCores: number;
  resolution: string;
  graphics: "auto" | "host" | "software";
  memoryMode: "normal" | "low";
  fps: 15 | 30 | 60;
  animations: boolean;
  imageId: string;
};
export const DEFAULT_ANDROID_SETTINGS: AndroidSettings = {
  ramMb: 2048,
  cpuCores: 2,
  resolution: "540x960",
  graphics: "auto",
  memoryMode: "normal",
  fps: 30,
  animations: false,
  imageId: "",
};
export type HotProfile = {
  id: string;
  kind: ProfileKind;
  name: string;
  tags: string[];
  notes: string;
  proxyId: string | null;
  startUrls: string[];
  deviceId: string;
  hostAddress: string;
  viewport: { width: number; height: number };
  createdAt: string;
  updatedAt: string;
  androidBinding?: { deviceId: string; endpoint: string; verifiedAt: string };
  androidSettings?: AndroidSettings;
};
export type HotProxy = {
  id: string;
  name: string;
  protocol: "http" | "https" | "socks5";
  host: string;
  port: number;
  username: string;
  hasPassword: boolean;
};
export type HotSession = {
  profileId: string;
  kind: ProfileKind;
  name: string;
  status: "starting" | "running" | "stopping" | "stopped" | "error";
  startedAt: string;
  error: string | null;
  needsCleanup?: boolean;
  androidBinding?: { deviceId: string; endpoint: string; verifiedAt: string } | null;
  runtimeInfo?: {
    requestedRamMb: number;
    effectiveRamMb: number;
    cpuCores: number;
    resolution: string;
    graphics: string;
    memoryMode: string;
    targetFps: number;
    imageId: string;
  } | null;
};
export type HotNetwork = {
  checkedAt: string;
  endpoint: string;
  mode: "system-http" | "unmanaged" | "restricted-http";
  systemProxyMatches: boolean | null;
  deviceWideVerified: false;
  egressIp: null;
  dnsVerified: false;
  failClosed: false;
  message: string;
};
export type HotDevice = {
  id: string;
  name: string;
  provider: "bluestacks" | "adb";
  ready: boolean;
  adbEnabled: boolean;
  endpoint?: string | null;
  candidateEndpoints?: string[];
  warnings?: string[];
};
export type HotPerformance = {
  totalGB: number;
  freeGB: number;
  cores: number;
  maxSessions: number;
  suggested: number;
  platform: string;
};
export type HotDevices = {
  runtime?: {
    available: boolean;
    message: string;
    api?: string;
    images?: { id: string; api: string; description: string; minRamMb: number }[];
  };
  performance?: HotPerformance;
  devices: HotDevice[];
  adbAvailable: boolean;
  adbResponding?: boolean;
  configReadable?: boolean;
  adbRemoteEnabled?: boolean;
  managerAvailable: boolean;
  browserAvailable: boolean;
  computer: string;
};
export type HotWorkspace = {
  performance?: HotPerformance;
  profiles: HotProfile[];
  proxies: HotProxy[];
  sessions: HotSession[];
  activities: { id: string; action: string; name: string; at: string }[];
};
export type HotFrame = {
  image: string | null;
  width: number;
  height: number;
  tabs: { id: string; title: string; url: string; active: boolean }[];
  dialog: { type: string; message: string } | null;
};
export type HotConnection = { url: string; token: string; computer: string };
export const HOT_CONNECTION_KEY = "00duhot:hot-profiles:connection:v1";
export const EMPTY_WORKSPACE: HotWorkspace = {
  profiles: [],
  proxies: [],
  sessions: [],
  activities: [],
};

export function connectorUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Use o endereço local do conector, como http://127.0.0.1:47900.");
  }
  return url.origin;
}

export async function bridgeRequest<T>(
  connection: HotConnection,
  route: string,
  input?: unknown,
  method = "POST",
  signal?: AbortSignal,
): Promise<T> {
  const url = connectorUrl(connection.url);
  let response: Response;
  try {
    response = await fetch(`${url}${route}`, {
      method: input === undefined ? "GET" : method,
      headers: {
        Authorization: `Bearer ${connection.token}`,
        ...(input === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: input === undefined ? undefined : JSON.stringify(input),
      signal: signal ?? AbortSignal.timeout(20000),
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      "Não consegui acessar o conector. Confira se ele está aberto e permita o acesso à rede local se o navegador solicitar.",
    );
  }
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(data.error || "O computador não conseguiu concluir a ação."), {
      status: response.status,
    });
  return data as T;
}

export async function pairComputer(url: string, code: string): Promise<HotConnection> {
  const address = connectorUrl(url);
  if (!/^\d{6}$/.test(code)) throw new Error("Digite os seis números mostrados no conector.");
  let response: Response;
  try {
    response = await fetch(`${address}/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(7000),
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
  } catch {
    throw new Error(
      "Conector não encontrado. Abra o conector e permita o acesso à rede local se o navegador solicitar.",
    );
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Não foi possível conectar.");
  return { url: address, token: result.token, computer: result.computer };
}

export const sessionActive = (session?: HotSession) =>
  !!session &&
  (["starting", "running", "stopping"].includes(session.status) || !!session.needsCleanup);
export const sessionLabel = (session?: HotSession) =>
  ({
    starting: "Iniciando",
    running: "Em execução",
    stopping: "Encerrando",
    stopped: "Pronto para abrir",
    error: "Precisa de atenção",
  })[session?.status ?? "stopped"];
