import { useState, type FormEvent } from "react";
import { Check, Globe2, LoaderCircle, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cloudProfileSchema, type CloudProfile, type CloudSetup } from "@/lib/hot-cloud";
import type { HotProxy, ProfileKind } from "@/lib/hot-profiles";
import { HotDialog, hotButton, hotInput, hotPrimary } from "./HotDialog";

export function CloudAuth({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (sent) {
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
        if (error)
          throw new Error("Código inválido ou expirado. Confira o e-mail e tente novamente.");
        onClose();
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: `${window.location.origin}/hot-profiles`,
          },
        });
        if (error)
          throw new Error(
            "Não consegui enviar o acesso. Confira o e-mail e aguarde antes de tentar novamente.",
          );
        setSent(true);
      }
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <HotDialog
      title="Entre no seu espaço"
      description="Seus perfis e proxies ficam ligados à sua conta."
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit} className="space-y-5">
        <label className="block space-y-2 text-sm font-semibold">
          <span>Seu e-mail</span>
          <input
            className={hotInput}
            required
            type="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            disabled={sent}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {sent && (
          <>
            <p className="text-sm leading-6 text-muted-foreground">
              Enviamos o acesso para seu e-mail. Use o código recebido aqui. Se o e-mail mostrar
              apenas um link, abra o link neste navegador.
            </p>
            <label className="block space-y-2 text-sm font-semibold">
              <span>Código de acesso</span>
              <input
                className={hotInput}
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,8}"
                minLength={6}
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <button className={`${hotPrimary} w-full`} disabled={busy}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Mail className="size-4" />}
          {sent ? "Confirmar acesso" : "Receber acesso por e-mail"}
        </button>
        {sent && (
          <button
            type="button"
            className={hotButton}
            disabled={busy}
            onClick={() => {
              setSent(false);
              setCode("");
              setError("");
            }}
          >
            Usar outro e-mail ou reenviar
          </button>
        )}
      </form>
    </HotDialog>
  );
}

