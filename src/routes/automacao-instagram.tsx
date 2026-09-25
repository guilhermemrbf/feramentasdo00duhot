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
  Upload,
  Users,
  Video,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { AppShell, PageIntro } from "@/components/AppShell";

export const Route = createFileRoute("/automacao-instagram")({
  head: () => ({
    meta: [
      { title: "Automação Instagram — 00duHot" },
      {
        name: "description",
        content:
          "Central de gerenciamento de contas, biblioteca, fila e agendamento de Reels do 00duHot.",
      },
    ],
  }),
  component: AutomacaoInstagram,
});

type Tab = "dashboard" | "contas" | "biblioteca" | "fila" | "conteudo" | "config";
type AccountStatus = "Aguardando conexão" | "Conectada" | "Pausada";
type PostStatus = "Agendado" | "Publicado" | "Falha" | "Pausado";

interface Account {
  id: string;
  username: string;
  status: AccountStatus;
  dailyLimit: number;
  today: number;
  timezone: string;
}

interface VideoItem {
  id: string;
  name: string;
  duration: string;
  size: string;
  status: "Disponível" | "Em uso";
}

interface Post {
  id: string;
  account: string;
  video: string;
  date: string;
  time: string;
  status: PostStatus;
  caption: string;
  hashtags: string[];
}

const initialAccounts: Account[] = [
  {
    id: "account-1",
    username: "@conta_teste",
    status: "Aguardando conexão",
    dailyLimit: 5,
    today: 0,
    timezone: "America/Bahia",
  },
];

const initialVideos: VideoItem[] = [
  { id: "video-1", name: "reel-001.mp4", duration: "00:18", size: "8,4 MB", status: "Disponível" },
  { id: "video-2", name: "reel-002.mp4", duration: "00:27", size: "11,2 MB", status: "Disponível" },
  { id: "video-3", name: "reel-003.mp4", duration: "00:14", size: "6,9 MB", status: "Disponível" },
];

const captions = [
  "Conteúdo novo no ar. Confira até o final.",
  "Mais um conteúdo publicado. Salve para ver depois.",
  "Novo Reel disponível. Compartilhe com quem precisa ver.",
];

const hashtags = ["#reels", "#instagram", "#conteudo", "#viral", "#dicas"];

