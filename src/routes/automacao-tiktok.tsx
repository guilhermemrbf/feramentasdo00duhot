import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle, CalendarDays, CheckCircle2, FileText, Hash, Library,
  ListVideo, Music2, Plus, Settings2, Sparkles, Upload, Users, Video, X,
} from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { AppShell, PageIntro } from "@/components/AppShell";

export const Route = createFileRoute("/automacao-tiktok")({
  head: () => ({
    meta: [
      { title: "Automação TikTok — 00duHot" },
      { name: "description", content: "Organize vídeos, legendas e prévias de programação para TikTok." },
    ],
  }),
  component: AutomacaoTikTok,
});

type Tab = "dashboard" | "contas" | "biblioteca" | "fila" | "conteudo" | "config";
type VideoItem = { id: string; name: string; size: number; type: string };
type QueueItem = { id: string; video: string; date: string; time: string; caption: string; hashtags: string };

const tabs = [
  { id: "dashboard", label: "Visão geral", icon: ListVideo },
  { id: "contas", label: "Contas", icon: Users },
  { id: "biblioteca", label: "Biblioteca", icon: Library },
  { id: "fila", label: "Agendamento", icon: CalendarDays },
  { id: "conteudo", label: "Legendas e hashtags", icon: FileText },
  { id: "config", label: "Configurações", icon: Settings2 },
] as const;

