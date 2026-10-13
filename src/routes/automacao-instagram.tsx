import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Hash,
  Instagram,
  Library,
  ListVideo,
  Pause,
  Play,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { AppShell, PageIntro } from "@/components/AppShell";
import { deleteInstagramMediaFile, saveInstagramMediaFile } from "@/lib/instagram-media-storage";

export const Route = createFileRoute("/automacao-instagram")({
  head: () => ({
    meta: [
      { title: "Automação Instagram — 00duHot" },
      {
        name: "description",
        content: "Organize contas, arquivos, legendas e uma fila local de publicações para Instagram.",
      },
    ],
  }),
  component: AutomacaoInstagram,
});

type Tab = "dashboard" | "contas" | "biblioteca" | "fila" | "conteudo" | "config";
type AccountStatus = "Aguardando conexão" | "Pausada";
type PostStatus = "Prévia" | "Na fila" | "Pausado";

interface Account {
  id: string;
  username: string;
  status: AccountStatus;
  dailyLimit: number;
  timezone: string;
}

interface MediaItem {
  id: string;
  name: string;
  size: number;
  type: string;
  addedAt: string;
}

interface Post {
  id: string;
  accountId: string;
  account: string;
  mediaId: string;
  video: string;
  date: string;
  time: string;
  status: PostStatus;
  caption: string;
  hashtags: string[];
}

interface PersistedState {
  version: 1;
  accounts: Account[];
  media: MediaItem[];
  posts: Post[];
  settings: {
    dailyLimit: number;
    interval: number;
    slots: string;
    timezone: string;
    queueCount: number;
    description: string;
    selectedCaption: string;
    selectedHashtags: string;
  };
}

const STORAGE_KEY = "00duhot.instagram-automation.v1";
const defaultCaptions = [
  "Conteúdo novo no ar. Confira até o final.",
  "Salve este conteúdo para ver depois.",
  "Envie para alguém que precisa ver isso.",
];
const defaultHashtags = "#reels #instagram #conteudo #dicas";

const initialSettings: PersistedState["settings"] = {
  dailyLimit: 5,
  interval: 120,
  slots: "09:00, 13:00, 18:00",
  timezone: "America/Bahia",
  queueCount: 10,
  description: "",
  selectedCaption: defaultCaptions[0],
  selectedHashtags: defaultHashtags,
};

function readPersistedState(): Partial<PersistedState> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return parsed && parsed.version === 1 ? parsed : {};
  } catch {
    return {};
  }
}

