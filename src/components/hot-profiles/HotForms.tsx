import { parseProxyAddress } from "@/lib/proxy-input";
import { useState, type FormEvent } from "react";
import {
  Cable,
  Check,
  Download,
  Globe2,
  LoaderCircle,
  Monitor,
  Plus,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { HotDialog, hotButton, hotInput, hotPrimary } from "./HotDialog";
import {
  pairComputer,
  type HotConnection,
  type HotDevices,
  type HotProfile,
  type HotProxy,
  type ProfileKind,
} from "@/lib/hot-profiles";

function FormError({ error }: { error: string }) {
  return error ? (
    <p
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm leading-6 text-destructive"
    >
      {error}
    </p>
  ) : null;
}

export function ConnectComputer({
  onClose,
  onConnect,
}: {
  onClose: () => void;
  onConnect: (value: HotConnection) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [url, setUrl] = useState("http://127.0.0.1:47900");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function connect(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onConnect(await pairComputer(url, code));
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <HotDialog
      title="Conectar seu computador"
      description="Uma conexão local para executar seus navegadores e celulares de verdade."
      onClose={onClose}
      busy={busy}
    >
      <ol className="mb-6 space-y-4 text-sm">
        <li className="flex gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">
            1
          </span>
          <div>
            <p className="font-semibold">Baixe o conector do Hot Profiles</p>
            <p className="mt-1 leading-6 text-muted-foreground">
              Extraia o arquivo em uma pasta do seu computador. Requer Node.js 22 ou superior.
            </p>
            <a href="/hot-profiles-connector.zip" download className={`${hotButton} mt-2`}>
              <Download className="size-4" />
              Baixar conector Windows
            </a>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">
            2
          </span>
          <div>
            <p className="font-semibold">Abra “Iniciar Hot Profiles.cmd”</p>
            <p className="mt-1 leading-6 text-muted-foreground">
              Mantenha a janela aberta. Seus perfis e senhas ficam neste computador. O site não
              recebe os arquivos dos seus navegadores.
            </p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">
            3
          </span>
          <div>
            <p className="font-semibold">Digite o código mostrado na janela</p>
            <p className="mt-1 leading-6 text-muted-foreground">
              Se o navegador pedir acesso à rede local, permita para conectar a este computador.
            </p>
          </div>
        </li>
      </ol>
      <form onSubmit={connect} className="space-y-4">
        <label className="block space-y-2 text-sm font-semibold">
          <span>Código de conexão</span>
          <input
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            placeholder="000000"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            className={`${hotInput} font-mono text-xl tracking-widest`}
          />
        </label>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer py-1">Endereço do conector</summary>
          <label className="mt-2 block space-y-2">
            <span>Endereço local</span>
            <input
              type="url"
              required
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className={hotInput}
            />
          </label>
        </details>
        <FormError error={error} />
        <button disabled={busy || code.length !== 6} className={`${hotPrimary} w-full`}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Cable className="size-4" />}
          {busy ? "Conectando…" : "Conectar computador"}
        </button>
      </form>
    </HotDialog>
  );
}

export function ProfileForm({
  profile,
  initialKind,
  proxies,
  devices,
  profiles,
  onSave,
  onClose,
  onRefresh,
  onManager,
  onCreateProxy,
}: {
  profile?: HotProfile;
  initialKind: ProfileKind;
  proxies: HotProxy[];
  devices: HotDevices | null;
  profiles: HotProfile[];
  onSave: (input: unknown, id?: string) => Promise<void>;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onManager: () => Promise<void>;
  onCreateProxy?: (input: unknown) => Promise<HotProxy>;
}) {
  const [kind, setKind] = useState<ProfileKind>(profile?.kind ?? initialKind);
  const [name, setName] = useState(profile?.name ?? "");
  const [tags, setTags] = useState(profile?.tags.join(", ") ?? "");
  const [notes, setNotes] = useState(profile?.notes ?? "");
  const [proxyId, setProxyId] = useState(profile?.proxyId ?? "");
  const [addingProxy, setAddingProxy] = useState(false);
  const [urls, setUrls] = useState(profile?.startUrls.join("\n") ?? "");
  const [deviceId, setDeviceId] = useState(profile?.deviceId ?? "");
  const [hostAddress, setHostAddress] = useState(profile?.hostAddress ?? "127.0.0.1");
  const [resolution, setResolution] = useState(
    profile ? `${profile.viewport.width}x${profile.viewport.height}` : "1280x800",
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const [width, height] = resolution.split("x").map(Number);
    try {
      await onSave(
        {
          kind,
          name,
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          notes,
          proxyId: proxyId || null,
          startUrls: urls
            .split(/\r?\n/)
            .map((url) => url.trim())
            .filter(Boolean),
          deviceId,
          hostAddress,
          viewport: { width, height },
        },
        profile?.id,
      );
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function action(fn: () => Promise<void>) {
    setError("");
    try {
      await fn();
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  if (addingProxy && onCreateProxy)
    return (
      <HotDialog
        key="inline-proxy"
        title="Adicionar proxy ao perfil"
        description="O perfil em preenchimento será mantido."
        onClose={() => setAddingProxy(false)}
        busy={busy}
      >
        <ProxyForm
          inline
          onClose={() => setAddingProxy(false)}
          onSave={async (input) => {
            setBusy(true);
            try {
              const created = await onCreateProxy(input);
              setProxyId(created.id);
              setAddingProxy(false);
            } finally {
              setBusy(false);
            }
          }}
        />
      </HotDialog>
    );
  return (
    <HotDialog
      key="profile"
      title={profile ? "Editar perfil" : "Novo perfil"}
      description="Organize um ambiente independente para cada projeto."
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={save} className="space-y-5">
        <fieldset disabled={!!profile || busy} className="grid grid-cols-2 gap-3">
          <legend className="mb-2 text-sm font-semibold">Tipo de ambiente</legend>
          {(
            [
              {
                value: "browser",
                label: "Navegador",
                detail: "Cookies e dados separados",
                Icon: Monitor,
              },
              {
                value: "android",
                label: "Celular Android",
                detail: "Uma instância de Android real",
                Icon: Smartphone,
              },
            ] as const
          ).map((item) => (
            <label
              key={item.value}
              className={`cursor-pointer rounded-xl border p-3 transition focus-within:ring-2 focus-within:ring-ring ${kind === item.value ? "border-primary bg-primary/10" : "border-border bg-background"}`}
            >
              <input
                type="radio"
                name="profile-kind"
                value={item.value}
                checked={kind === item.value}
                onChange={() => setKind(item.value)}
                className="sr-only"
              />
              <span className="flex items-center gap-2 text-sm font-bold">
                <item.Icon className="size-5 text-primary" />
                {item.label}
                {kind === item.value && <Check className="ml-auto size-4 text-primary" />}
              </span>
              <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                {item.detail}
              </span>
            </label>
          ))}
        </fieldset>
        <label className="block space-y-2 text-sm font-semibold">
          <span>Nome do perfil</span>
          <input
            required
            maxLength={80}
            placeholder={
              kind === "browser"
                ? "Ex.: Projeto principal · Navegador"
                : "Ex.: Projeto principal · Android"
            }
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={hotInput}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-semibold">
            <span>Proxy</span>
            <select
              value={proxyId}
              onChange={(event) => setProxyId(event.target.value)}
              className={hotInput}
            >
              <option value="">Sem proxy · rede padrão do ambiente</option>
              {proxies.map((proxy) => {
                const owner = profiles.find(
                  (item) => item.id !== profile?.id && item.proxyId === proxy.id,
                );
                return (
                  <option
                    key={proxy.id}
                    value={proxy.id}
                    disabled={!!owner && proxyId !== proxy.id}
                  >
                    {proxy.name} · {owner ? `vinculado a ${owner.name}` : "disponível"}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="block space-y-2 text-sm font-semibold">
            <span>
              Tags <span className="font-normal text-muted-foreground">(opcional)</span>
            </span>
            <input
              maxLength={250}
              placeholder="Tráfego, Cliente A"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              className={hotInput}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>
            {proxyId
              ? "Uma conexão cadastrada por perfil. IPs distintos dependem do seu provedor."
              : "Sem proxy, o ambiente usa a conexão deste computador."}
          </p>
          {onCreateProxy && (
            <button
              type="button"
              disabled={busy}
              className={hotButton}
              onClick={() => setAddingProxy(true)}
            >
              <Plus className="size-4" />
              Cadastrar novo proxy aqui
            </button>
          )}
        </div>
        {kind === "android" ? (
          <section className="space-y-3 rounded-xl border border-border bg-background/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold">Celular conectado</h3>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
                onClick={() => void action(onRefresh)}
              >
                <RefreshCw className="size-3.5" />
                Atualizar
              </button>
            </div>
            <label className="block space-y-2 text-sm">
              <span>Instância Android</span>
              <select
                required
                value={deviceId}
                onChange={(event) => setDeviceId(event.target.value)}
                className={hotInput}
              >
                <option value="">Selecione uma instância independente</option>
                {devices?.devices.map((device) => {
                  const used = profiles.some(
                    (item) => item.id !== profile?.id && item.deviceId === device.id,
                  );
                  return (
                    <option key={device.id} value={device.id} disabled={used}>
                      {device.name} ·{" "}
                      {used ? "já vinculada" : device.ready ? "ligada" : "desligada"}
                      {!device.adbEnabled ? " · ADB desativado" : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <p className="text-xs leading-5 text-muted-foreground">
              Cada perfil deve usar uma instância diferente. Seus aplicativos e contas pertencem à
              instância selecionada.
            </p>
            {devices?.managerAvailable && (
              <button type="button" onClick={() => void action(onManager)} className={hotButton}>
                <Plus className="size-4" />
                Criar instância no BlueStacks
              </button>
            )}
            <p className="text-xs leading-5 text-muted-foreground">
              No BlueStacks, crie uma nova instância e ative Configurações → Avançado → Android
              Debug Bridge. Depois clique em Atualizar aqui.
            </p>
            {proxyId && (
              <>
                <label className="block space-y-2 text-sm">
                  <span>Endereço de conexão do Android</span>
                  <input
                    required
                    value={hostAddress}
                    onChange={(event) => setHostAddress(event.target.value)}
                    className={hotInput}
                  />
                </label>
                <p className="text-xs leading-5 text-muted-foreground">
                  Use 127.0.0.1 para conexão automática pelo ADB. O proxy HTTP do Android será
                  configurado durante a sessão. Alguns aplicativos não utilizam o proxy do sistema.
                  Ao encerrar, a configuração anterior será restaurada.
                </p>
              </>
            )}
          </section>
        ) : (
          <label className="block space-y-2 text-sm font-semibold">
            <span>Tamanho da tela do navegador</span>
            <select
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              className={hotInput}
            >
              {[
                "1280x800",
                "1440x900",
                "1920x1080",
                "1024x768",
                ...(profile &&
                !["1280x800", "1440x900", "1920x1080", "1024x768"].includes(resolution)
                  ? [resolution]
                  : []),
              ].map((value) => (
                <option key={value} value={value}>
                  {value.replace("x", " × ")}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block space-y-2 text-sm font-semibold">
          <span>
            {kind === "android"
              ? "Página inicial (opcional)"
              : "Páginas iniciais (uma por linha, até cinco)"}
          </span>
          <textarea
            value={urls}
            onChange={(event) => setUrls(event.target.value)}
            rows={kind === "android" ? 2 : 3}
            maxLength={6000}
            placeholder="https://…"
            className={`${hotInput} resize-y font-normal`}
          />
        </label>
        <label className="block space-y-2 text-sm font-semibold">
          <span>
            Observações <span className="font-normal text-muted-foreground">(opcional)</span>
          </span>
          <textarea
            maxLength={2000}
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={`${hotInput} resize-y font-normal`}
          />
        </label>
        <FormError error={error} />
        <footer className="flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" onClick={onClose} disabled={busy} className={hotButton}>
            Cancelar
          </button>
          <button disabled={busy} className={hotPrimary}>
            {busy && <LoaderCircle className="size-4 animate-spin" />}
            {profile ? "Salvar alterações" : "Criar perfil"}
          </button>
        </footer>
      </form>
    </HotDialog>
  );
}

export function ProxyForm({
  proxy,
  onSave,
  onClose,
  storage = "local",
  inline = false,
}: {
  proxy?: HotProxy;
  onSave: (input: unknown, id?: string) => Promise<void>;
  onClose: () => void;
  storage?: "local" | "cloud";
  inline?: boolean;
}) {
  const [name, setName] = useState(proxy?.name ?? ""),
    [protocol, setProtocol] = useState(proxy?.protocol ?? "http");
  const [host, setHost] = useState(proxy?.host ?? ""),
    [port, setPort] = useState(String(proxy?.port ?? ""));
  const [username, setUsername] = useState(proxy?.username ?? ""),
    [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [paste, setPaste] = useState("");
  function parsePaste() {
    try {
      const parsed = parseProxyAddress(paste);
      setProtocol(parsed.protocol);
      setHost(parsed.host);
      setPort(String(parsed.port));
      setUsername(parsed.username);
      setPassword(parsed.password);
      if (!name.trim()) setName(`Proxy ${parsed.host}:${parsed.port}`.slice(0, 80));
      setPaste("");
      setError("");
    } catch {
      setError("Use protocolo://usuario:senha@host:porta, host:porta ou host:porta:usuario:senha.");
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(
        { name, protocol, host, port: Number(port), username, password, clearPassword },
        proxy?.id,
      );
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const form = (
    <form onSubmit={save} className="space-y-4">
      <details className="rounded-xl border border-border bg-background/60 p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Preencher colando um endereço</summary>
        <label className="mt-3 block space-y-2">
          <span className="text-xs text-muted-foreground">
            protocolo://usuario:senha@host:porta ou host:porta:usuario:senha
          </span>
          <input
            type="password"
            autoComplete="off"
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
            className={hotInput}
          />
        </label>
        <button type="button" onClick={parsePaste} className={`${hotButton} mt-2`}>
          <Globe2 className="size-4" />
          Preencher campos
        </button>
      </details>
      <label className="block space-y-2 text-sm font-semibold">
        <span>Nome do proxy</span>
        <input
          required
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Conexão do projeto A"
          className={hotInput}
        />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block space-y-2 text-sm font-semibold">
          <span>Protocolo</span>
          <select
            value={protocol}
            onChange={(event) => setProtocol(event.target.value as HotProxy["protocol"])}
            className={hotInput}
          >
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
            <option value="socks5">SOCKS5</option>
          </select>
        </label>
        <label className="col-span-2 block space-y-2 text-sm font-semibold">
          <span>Host ou IP</span>
          <input
            required
            value={host}
            onChange={(event) => setHost(event.target.value)}
            placeholder="proxy.exemplo.com"
            className={hotInput}
          />
        </label>
      </div>
      {storage === "cloud" && (
        <p className="text-xs leading-5 text-muted-foreground">
          Navegadores na nuvem aceitam HTTP e HTTPS. SOCKS5 pode ser cadastrado, mas não pode ser
          usado neste provedor. No Android, a aplicação automática da proxy depende de um serviço de
          rede dedicado.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-2 text-sm font-semibold">
          <span>Porta</span>
          <input
            type="number"
            required
            min={1}
            max={65535}
            value={port}
            onChange={(event) => setPort(event.target.value)}
            className={hotInput}
          />
        </label>
        <label className="block space-y-2 text-sm font-semibold">
          <span>Usuário (opcional)</span>
          <input
            autoComplete="off"
            maxLength={200}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className={hotInput}
          />
        </label>
      </div>
      <label className="block space-y-2 text-sm font-semibold">
        <span>Senha (opcional)</span>
        <input
          type="password"
          autoComplete="new-password"
          maxLength={1000}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={
            proxy?.hasPassword ? "Senha já salva. Deixe vazio para manter." : "Senha do proxy"
          }
          disabled={clearPassword}
          className={hotInput}
        />
      </label>
      {proxy?.hasPassword && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={clearPassword}
            onChange={(event) => setClearPassword(event.target.checked)}
          />
          Remover a senha salva
        </label>
      )}
      <FormError error={error} />
      <footer className="flex justify-end gap-2 border-t border-border pt-4">
        <button type="button" disabled={busy} onClick={onClose} className={hotButton}>
          Cancelar
        </button>
        <button disabled={busy} className={hotPrimary}>
          {busy && <LoaderCircle className="size-4 animate-spin" />}
          {proxy ? "Salvar proxy" : "Adicionar proxy"}
        </button>
      </footer>
    </form>
  );
  return inline ? (
    form
  ) : (
    <HotDialog
      title={proxy ? "Editar proxy" : "Adicionar proxy"}
      description={
        storage === "cloud"
          ? "Credenciais protegidas no servidor. A senha salva nunca é devolvida ao navegador."
          : "Credenciais criptografadas no conector deste computador."
      }
      onClose={onClose}
      busy={busy}
    >
      {form}
    </HotDialog>
  );
}