function AutomacaoInstagram() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [accounts, setAccounts] = useState(initialAccounts);
  const [videos] = useState(initialVideos);
  const [posts, setPosts] = useState<Post[]>(() => buildPreviewPosts());
  const [dailyLimit, setDailyLimit] = useState(5);
  const [interval, setInterval] = useState(120);
  const [slots, setSlots] = useState("09:00, 13:00, 18:00");
  const [description, setDescription] = useState("");
  const [selectedCaption, setSelectedCaption] = useState(captions[0]);
  const [selectedHashtags, setSelectedHashtags] = useState(hashtags.join(" "));
  const [queueCount, setQueueCount] = useState(50);
  const [previewReady, setPreviewReady] = useState(true);

  const scheduled = posts.filter((post) => post.status === "Agendado").length;
  const published = posts.filter((post) => post.status === "Publicado").length;
  const failures = posts.filter((post) => post.status === "Falha").length;

  const tabs = [
    { id: "dashboard" as const, label: "Dashboard", icon: ListVideo },
    { id: "contas" as const, label: "Contas", icon: Users },
    { id: "biblioteca" as const, label: "Biblioteca", icon: Library },
    { id: "fila" as const, label: "Fila", icon: CalendarDays },
    { id: "conteudo" as const, label: "Legendas", icon: FileText },
    { id: "config" as const, label: "Configuração", icon: Settings2 },
  ];

  const generateQueue = () => {
    const count = Math.max(1, Math.min(500, queueCount));
    const generated = buildPreviewPosts(count, {
      caption: selectedCaption,
      hashtags: selectedHashtags.split(/\s+/).filter(Boolean),
      description,
    });
    setPosts(generated);
    setPreviewReady(true);
    setTab("fila");
  };

  const connectPlaceholder = (id: string) => {
    setAccounts((current) =>
      current.map((account) =>
        account.id === id ? { ...account, status: "Conectada" } : account,
      ),
    );
  };

  const toggleAccount = (id: string) => {
    setAccounts((current) =>
      current.map((account) =>
        account.id === id
          ? {
              ...account,
              status: account.status === "Pausada" ? "Conectada" : "Pausada",
            }
          : account,
      ),
    );
  };

  const upcoming = useMemo(
    () => posts.filter((post) => post.status === "Agendado").slice(0, 10),
    [posts],
  );

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="Automação"
          title="Automação Instagram"
          description="Organize vídeos, legendas, hashtags e uma fila de Reels pronta para receber a publicação automática."
        />

        <div className="mt-6 flex gap-2 overflow-x-auto border-b border-border pb-px">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={
                  "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold " +
                  (tab === item.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground")
                }
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === "dashboard" && (
          <section className="mt-6 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Publicados hoje" value={published} icon={CheckCircle2} />
              <Metric label="Agendados" value={scheduled} icon={CalendarDays} />
              <Metric label="Falhas" value={failures} icon={Clock3} />
              <Metric label="Vídeos na biblioteca" value={videos.length} icon={Video} />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
              <Panel title="Próximas publicações" action={<button onClick={() => setTab("fila")} className="text-xs font-semibold text-primary">Ver fila</button>}>
                <div className="divide-y divide-border">
                  {upcoming.length ? upcoming.map((post) => (
                    <div key={post.id} className="flex items-center gap-3 py-3">
                      <div className="flex size-9 items-center justify-center rounded-md bg-secondary text-primary"><Video className="size-4" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{post.video}</p>
                        <p className="text-xs text-muted-foreground">{post.account} · {post.date} às {post.time}</p>
                      </div>
                      <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold">{post.status}</span>
                    </div>
                  )) : <Empty text="Nenhuma publicação agendada." />}
                </div>
              </Panel>

              <Panel title="Ação rápida">
                <div className="space-y-2">
                  <QuickAction icon={Sparkles} text="Preencher fila" onClick={() => setTab("fila")} />
                  <QuickAction icon={Upload} text="Adicionar vídeos" onClick={() => setTab("biblioteca")} />
                  <QuickAction icon={Instagram} text="Configurar conta" onClick={() => setTab("contas")} />
                </div>
              </Panel>
            </div>
          </section>
        )}

        {tab === "contas" && (
          <section className="mt-6 space-y-4">
            <Panel title="Contas Instagram" action={<button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Plus className="size-3" /> Conectar Instagram</button>}>
              <div className="grid gap-3 md:grid-cols-2">
                {accounts.map((account) => (
                  <div key={account.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-11 items-center justify-center rounded-full bg-secondary text-primary"><Instagram className="size-5" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{account.username}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{account.timezone}</p>
                      </div>
                      <span className={"rounded-full px-2 py-1 text-[10px] font-semibold " + (account.status === "Conectada" ? "bg-emerald-500/10 text-emerald-500" : "bg-secondary text-muted-foreground")}>{account.status}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                      <Info label="Hoje" value={account.today + "/" + account.dailyLimit} />
                      <Info label="Intervalo" value={interval + " min"} />
                      <Info label="Fuso" value="BA" />
                    </div>
                    <div className="mt-4 flex gap-2">
                      {account.status !== "Conectada" && <button onClick={() => connectPlaceholder(account.id)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">Simular conexão</button>}
                      {account.status === "Conectada" && <button onClick={() => toggleAccount(account.id)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">{account.status === "Pausada" ? "Reativar" : "Pausar"}</button>}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">A conexão real com o Instagram fica isolada nesta tela e será ligada ao OAuth da Meta quando o aplicativo estiver disponível.</p>
            </Panel>
          </section>
        )}

        {tab === "biblioteca" && (
          <section className="mt-6 space-y-4">
            <Panel title="Biblioteca de vídeos" action={<button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Upload className="size-3" /> Adicionar vídeos</button>}>
              <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
                <Upload className="mx-auto size-7 text-primary" />
                <p className="mt-3 text-sm font-semibold">Arraste seus vídeos aqui</p>
                <p className="mt-1 text-xs text-muted-foreground">MP4, WEBM ou MOV · upload em massa preparado para fila de processamento</p>
              </div>
              <div className="divide-y divide-border">
                {videos.map((video) => (
                  <div key={video.id} className="flex items-center gap-3 py-3">
                    <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-primary"><Video className="size-4" /></div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{video.name}</p><p className="text-xs text-muted-foreground">{video.duration} · {video.size}</p></div>
                    <span className="text-xs text-muted-foreground">{video.status}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        )}

        {tab === "fila" && (
          <section className="mt-6 space-y-4">
            <Panel title="Preencher fila">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Quantidade de posts">
                  <input type="number" min={1} max={500} value={queueCount} onChange={(event) => setQueueCount(Number(event.target.value))} className="field" />
                </Field>
                <Field label="Horários diários">
                  <input value={slots} onChange={(event) => setSlots(event.target.value)} className="field" />
                </Field>
                <Field label="Limite diário">
                  <input type="number" min={1} max={10} value={dailyLimit} onChange={(event) => setDailyLimit(Number(event.target.value))} className="field" />
                </Field>
                <Field label="Intervalo mínimo (minutos)">
                  <input type="number" min={1} value={interval} onChange={(event) => setInterval(Number(event.target.value))} className="field" />
                </Field>
                <Field label="Descrição/base da publicação">
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Texto opcional que será usado como base da descrição..." className="field min-h-24" />
                </Field>
                <Field label="Hashtags">
                  <textarea value={selectedHashtags} onChange={(event) => setSelectedHashtags(event.target.value)} className="field min-h-24" />
                </Field>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary/40 p-4">
                <div><p className="text-sm font-semibold">Prévia antes de gravar</p><p className="text-xs text-muted-foreground">A programação é gerada localmente para conferência antes da integração de publicação.</p></div>
                <button onClick={generateQueue} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"><Sparkles className="size-3" /> Gerar prévia</button>
              </div>
            </Panel>

            {previewReady && (
              <Panel title={`Fila · ${posts.length} posts`} action={<button className="text-xs font-semibold text-primary">Confirmar fila</button>}>
                <div className="max-h-[560px] overflow-auto">
                  {posts.map((post) => (
                    <div key={post.id} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                      <span className="w-10 text-xs font-semibold text-muted-foreground">#{post.id.split("-").pop()}</span>
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Video className="size-4 shrink-0 text-primary" />
                        <div className="min-w-0"><p className="truncate text-sm font-medium">{post.video}</p><p className="text-xs text-muted-foreground">{post.account} · {post.date} · {post.time}</p></div>
                      </div>
                      <span className="hidden rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold sm:inline-flex">{post.status}</span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </section>
        )}

        {tab === "conteudo" && (
          <section className="mt-6 space-y-4">
            <Panel title="Legendas e hashtags">
              <div className="grid gap-6 lg:grid-cols-2">
                <Field label="Conjunto de legendas">
                  <select value={selectedCaption} onChange={(event) => setSelectedCaption(event.target.value)} className="field">
                    {captions.map((caption) => <option key={caption}>{caption}</option>)}
                  </select>
                </Field>
                <Field label="Grupo de hashtags">
                  <input value={selectedHashtags} onChange={(event) => setSelectedHashtags(event.target.value)} className="field" />
                </Field>
              </div>
              <div className="mt-5 rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 text-sm font-semibold"><Hash className="size-4 text-primary" /> Campos preparados para variação automática</div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">A estrutura permite sortear legendas e variar hashtags por publicação quando o motor de publicação for conectado.</p>
              </div>
            </Panel>
          </section>
        )}

        {tab === "config" && (
          <section className="mt-6 space-y-4">
            <Panel title="Configuração da automação">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Fuso padrão"><select className="field" defaultValue="America/Bahia"><option>America/Bahia</option><option>America/Sao_Paulo</option></select></Field>
                <Field label="Limite diário padrão"><input type="number" value={dailyLimit} onChange={(event) => setDailyLimit(Number(event.target.value))} className="field" /></Field>
                <Field label="Intervalo mínimo padrão"><input type="number" value={interval} onChange={(event) => setInterval(Number(event.target.value))} className="field" /></Field>
                <Field label="Slots padrão"><input value={slots} onChange={(event) => setSlots(event.target.value)} className="field" /></Field>
              </div>
            </Panel>
            <Panel title="Integração">
              <div className="rounded-lg border border-border bg-secondary/40 p-4">
                <p className="text-sm font-semibold">Instagram API</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">A camada de publicação ainda está desligada. Nenhum token ou credencial é solicitado nesta etapa.</p>
              </div>
            </Panel>
          </section>
        )}
      </main>
    </AppShell>
  );
}

function buildPreviewPosts(
  count = 50,
  options?: { caption?: string; hashtags?: string[]; description?: string },
): Post[] {
  const result: Post[] = [];
  const baseDate = new Date();
  const account = initialAccounts[0].username;
  const videoPool = initialVideos.map((video) => video.name);
  const caption = options?.caption || captions[0];
  const tags = options?.hashtags?.length ? options.hashtags : hashtags;
  const extra = options?.description ? " " + options.description : "";

  for (let index = 0; index < count; index += 1) {
    const dayOffset = Math.floor(index / 3);
    const slot = index % 3;
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + dayOffset);
    const dateLabel = date.toLocaleDateString("pt-BR");
    const times = ["09:00", "13:00", "18:00"];
    result.push({
      id: "post-" + String(index + 1).padStart(3, "0"),
      account,
      video: videoPool[index % videoPool.length],
      date: dateLabel,
      time: times[slot],
      status: "Agendado",
      caption: caption + extra,
      hashtags: tags,
    });
  }
  return result;
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof CalendarDays }) {
  return <div className="rounded-lg border border-border bg-card p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><Icon className="size-4 text-primary" /></div><p className="mt-3 font-display text-2xl font-bold">{value}</p></div>;
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-5"><div className="flex items-center justify-between gap-4 border-b border-border pb-4"><h2 className="font-display text-base font-semibold">{title}</h2>{action}</div><div className="pt-4">{children}</div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">{label}</span>{children}</label>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-secondary p-2"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-xs font-semibold">{value}</p></div>;
}

function QuickAction({ icon: Icon, text, onClick }: { icon: typeof Play; text: string; onClick: () => void }) {
  return <button onClick={onClick} className="flex w-full items-center gap-3 rounded-md border border-border p-3 text-left text-sm font-medium hover:border-primary/50"><Icon className="size-4 text-primary" />{text}<ChevronRight className="ml-auto size-4 text-muted-foreground" /></button>;
}

function Empty({ text }: { text: string }) {
  return <div className="py-8 text-center text-xs text-muted-foreground">{text}</div>;
}