function parseSlots(value: string): string[] {
  const parsed = value
    .split(/[;,\n]+/)
    .map((slot) => slot.trim())
    .filter(Boolean);
  const valid = parsed.filter((slot) => /^([01]\d|2[0-3]):[0-5]\d$/.test(slot));
  return [...new Set(valid)].sort((a, b) => toMinutes(a) - toMinutes(b));
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayDate(date: string): string {
  const [year, month, day] = date.split("-");
  return year && month && day ? `${day}/${month}/${year}` : date;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function AutomacaoInstagram() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [settings, setSettings] = useState(initialSettings);
  const [accountName, setAccountName] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = readPersistedState();
    setAccounts(Array.isArray(saved.accounts) ? saved.accounts : []);
    setMedia(Array.isArray(saved.media) ? saved.media : []);
    setPosts(Array.isArray(saved.posts) ? saved.posts : []);
    setSettings({ ...initialSettings, ...(saved.settings ?? {}) });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const state: PersistedState = {
      version: 1,
      accounts,
      media,
      posts,
      settings,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      setNotice("Não foi possível salvar os dados locais. Verifique o espaço disponível no navegador.");
    }
  }, [accounts, media, posts, settings, hydrated]);

  const scheduled = posts.filter((post) => post.status === "Na fila").length;
  const previewCount = posts.filter((post) => post.status === "Prévia").length;
  const pausedCount = posts.filter((post) => post.status === "Pausado").length;
  const activePosts = useMemo(
    () => posts.filter((post) => post.status === "Na fila").sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
    [posts],
  );
  const upcoming = activePosts.slice(0, 8);
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0];
  const slots = useMemo(() => parseSlots(settings.slots), [settings.slots]);

  const updateSettings = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const addAccount = () => {
    const username = accountName.trim().replace(/^@+/, "");
    if (!username) {
      setNotice("Digite o nome de usuário da conta.");
      return;
    }
    if (accounts.some((account) => account.username.toLowerCase() === `@${username}`.toLowerCase())) {
      setNotice("Essa conta já está cadastrada.");
      return;
    }
    const account: Account = {
      id: createId("account"),
      username: `@${username}`,
      status: "Aguardando conexão",
      dailyLimit: Math.max(1, Math.min(50, settings.dailyLimit)),
      timezone: settings.timezone,
    };
    setAccounts((current) => [...current, account]);
    setSelectedAccountId(account.id);
    setAccountName("");
    setNotice("Conta adicionada ao seu espaço de trabalho. Nenhuma conexão com a Meta foi realizada.");
  };

  const toggleAccount = (id: string) => {
    setAccounts((current) =>
      current.map((account) =>
        account.id === id
          ? { ...account, status: account.status === "Pausada" ? "Aguardando conexão" : "Pausada" }
          : account,
      ),
    );
  };

  const uploadMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    const allowed = files.filter((file) => /^(video\/(mp4|webm|quicktime)|image\/(jpeg|png|webp))$/i.test(file.type));
    if (allowed.length !== files.length) {
      setNotice("Alguns arquivos foram ignorados. Use MP4, WEBM, MOV, JPG, PNG ou WEBP.");
    }
    if (!allowed.length) return;
    setUploading(true);
    let savedCount = 0;
    const newItems: MediaItem[] = [];
    try {
      for (const file of allowed) {
        const item: MediaItem = {
          id: createId("media"),
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          addedAt: new Date().toISOString(),
        };
        await saveInstagramMediaFile(item.id, file);
        newItems.push(item);
        savedCount += 1;
      }
      setMedia((current) => [...current, ...newItems]);
      setNotice(`${savedCount} arquivo(s) salvo(s) na biblioteca local deste navegador.`);
    } catch {
      setNotice(`Upload interrompido após ${savedCount} arquivo(s). Confira o espaço disponível e tente novamente.`);
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = async (item: MediaItem) => {
    try {
      await deleteInstagramMediaFile(item.id);
      setMedia((current) => current.filter((entry) => entry.id !== item.id));
      setPosts((current) => current.filter((post) => post.mediaId !== item.id));
      setNotice("Arquivo removido da biblioteca e os itens de fila que dependiam dele foram excluídos.");
    } catch {
      setNotice("Não foi possível remover o arquivo do armazenamento local.");
    }
  };

  const generateQueue = () => {
    if (!selectedAccount) {
      setNotice("Cadastre uma conta de referência antes de montar a fila.");
      setTab("contas");
      return;
    }
    if (!media.length) {
      setNotice("Adicione pelo menos um arquivo à biblioteca antes de montar a fila.");
      setTab("biblioteca");
      return;
    }
    if (!slots.length) {
      setNotice("Informe ao menos um horário válido, no formato HH:MM.");
      return;
    }
    if (slots.length > 1 && settings.interval < 1) {
      setNotice("O intervalo mínimo deve ser de pelo menos 1 minuto.");
      return;
    }

    const count = Math.max(1, Math.min(500, Math.floor(Number(settings.queueCount) || 1)));
    const limit = Math.max(1, Math.min(50, Math.floor(Number(settings.dailyLimit) || 1)));
    const interval = Math.max(1, Math.floor(Number(settings.interval) || 1));
    const usableSlots = slots.filter((slot, index) => index === 0 || toMinutes(slot) - toMinutes(slots[index - 1]) >= interval);
    if (!usableSlots.length) {
      setNotice("Os horários não respeitam o intervalo mínimo configurado.");
      return;
    }

    const now = new Date();
    const generated: Post[] = [];
    let dayOffset = 0;
    while (generated.length < count && dayOffset < 1000) {
      const date = new Date(now);
      date.setDate(now.getDate() + dayOffset);
      let addedToday = 0;
      for (const time of usableSlots) {
        if (generated.length >= count || addedToday >= limit) break;
        if (dayOffset === 0 && toMinutes(time) <= now.getHours() * 60 + now.getMinutes()) continue;
        generated.push({
          id: createId("post"),
          accountId: selectedAccount.id,
          account: selectedAccount.username,
          mediaId: media[generated.length % media.length].id,
          video: media[generated.length % media.length].name,
          date: formatDate(date),
          time,
          status: "Prévia",
          caption: [settings.selectedCaption.trim(), settings.description.trim()].filter(Boolean).join("\n\n"),
          hashtags: settings.selectedHashtags.split(/\s+/).map((tag) => tag.trim()).filter(Boolean).map((tag) => tag.startsWith("#") ? tag : `#${tag}`),
        });
        addedToday += 1;
      }
      dayOffset += 1;
    }
    if (!generated.length) {
      setNotice("Não há horários futuros válidos para hoje. Ajuste os horários ou tente novamente amanhã.");
      return;
    }
    setPosts(generated);
    setNotice(`Prévia criada com ${generated.length} item(ns). Confirme para guardar a fila operacional.`);
    setTab("fila");
  };

  const confirmQueue = () => {
    if (!previewCount) {
      setNotice("Gere uma prévia antes de confirmar a fila.");
      return;
    }
    setPosts((current) => current.map((post) => post.status === "Prévia" ? { ...post, status: "Na fila" } : post));
    setNotice(`Fila confirmada: ${previewCount} item(ns) salvos localmente. Nenhuma publicação foi enviada ao Instagram.`);
  };

  const pausePost = (id: string) => {
    setPosts((current) => current.map((post) => post.id === id ? { ...post, status: post.status === "Pausado" ? "Na fila" : "Pausado" } : post));
  };

  const removePost = (id: string) => {
    setPosts((current) => current.filter((post) => post.id !== id));
    setNotice("Item removido da fila local.");
  };

  const clearQueue = () => {
    setPosts([]);
    setNotice("Fila e prévia removidas.");
  };

  const tabs = [
    { id: "dashboard" as const, label: "Dashboard", icon: ListVideo },
    { id: "contas" as const, label: "Contas", icon: Users },
    { id: "biblioteca" as const, label: "Biblioteca", icon: Library },
    { id: "fila" as const, label: "Fila", icon: CalendarDays },
    { id: "conteudo" as const, label: "Legendas", icon: FileText },
    { id: "config" as const, label: "Configuração", icon: Settings2 },
  ];

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="Automação"
          title="Automação Instagram"
          description="Organize arquivos, legendas e uma fila operacional persistida neste navegador. A publicação real não está conectada."
        />

        {notice && (
          <div role="status" className="mt-5 flex items-start justify-between gap-3 rounded-md border border-border bg-secondary/50 px-4 py-3 text-sm">
            <p>{notice}</p>
            <button onClick={() => setNotice("")} className="shrink-0 text-xs font-semibold text-primary">Fechar</button>
          </div>
        )}

        <div className="mt-6 flex gap-2 overflow-x-auto border-b border-border pb-px">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setTab(item.id)} className={"inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold " + (tab === item.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                <Icon className="size-4" />{item.label}
              </button>
            );
          })}
        </div>

        {!hydrated ? (
          <div className="mt-8 rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">Carregando seus dados locais…</div>
        ) : (
          <>
            {tab === "dashboard" && (
              <section className="mt-6 space-y-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric label="Itens na fila" value={scheduled} icon={CheckCircle2} />
                  <Metric label="Em prévia" value={previewCount} icon={CalendarDays} />
                  <Metric label="Pausados" value={pausedCount} icon={Clock3} />
                  <Metric label="Arquivos na biblioteca" value={media.length} icon={Video} />
                </div>
                <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
                  <Panel title="Próximos itens da fila" action={<button onClick={() => setTab("fila")} className="text-xs font-semibold text-primary">Ver fila</button>}>
                    <div className="divide-y divide-border">
                      {upcoming.length ? upcoming.map((post) => (
                        <div key={post.id} className="flex items-center gap-3 py-3">
                          <div className="flex size-9 items-center justify-center rounded-md bg-secondary text-primary"><Video className="size-4" /></div>
                          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{post.video}</p><p className="text-xs text-muted-foreground">{post.account} · {displayDate(post.date)} às {post.time}</p></div>
                          <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold">{post.status}</span>
                        </div>
                      )) : <Empty text="Sua fila está vazia. Adicione arquivos e gere uma prévia para começar." />}
                    </div>
                  </Panel>
                  <Panel title="Ações rápidas">
                    <div className="space-y-2">
                      <QuickAction icon={Sparkles} text="Montar uma fila" onClick={() => setTab("fila")} />
                      <QuickAction icon={Upload} text="Adicionar arquivos" onClick={() => setTab("biblioteca")} />
                      <QuickAction icon={Instagram} text="Cadastrar conta" onClick={() => setTab("contas")} />
                    </div>
                    <p className="mt-4 text-xs leading-5 text-muted-foreground">Os dados ficam neste navegador. Esta tela organiza a operação, mas não publica nem conecta contas à Meta.</p>
                  </Panel>
                </div>
              </section>
            )}

            {tab === "contas" && (
              <section className="mt-6 space-y-4">
                <Panel title="Contas de trabalho">
                  <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); addAccount(); }}>
                    <input value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Nome de usuário (ex.: minha_conta)" className="field min-w-0 flex-1" aria-label="Nome de usuário do Instagram" />
                    <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"><Plus className="size-3" /> Adicionar conta</button>
                  </form>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">Cadastro manual para organizar a fila. Não autentica nem conecta o perfil ao Instagram.</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {accounts.map((account) => (
                      <div key={account.id} className="rounded-lg border border-border p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex size-11 items-center justify-center rounded-full bg-secondary text-primary"><Instagram className="size-5" /></div>
                          <div className="min-w-0 flex-1"><p className="font-semibold">{account.username}</p><p className="mt-1 text-xs text-muted-foreground">{account.timezone}</p></div>
                          <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-muted-foreground">{account.status}</span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button onClick={() => setSelectedAccountId(account.id)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">{selectedAccount?.id === account.id ? "Conta selecionada" : "Usar na fila"}</button>
                          <button onClick={() => toggleAccount(account.id)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">{account.status === "Pausada" ? <><Play className="mr-1 inline size-3" /> Reativar</> : <><Pause className="mr-1 inline size-3" /> Pausar</>}</button>
                          <button onClick={() => { setAccounts((current) => current.filter((item) => item.id !== account.id)); if (selectedAccountId === account.id) setSelectedAccountId(""); setNotice("Conta removida do cadastro local."); }} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-destructive"><Trash2 className="mr-1 inline size-3" /> Remover</button>
                        </div>
                      </div>
                    ))}
                    {!accounts.length && <Empty text="Nenhuma conta cadastrada. Adicione um nome de usuário para organizar sua fila." />}
                  </div>
                </Panel>
              </section>
            )}

            {tab === "biblioteca" && (
              <section className="mt-6 space-y-4">
                <Panel title="Biblioteca local" action={<label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Upload className="size-3" /> {uploading ? "Salvando…" : "Adicionar arquivos"}<input type="file" multiple accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp" disabled={uploading} onChange={uploadMedia} className="hidden" /></label>}>
                  <div className="rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center">
                    <Upload className="mx-auto size-7 text-primary" />
                    <p className="mt-3 text-sm font-semibold">Adicione vídeos e imagens para montar a fila</p>
                    <p className="mt-1 text-xs text-muted-foreground">MP4, WEBM, MOV, JPG, PNG ou WEBP. Os arquivos são armazenados no navegador deste dispositivo.</p>
                    <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold">{uploading ? "Salvando arquivos…" : "Selecionar arquivos"}<input type="file" multiple accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp" disabled={uploading} onChange={uploadMedia} className="hidden" /></label>
                  </div>
                  <div className="divide-y divide-border">
                    {media.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 py-3">
                        <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-primary">{item.type.startsWith("image/") ? <FileText className="size-4" /> : <Video className="size-4" />}</div>
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{formatSize(item.size)} · {item.type.startsWith("image/") ? "Imagem" : "Vídeo"} · {new Date(item.addedAt).toLocaleDateString("pt-BR")}</p></div>
                        <button onClick={() => void removeMedia(item)} className="rounded-md border border-border p-2 text-muted-foreground hover:text-destructive" aria-label={`Remover ${item.name}`}><Trash2 className="size-4" /></button>
                      </div>
                    ))}
                    {!media.length && <Empty text="Sua biblioteca está vazia. Adicione arquivos para gerar uma fila real de itens locais." />}
                  </div>
                </Panel>
              </section>
            )}

            {tab === "fila" && (
              <section className="mt-6 space-y-4">
                <Panel title="Planejar fila">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Quantidade de itens"><input type="number" min={1} max={500} value={settings.queueCount} onChange={(event) => updateSettings("queueCount", Number(event.target.value))} className="field" /></Field>
                    <Field label="Conta para a fila"><select value={selectedAccount?.id ?? ""} onChange={(event) => setSelectedAccountId(event.target.value)} className="field"><option value="">Selecione uma conta</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.username}{account.status === "Pausada" ? " (pausada)" : ""}</option>)}</select></Field>
                    <Field label="Horários diários"><input value={settings.slots} onChange={(event) => updateSettings("slots", event.target.value)} className="field" placeholder="09:00, 13:00, 18:00" /><span className="mt-1 block text-[11px] text-muted-foreground">{slots.length} horário(s) válido(s) reconhecido(s)</span></Field>
                    <Field label="Limite diário"><input type="number" min={1} max={50} value={settings.dailyLimit} onChange={(event) => updateSettings("dailyLimit", Number(event.target.value))} className="field" /></Field>
                    <Field label="Intervalo mínimo (minutos)"><input type="number" min={1} max={1440} value={settings.interval} onChange={(event) => updateSettings("interval", Number(event.target.value))} className="field" /></Field>
                    <Field label="Fuso horário"><select value={settings.timezone} onChange={(event) => updateSettings("timezone", event.target.value)} className="field"><option value="America/Bahia">America/Bahia</option><option value="America/Sao_Paulo">America/Sao_Paulo</option><option value="America/Manaus">America/Manaus</option><option value="America/Belem">America/Belem</option><option value="UTC">UTC</option></select></Field>
                    <Field label="Legenda base"><select value={settings.selectedCaption} onChange={(event) => updateSettings("selectedCaption", event.target.value)} className="field">{defaultCaptions.map((caption) => <option key={caption} value={caption}>{caption}</option>)}</select></Field>
                    <Field label="Descrição adicional"><textarea value={settings.description} onChange={(event) => updateSettings("description", event.target.value)} placeholder="Texto opcional para acrescentar à legenda…" className="field min-h-24" /></Field>
                    <Field label="Hashtags"><textarea value={settings.selectedHashtags} onChange={(event) => updateSettings("selectedHashtags", event.target.value)} className="field min-h-24" /></Field>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary/40 p-4">
                    <div><p className="text-sm font-semibold">Prévia antes de confirmar</p><p className="text-xs text-muted-foreground">A geração respeita horários, limite diário e intervalo mínimo. Nenhuma publicação é enviada.</p></div>
                    <button onClick={generateQueue} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"><Sparkles className="size-3" /> Gerar prévia</button>
                  </div>
                </Panel>

                <Panel title={`Fila local · ${posts.length} item(ns)`} action={<div className="flex flex-wrap gap-2">{previewCount > 0 && <button onClick={confirmQueue} className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Confirmar fila</button>}<button onClick={clearQueue} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">Limpar fila</button></div>}>
                  <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground"><span>{scheduled} na fila</span><span>{previewCount} em prévia</span><span>{pausedCount} pausados</span></div>
                  <div className="max-h-[560px] overflow-auto">
                    {posts.map((post) => (
                      <div key={post.id} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-primary"><Video className="size-4" /></div>
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{post.video}</p><p className="text-xs text-muted-foreground">{post.account} · {displayDate(post.date)} às {post.time}</p><p className="mt-1 truncate text-xs text-muted-foreground">{post.caption} {post.hashtags.join(" ")}</p></div>
                        <span className="hidden rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold sm:inline-flex">{post.status}</span>
                        <button onClick={() => pausePost(post.id)} className="rounded-md border border-border p-2" aria-label={post.status === "Pausado" ? "Retomar item" : "Pausar item"}>{post.status === "Pausado" ? <Play className="size-3" /> : <Pause className="size-3" />}</button>
                        <button onClick={() => removePost(post.id)} className="rounded-md border border-border p-2 text-muted-foreground hover:text-destructive" aria-label="Remover item"><Trash2 className="size-3" /></button>
                      </div>
                    ))}
                    {!posts.length && <Empty text="Nenhum item na fila. Gere uma prévia usando os arquivos da biblioteca." />}
                  </div>
                  <p className="mt-4 text-xs leading-5 text-muted-foreground">“Confirmar fila” apenas grava o planejamento local. Publicação automática, conexão OAuth e status de publicação não fazem parte desta etapa.</p>
                </Panel>
              </section>
            )}

            {tab === "conteudo" && (
              <section className="mt-6 space-y-4">
                <Panel title="Legendas e hashtags">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <Field label="Legenda padrão"><select value={settings.selectedCaption} onChange={(event) => updateSettings("selectedCaption", event.target.value)} className="field">{defaultCaptions.map((caption) => <option key={caption} value={caption}>{caption}</option>)}</select></Field>
                    <Field label="Grupo de hashtags"><input value={settings.selectedHashtags} onChange={(event) => updateSettings("selectedHashtags", event.target.value)} className="field" /></Field>
                  </div>
                  <div className="mt-5 rounded-lg border border-border p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Hash className="size-4 text-primary" /> Prévia do conteúdo</div><p className="mt-2 whitespace-pre-wrap text-sm">{settings.selectedCaption}{settings.description ? `\n\n${settings.description}` : ""}</p><p className="mt-2 text-sm text-primary">{settings.selectedHashtags.split(/\s+/).filter(Boolean).map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ")}</p><p className="mt-3 text-xs text-muted-foreground">As alterações são salvas localmente e usadas nas próximas prévias de fila.</p></div>
                </Panel>
              </section>
            )}

            {tab === "config" && (
              <section className="mt-6 space-y-4">
                <Panel title="Configuração padrão">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Fuso padrão"><select value={settings.timezone} onChange={(event) => updateSettings("timezone", event.target.value)} className="field"><option value="America/Bahia">America/Bahia</option><option value="America/Sao_Paulo">America/Sao_Paulo</option><option value="America/Manaus">America/Manaus</option><option value="America/Belem">America/Belem</option><option value="UTC">UTC</option></select></Field>
                    <Field label="Limite diário padrão"><input type="number" min={1} max={50} value={settings.dailyLimit} onChange={(event) => updateSettings("dailyLimit", Number(event.target.value))} className="field" /></Field>
                    <Field label="Intervalo mínimo padrão"><input type="number" min={1} max={1440} value={settings.interval} onChange={(event) => updateSettings("interval", Number(event.target.value))} className="field" /></Field>
                    <Field label="Horários padrão"><input value={settings.slots} onChange={(event) => updateSettings("slots", event.target.value)} className="field" /></Field>
                  </div>
                </Panel>
                <Panel title="Estado da integração">
                  <div className="rounded-lg border border-border bg-secondary/40 p-4"><p className="text-sm font-semibold">Instagram / Meta API</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Desconectado por projeto: este módulo não solicita tokens, não simula publicação e não envia conteúdo ao Instagram. Os dados e arquivos são guardados apenas no armazenamento local deste navegador.</p></div>
                </Panel>
              </section>
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof CalendarDays }) {
  return <div className="rounded-lg border border-border bg-card p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><Icon className="size-4 text-primary" /></div><p className="mt-3 font-display text-2xl font-bold">{value}</p></div>;
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-5"><div className="flex items-center justify-between gap-4 border-b border-border pb-4"><h2 className="font-display text-base font-semibold">{title}</h2>{action}</div><div className="pt-4">{children}</div></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">{label}</span>{children}</label>;
}

function QuickAction({ icon: Icon, text, onClick }: { icon: typeof Play; text: string; onClick: () => void }) {
  return <button onClick={onClick} className="flex w-full items-center gap-3 rounded-md border border-border p-3 text-left text-sm font-medium hover:border-primary/50"><Icon className="size-4 text-primary" />{text}<ChevronRight className="ml-auto size-4 text-muted-foreground" /></button>;
}

function Empty({ text }: { text: string }) {
  return <div className="py-8 text-center text-xs text-muted-foreground">{text}</div>;
}