function AutomacaoTikTok() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("#tiktok #conteudo");
  const [quantity, setQuantity] = useState(3);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [times, setTimes] = useState("09:00, 13:00, 18:00");
  const [dailyLimit, setDailyLimit] = useState(3);
  const [intervalMinutes, setIntervalMinutes] = useState(120);
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const validMime = ["video/mp4", "video/quicktime", "video/webm"];
  const formatSize = (bytes: number) => bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const valid = files.filter((file) => validMime.includes(file.type) || /\.(mp4|mov|webm)$/i.test(file.name));
    setVideos((current) => [...current, ...valid.map((file) => ({
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name, size: file.size, type: file.type || "tipo não identificado",
    }))]);
    setNotice(valid.length !== files.length ? "Alguns arquivos foram ignorados. Use vídeos MP4, MOV ou WEBM." : "");
    event.target.value = "";
  };

  const removeVideo = (id: string) => {
    const removed = videos.find((video) => video.id === id);
    setVideos((current) => current.filter((video) => video.id !== id));
    if (removed) setQueue((current) => current.filter((post) => post.video !== removed.name));
  };

  const timeSlots = useMemo(() => times.split(",").map((value) => value.trim())
    .filter((value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)), [times]);

  const generatePreview = () => {
    if (!videos.length) {
      setNotice("Adicione pelo menos um vídeo antes de montar a prévia.");
      setTab("biblioteca");
      return;
    }
    if (!timeSlots.length) {
      setNotice("Informe pelo menos um horário válido, por exemplo: 09:00, 13:00.");
      return;
    }
    const count = Math.max(1, Math.min(100, Number(quantity) || 1));
    const perDay = Math.max(1, Math.min(10, Number(dailyLimit) || 1));
    const base = new Date(`${startDate}T12:00:00`);
    const next = Array.from({ length: count }, (_, index) => {
      const date = new Date(base);
      date.setDate(base.getDate() + Math.floor(index / Math.min(perDay, timeSlots.length)));
      return {
        id: `preview-${index + 1}`,
        video: videos[index % videos.length].name,
        date: date.toLocaleDateString("pt-BR"),
        time: timeSlots[index % Math.min(perDay, timeSlots.length)],
        caption, hashtags,
      };
    });
    setQueue(next);
    setNotice("Prévia local criada. Ela não foi salva no servidor nem publicada no TikTok.");
    setTab("fila");
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageIntro eyebrow="PostKit · Automação" title="Automação TikTok"
          description="Prepare vídeos, organize conteúdos em lote e revise uma programação antes de conectar sua conta TikTok." />
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-5">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <p><strong>Modo de preparação:</strong> biblioteca, legendas e fila funcionam localmente nesta sessão. A conta ainda não está conectada, os arquivos não são enviados ao servidor e nenhuma publicação real é feita.</p>
        </div>
        {notice && <div role="status" className="mt-4 flex items-start justify-between gap-3 rounded-md border border-border bg-secondary/50 px-4 py-3 text-xs">
          <span>{notice}</span><button aria-label="Fechar aviso" onClick={() => setNotice("")} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>}
        <nav aria-label="Seções da automação TikTok" className="mt-6 flex gap-2 overflow-x-auto border-b border-border pb-px">
          {tabs.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)}
            aria-current={tab === item.id ? "page" : undefined}
            className={"inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition-colors " + (tab === item.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <Icon className="size-4" />{item.label}
          </button>; })}
        </nav>

        {tab === "dashboard" && <section className="mt-6 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Contas conectadas" value="0" icon={Music2} detail="Conexão oficial pendente" />
            <Metric label="Vídeos nesta sessão" value={String(videos.length)} icon={Video} detail="Ainda não enviados ao servidor" />
            <Metric label="Itens na prévia" value={String(queue.length)} icon={CalendarDays} detail="Não são agendamentos reais" />
            <Metric label="Publicações realizadas" value="—" icon={CheckCircle2} detail="Disponível após integrar a API" />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <Panel title="Sua preparação">{queue.length ? <div className="space-y-3">
              <p className="text-sm text-muted-foreground">A última prévia tem {queue.length} itens para revisão.</p>
              <button onClick={() => setTab("fila")} className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Revisar prévia</button>
            </div> : <Empty icon={CalendarDays} title="Sua fila começa aqui" text="Adicione vídeos e monte uma prévia. A fila real será persistida na etapa de backend." />}</Panel>
            <Panel title="Próximos passos">
              <div className="space-y-3">
                <Step number="1" title="Adicionar vídeos" text="Selecione vários arquivos de uma vez." onClick={() => setTab("biblioteca")} />
                <Step number="2" title="Preparar legendas" text="Defina texto e hashtags padrão." onClick={() => setTab("conteudo")} />
                <Step number="3" title="Programar conteúdos" text="Confira a distribuição por data e horário." onClick={() => setTab("fila")} />
              </div>
            </Panel>
          </div>
          <Panel title="Fluxo planejado">
            <div className="grid gap-3 sm:grid-cols-3">
              <Info title="Biblioteca em lote" text="Organize os arquivos e prepare os metadados antes do upload." />
              <Info title="Fila com controle" text="Planeje datas, horários, limites e estados de cada conteúdo." />
              <Info title="Publicação oficial" text="A integração usará os fluxos e permissões disponíveis na API do TikTok." />
            </div>
          </Panel>
        </section>}

        {tab === "contas" && <section className="mt-6"><Panel title="Contas do TikTok">
          <Empty icon={Music2} title="Nenhuma conta conectada" text="A autorização será implementada com o fluxo oficial do TikTok. Não informe sua senha nesta tela." />
          <div className="mt-4 rounded-md border border-border bg-secondary/40 p-4">
            <p className="text-sm font-semibold">Preparação para integração</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
              <li>Aplicativo registrado no portal de desenvolvedores do TikTok.</li>
              <li>OAuth e escopos aprovados para o produto de publicação aplicável.</li>
              <li>Callback no servidor e armazenamento seguro dos tokens.</li>
              <li>Validação das restrições, revisão e requisitos da API antes de publicar.</li>
            </ul>
          </div>
          <button disabled title="Será habilitado na fase de backend" className="mt-4 inline-flex cursor-not-allowed items-center gap-2 rounded-md bg-primary/50 px-4 py-2 text-xs font-semibold text-primary-foreground"><Plus className="size-3" /> Conectar conta (backend pendente)</button>
        </Panel></section>}

        {tab === "biblioteca" && <section className="mt-6"><Panel title="Biblioteca de vídeos" action={<button onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Upload className="size-3" /> Selecionar vídeos</button>}>
          <input ref={fileInput} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" multiple className="hidden" onChange={addFiles} />
          <button onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
            event.preventDefault();
            const files = Array.from(event.dataTransfer.files);
            const valid = files.filter((file) => validMime.includes(file.type) || /\.(mp4|mov|webm)$/i.test(file.name));
            setVideos((current) => [...current, ...valid.map((file) => ({ id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: file.name, size: file.size, type: file.type || "tipo não identificado" }))]);
            if (valid.length !== files.length) setNotice("Alguns arquivos foram ignorados. Use vídeos MP4, MOV ou WEBM.");
          }} className="w-full rounded-lg border border-dashed border-border bg-secondary/20 px-6 py-10 text-center transition-colors hover:border-primary/60">
            <Upload className="mx-auto size-7 text-primary" /><p className="mt-3 text-sm font-semibold">Selecione ou arraste seus vídeos</p>
            <p className="mt-1 text-xs text-muted-foreground">MP4, MOV ou WEBM · seleção local, sem upload nesta etapa</p>
          </button>
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>{videos.length} arquivo(s) nesta sessão</span><span>{formatSize(videos.reduce((sum, video) => sum + video.size, 0))} no total</span></div>
          {videos.length ? <div className="mt-2 divide-y divide-border">{videos.map((video) => <div key={video.id} className="flex items-center gap-3 py-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-primary"><Video className="size-4" /></div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{video.name}</p><p className="text-xs text-muted-foreground">{formatSize(video.size)} · {video.type}</p></div>
            <button onClick={() => removeVideo(video.id)} aria-label={`Remover ${video.name}`} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="size-4" /></button>
          </div>)}</div> : <p className="mt-4 text-center text-xs text-muted-foreground">Nenhum vídeo selecionado ainda.</p>}
        </Panel></section>}

        {tab === "fila" && <section className="mt-6 space-y-4">
          <Panel title="Montar prévia de agendamento">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Quantidade de publicações"><input type="number" min={1} max={100} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="field" /></Field>
              <Field label="Data inicial"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="field" /></Field>
              <Field label="Horários separados por vírgula"><input value={times} onChange={(e) => setTimes(e.target.value)} className="field" placeholder="09:00, 13:00, 18:00" /></Field>
              <Field label="Limite por dia nesta prévia"><input type="number" min={1} max={10} value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} className="field" /></Field>
              <Field label="Intervalo mínimo (minutos)"><input type="number" min={1} value={intervalMinutes} onChange={(e) => setIntervalMinutes(Number(e.target.value))} className="field" /></Field>
              <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs leading-5 text-muted-foreground">O intervalo de {intervalMinutes} minutos é uma preferência local nesta fase; a validação real será feita no backend.</div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
              <div><p className="text-sm font-semibold">Gerar prévia local</p><p className="text-xs text-muted-foreground">Nenhum conteúdo será enviado ao TikTok.</p></div>
              <button onClick={generatePreview} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"><Sparkles className="size-3" /> Gerar prévia</button>
            </div>
          </Panel>
          <Panel title={`Prévia da fila · ${queue.length} itens`} action={queue.length ? <button onClick={() => { setQueue([]); setNotice("Prévia limpa; nenhuma publicação real foi afetada."); }} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Limpar</button> : undefined}>
            {queue.length ? <div className="max-h-[560px] overflow-auto">{queue.map((post) => <div key={post.id} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
              <span className="w-10 text-xs font-semibold text-muted-foreground">#{post.id.split("-").pop()}</span><Video className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{post.video}</p><p className="text-xs text-muted-foreground">{post.date} · {post.time}</p></div><span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold">Prévia</span>
            </div>)}</div> : <Empty icon={CalendarDays} title="Nenhuma prévia gerada" text="Selecione vídeos e gere uma programação para revisar a distribuição de datas e horários." />}
          </Panel>
        </section>}

        {tab === "conteudo" && <section className="mt-6"><Panel title="Legendas e hashtags">
          <div className="grid gap-5 lg:grid-cols-2">
            <Field label="Legenda padrão"><textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Escreva uma legenda base para seus vídeos..." className="field min-h-40" maxLength={2200} /></Field>
            <div className="space-y-2"><Field label="Hashtags padrão"><textarea value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#tiktok #conteudo" className="field min-h-40" /></Field><p className="text-xs text-muted-foreground">{hashtags.trim() ? hashtags.trim().split(/\s+/).filter(Boolean).length : 0} itens separados por espaço.</p></div>
          </div>
          <div className="mt-5 rounded-lg border border-border p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Hash className="size-4 text-primary" /> Prévia do texto</div><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{caption || "Sua legenda aparecerá aqui."}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-primary">{hashtags || "Suas hashtags aparecerão aqui."}</p></div>
          <button onClick={() => setNotice("Texto mantido somente nesta sessão. A persistência será adicionada no backend.")} className="mt-4 rounded-md border border-border px-4 py-2 text-xs font-semibold">Conferir estado local</button>
        </Panel></section>}

        {tab === "config" && <section className="mt-6 space-y-4">
          <Panel title="Preferências de agendamento">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Fuso horário de referência"><select className="field" defaultValue="America/Bahia"><option value="America/Bahia">Bahia (America/Bahia)</option><option value="America/Sao_Paulo">São Paulo (America/Sao_Paulo)</option><option value="UTC">UTC</option></select></Field>
              <Field label="Limite diário padrão"><input type="number" min={1} max={10} value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} className="field" /></Field>
              <Field label="Intervalo mínimo padrão (minutos)"><input type="number" min={1} value={intervalMinutes} onChange={(e) => setIntervalMinutes(Number(e.target.value))} className="field" /></Field>
              <Field label="Horários padrão"><input value={times} onChange={(e) => setTimes(e.target.value)} className="field" /></Field>
            </div>
            <button onClick={() => setNotice("Preferências aplicadas somente à sessão atual.")} className="mt-5 rounded-md border border-border px-4 py-2 text-xs font-semibold">Aplicar nesta sessão</button>
          </Panel>
          <Panel title="Status da integração"><div className="flex items-start gap-3 rounded-md border border-border bg-secondary/30 p-4"><AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" /><div><p className="text-sm font-semibold">Backend ainda não conectado</p><p className="mt-1 text-xs leading-5 text-muted-foreground">A próxima etapa inclui autenticação, armazenamento privado, OAuth e processamento de publicações em fila. Tokens e segredos nunca devem ficar no frontend.</p></div></div></Panel>
        </section>}
      </main>
    </AppShell>
  );
}