export function CloudProfileForm({
  profile,
  initialKind,
  proxies,
  onClose,
  onSave,
}: {
  profile?: CloudProfile;
  initialKind: ProfileKind;
  proxies: HotProxy[];
  onClose: () => void;
  onSave: (value: ReturnType<typeof cloudProfileSchema.parse>, id?: string) => Promise<void>;
}) {
  const [kind, setKind] = useState(profile?.kind ?? initialKind);
  const [name, setName] = useState(profile?.name ?? "");
  const [tags, setTags] = useState(profile?.tags.join(", ") ?? "");
  const [notes, setNotes] = useState(profile?.notes ?? "");
  const [proxyId, setProxyId] = useState(profile?.proxy_id ?? "");
  const [resolution, setResolution] = useState(
    `${profile?.viewport.width ?? 1280}x${profile?.viewport.height ?? 800}`,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const [width, height] = resolution.split("x").map(Number);
      const value = cloudProfileSchema.safeParse({
        kind,
        name,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        notes,
        proxy_id: proxyId || null,
        viewport: { width, height },
      });
      if (!value.success)
        throw new Error("Confira os campos. Use até dez tags, com até 30 caracteres cada.");
      await onSave(value.data, profile?.id);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const chosen = proxies.find((p) => p.id === proxyId);
  return (
    <HotDialog
      title={profile ? "Editar perfil" : "Novo perfil na nuvem"}
      description="Um ambiente separado para cada projeto, acessado pelo site."
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={save} className="space-y-5">
        <fieldset disabled={!!profile || busy} className="grid grid-cols-2 gap-3">
          <legend className="mb-2 text-sm font-semibold">Tipo de ambiente</legend>
          {(
            [
              { value: "browser", label: "Navegador", Icon: Globe2 },
              { value: "android", label: "Android web", Icon: Smartphone },
            ] as const
          ).map((item) => (
            <label
              key={item.value}
              className={`cursor-pointer rounded-xl border p-4 focus-within:ring-2 focus-within:ring-ring ${kind === item.value ? "border-primary bg-primary/10" : "border-border"}`}
            >
              <input
                className="sr-only"
                type="radio"
                name="cloud-kind"
                checked={kind === item.value}
                onChange={() => setKind(item.value)}
              />
              <span className="flex items-center gap-2 text-sm font-bold">
                <item.Icon className="size-5 text-primary" />
                {item.label}
                {kind === item.value && <Check className="ml-auto size-4" />}
              </span>
            </label>
          ))}
        </fieldset>
        <label className="block space-y-2 text-sm font-semibold">
          <span>Nome do perfil</span>
          <input
            required
            maxLength={80}
            className={hotInput}
            placeholder="Ex.: Projeto principal"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block space-y-2 text-sm font-semibold">
          <span>Proxy do ambiente</span>
          <select className={hotInput} value={proxyId} onChange={(e) => setProxyId(e.target.value)}>
            <option value="">Sem proxy · rede da nuvem</option>
            {proxies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.protocol.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        {(kind === "android" || chosen?.protocol === "socks5") && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm leading-6 text-muted-foreground">
            {kind === "android"
              ? "Android real via Genymotion. Nesta integração, o celular é temporário: ao encerrar, seus aplicativos e contas serão apagados. A aplicação de proxy ainda depende de um serviço de rede dedicado; perfis Android com proxy ficam bloqueados para execução."
              : "O provedor de navegador aceita HTTP e HTTPS. Este perfil com SOCKS5 poderá ser salvo, mas não iniciado."}
          </p>
        )}
        {kind === "browser" && (
          <label className="block space-y-2 text-sm font-semibold">
            <span>Tamanho da tela</span>
            <select
              className={hotInput}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            >
              {["1280x800", "1440x900", "1920x1080", "1024x768"].map((r) => (
                <option key={r} value={r}>
                  {r.replace("x", " × ")}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block space-y-2 text-sm font-semibold">
          <span>Tags, separadas por vírgula</span>
          <input
            maxLength={250}
            className={hotInput}
            value={tags}
            placeholder="Cliente A, Trabalho"
            onChange={(e) => setTags(e.target.value)}
          />
        </label>
        <label className="block space-y-2 text-sm font-semibold">
          <span>Descrição e observações</span>
          <textarea
            rows={3}
            maxLength={2000}
            className={hotInput}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <footer className="flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" className={hotButton} disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button className={hotPrimary} disabled={busy}>
            {busy && <LoaderCircle className="size-4 animate-spin" />}
            {profile ? "Salvar alterações" : "Criar perfil"}
          </button>
        </footer>
      </form>
    </HotDialog>
  );
}

export function CloudConfiguration({
  setup,
  onClose,
}: {
  setup: CloudSetup | null;
  onClose: () => void;
}) {
  const items = [
    { label: "Contas autorizadas", ready: setup?.access },
    { label: "Acesso por e-mail", ready: setup?.auth },
    { label: "Banco de perfis e proxies", ready: setup?.storage },
    { label: "Proteção das senhas", ready: setup?.encryption },
    { label: "Navegadores · Browserbase", ready: setup?.browser },
    { label: "Android · Genymotion", ready: setup?.android },
  ];
  return (
    <HotDialog
      title="Configuração da nuvem"
      description="Os ambientes serão executados por provedores externos. Nenhum emulador precisa ficar aberto no seu computador."
      onClose={onClose}
    >
      <div className="space-y-5">
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm"
            >
              <span>{item.label}</span>
              <span
                className={`flex items-center gap-1.5 text-xs font-semibold ${item.ready ? "text-success" : "text-muted-foreground"}`}
              >
                {item.ready && <ShieldCheck className="size-4" />}
                {item.ready ? "Configuração encontrada" : "A configurar"}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs leading-6 text-muted-foreground">
          Este painel verifica a presença das configurações. A conexão e as permissões só são
          confirmadas ao usar cada serviço.
        </p>
        <section className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <h3 className="font-bold">Para ativar os ambientes</h3>
          <ol className="list-decimal space-y-2 pl-4 text-sm leading-6 text-muted-foreground">
            <li>Prepare o banco de dados e o acesso por e-mail do projeto.</li>
            <li>Crie suas contas nos provedores e configure as credenciais no servidor do site.</li>
            <li>Adicione uma proxy, vincule a um perfil de navegador e inicie sua sessão.</li>
          </ol>
        </section>
        <div className="flex flex-wrap gap-2">
          <a
            href="https://www.browserbase.com"
            target="_blank"
            rel="noopener noreferrer"
            className={hotButton}
          >
            Browserbase
          </a>
          <a
            href="https://www.genymotion.com/product-cloud/"
            target="_blank"
            rel="noopener noreferrer"
            className={hotButton}
          >
            Genymotion
          </a>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Os provedores podem cobrar por uso. A configuração inicial limita cada sessão a 30
          minutos. Android com dados persistentes e proxy automática ainda precisa de uma etapa
          adicional de infraestrutura.
        </p>
      </div>
    </HotDialog>
  );
}