function Metric({ label, value, icon: Icon, detail }: { label: string; value: string; icon: typeof CalendarDays; detail: string }) {
  return <div className="rounded-lg border border-border bg-card p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{label}</span><Icon className="size-4 text-primary" /></div><p className="mt-3 font-display text-2xl font-bold">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></div>;
}
function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-5"><div className="flex items-center justify-between gap-4 border-b border-border pb-4"><h2 className="font-display text-base font-semibold">{title}</h2>{action}</div><div className="pt-4">{children}</div></div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">{label}</span>{children}</label>;
}
function Empty({ icon: Icon, title, text }: { icon: typeof CalendarDays; title: string; text: string }) {
  return <div className="py-10 text-center"><Icon className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">{title}</p><p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-muted-foreground">{text}</p></div>;
}
function Step({ number, title, text, onClick }: { number: string; title: string; text: string; onClick: () => void }) {
  return <button onClick={onClick} className="flex w-full items-start gap-3 rounded-md border border-border p-3 text-left transition-colors hover:border-primary/50"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary">{number}</span><span><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{text}</span></span></button>;
}
function Info({ title, text }: { title: string; text: string }) {
  return <div className="rounded-md border border-border bg-secondary/20 p-4"><p className="text-sm font-semibold">{title}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p></div>;
}
