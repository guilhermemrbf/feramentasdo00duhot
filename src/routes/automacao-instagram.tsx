import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Hash,
  Instagram,
  Library,
  ListVideo,
  Plus,
  Settings2,
  Sparkles,
  Upload,
  Users,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { AppShell, PageIntro } from "@/components/AppShell";
import { WorkspaceGate, type Workspace } from "@/components/postkit/WorkspaceGate";
import { supabase } from "@/integrations/supabase/client";
import { startInstagramOAuth } from "@/lib/api/instagram-oauth.functions";
import { zonedDateTimeToIso } from "@/lib/scheduling";

export const Route = createFileRoute("/automacao-instagram")({
  head: () => ({
    meta: [
      { title: "Automação Instagram — 00duHot" },
      {
        name: "description",
        content:
          "Organize vídeos, legendas e prévias de agendamento para Instagram em um único lugar.",
      },
    ],
  }),
  component: AutomacaoInstagram,
});

type Tab = "dashboard" | "contas" | "biblioteca" | "fila" | "conteudo" | "config";
type VideoItem = { id: string; name: string; size: number; type: string; storagePath: string; status: string };
type QueueItem = {
  id: string;
  assetId: string;
  video: string;
  scheduledAt: string;
  date: string;
  time: string;
  caption: string;
  hashtags: string;
};

const tabItems = [
  { id: "dashboard", label: "Visão geral", icon: ListVideo },
  { id: "contas", label: "Contas", icon: Users },
  { id: "biblioteca", label: "Biblioteca", icon: Library },
  { id: "fila", label: "Agendamento", icon: CalendarDays },
  { id: "conteudo", label: "Legendas e hashtags", icon: FileText },
  { id: "config", label: "Configurações", icon: Settings2 },
] as const;

function AutomacaoInstagram() {
  return <WorkspaceGate>{(workspace) => <InstagramWorkspacePage workspace={workspace} />}</WorkspaceGate>;
}

function InstagramWorkspacePage({ workspace }: { workspace: Workspace }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("#reels #instagram");
  const [quantity, setQuantity] = useState(3);
  const [startDate, setStartDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [times, setTimes] = useState("09:00, 13:00, 18:00");
  const [dailyLimit, setDailyLimit] = useState(3);
  const [intervalMinutes, setIntervalMinutes] = useState(120);
  const [notice, setNotice] = useState("");
  const [connectedAccounts, setConnectedAccounts] = useState<Array<{ id: string; username: string; account_type: string | null; connection_status: string }>>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [queueSaved, setQueueSaved] = useState(false);
  const [savingQueue, setSavingQueue] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void supabase
      .from("instagram_accounts")
      .select("id,username,account_type,connection_status")
      .eq("workspace_id", workspace.id)
      .then(({ data, error }) => {
        if (error) setNotice("Não foi possível carregar as contas. Confira se as migrations do PostKit foram aplicadas no Supabase de desenvolvimento.");
        else {
          setConnectedAccounts(data ?? []);
          setSelectedAccountId((current) => current || data?.find((account) => account.connection_status === "connected")?.id || "");
        }
      });
  }, [workspace.id]);

  useEffect(() => {
    void supabase
      .from("media_assets")
      .select("id,original_filename,size_bytes,mime_type,storage_path,status")
      .eq("workspace_id", workspace.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setNotice("Não foi possível carregar a biblioteca. Confira se as migrations do PostKit foram aplicadas.");
        else setVideos((data ?? []).map((asset) => ({
          id: asset.id,
          name: asset.original_filename,
          size: Number(asset.size_bytes),
          type: asset.mime_type,
          storagePath: asset.storage_path,
          status: asset.status,
        })));
      });
  }, [workspace.id]);

  useEffect(() => {
    void supabase
      .from("posts")
      .select("idempotency_key,media_asset_id,scheduled_at,caption,media_assets(original_filename)")
      .eq("workspace_id", workspace.id)
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true })
      .then(({ data }) => {
        if (!data?.length) return;
        const saved: QueueItem[] = data.flatMap((post) => {
          if (!post.scheduled_at) return [];
          const when = new Date(post.scheduled_at);
          return [{
            id: post.idempotency_key,
            assetId: post.media_asset_id,
            video: post.media_assets?.original_filename ?? "Vídeo",
            scheduledAt: post.scheduled_at,
            date: new Intl.DateTimeFormat("pt-BR", { timeZone: workspace.timezone, dateStyle: "short" }).format(when),
            time: new Intl.DateTimeFormat("pt-BR", { timeZone: workspace.timezone, hour: "2-digit", minute: "2-digit" }).format(when),
            caption: post.caption,
            hashtags: "",
          }];
        });
        setQueue(saved);
        setQueueSaved(true);
      });
  }, [workspace.id, workspace.timezone]);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("instagram");
    if (result === "connected") setNotice("Conta do Instagram conectada com sucesso.");
    if (result === "connection_failed") setNotice("A conexão do Instagram não foi concluída. Revise as configurações Meta e tente novamente.");
  }, []);

  const connectInstagram = async () => {
    setConnecting(true);
    setNotice("");
    try {
      const { authorizationUrl } = await startInstagramOAuth({ data: { workspaceId: workspace.id } });
      window.location.assign(authorizationUrl);
    } catch {
      setNotice("Não foi possível iniciar a conexão. Confirme o login, o acesso ao workspace e as configurações do servidor.");
      setConnecting(false);
    }
  };

  const scheduledCount = queue.length;
  const videoCount = videos.length;
  const formattedSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;

  const uploadFiles = async (files: File[]) => {
    const valid = files.filter((file) => ["video/mp4", "video/quicktime"].includes(file.type) && file.size <= 500 * 1024 * 1024);
    if (!valid.length) {
      setNotice("Selecione vídeos MP4 ou MOV com até 500 MB.");
      return;
    }
    setNotice("Enviando vídeos para a biblioteca privada do workspace…");
    const uploaded: VideoItem[] = [];
    for (const file of valid) {
      const id = crypto.randomUUID();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "video.mp4";
      const storagePath = `${workspace.id}/${id}/${safeName}`;
      const { error: uploadError } = await supabase.storage.from("postkit-media").upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) {
        setNotice("O envio falhou. Confira o bucket privado postkit-media e as políticas de acesso do workspace.");
        continue;
      }
      const { error: assetError } = await supabase.from("media_assets").insert({
        id,
        workspace_id: workspace.id,
        original_filename: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
        status: "uploaded",
      });
      if (assetError) {
        await supabase.storage.from("postkit-media").remove([storagePath]);
        setNotice("O arquivo foi enviado, mas não pôde ser registrado na biblioteca. Confira as migrations do PostKit.");
        continue;
      }
      uploaded.push({ id, name: file.name, size: file.size, type: file.type, storagePath, status: "uploaded" });
    }
    setVideos((current) => [...uploaded, ...current]);
    if (uploaded.length === valid.length) setNotice(`${uploaded.length} vídeo(s) enviado(s) para a biblioteca privada.`);
  };

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void uploadFiles(files).catch(() => setNotice("O envio foi interrompido. Confira sua conexão e atualize a biblioteca antes de reenviar."));
  };

  const removeVideo = (id: string) => {
    const removed = videos.find((video) => video.id === id);
    setVideos((current) => current.filter((video) => video.id !== id));
    if (removed) {
      setQueue((current) => current.filter((post) => post.assetId !== removed.id));
    }
  };

  const timeSlots = useMemo(
    () =>
      times
        .split(",")
        .map((value) => value.trim())
        .filter((value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)),
    [times],
  );

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
    try {
      const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
      const base = new Date(Date.UTC(startYear, startMonth - 1, startDay));
      const next: QueueItem[] = Array.from({ length: count }, (_, index) => {
        const date = new Date(base);
        date.setUTCDate(base.getUTCDate() + Math.floor(index / Math.min(perDay, timeSlots.length)));
        const dateValue = date.toISOString().slice(0, 10);
        const time = timeSlots[index % Math.min(perDay, timeSlots.length)];
        const scheduledAt = zonedDateTimeToIso(dateValue, time, workspace.timezone);
        return {
          id: crypto.randomUUID(),
          assetId: videos[index % videos.length].id,
          video: videos[index % videos.length].name,
          scheduledAt,
          date: new Intl.DateTimeFormat("pt-BR", { timeZone: workspace.timezone, dateStyle: "short" }).format(new Date(scheduledAt)),
          time,
          caption,
          hashtags,
        };
      });
      const minimumIntervalMs = Math.max(1, Number(intervalMinutes) || 1) * 60 * 1000;
      if (next.some((post, index) => index > 0 && new Date(post.scheduledAt).getTime() - new Date(next[index - 1].scheduledAt).getTime() < minimumIntervalMs)) {
        setNotice("Os horários ficam mais próximos do que o intervalo mínimo configurado.");
        return;
      }
      if (next.some((post) => new Date(post.scheduledAt).getTime() <= Date.now())) {
        setNotice("Escolha apenas horários futuros no fuso horário do workspace.");
        return;
      }
      setQueue(next);
      setQueueSaved(false);
      setNotice("Prévia criada. Revise os horários antes de salvar o agendamento.");
      setTab("fila");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível montar os horários neste fuso.");
    }
  };

  const saveQueue = async () => {
    if (!queue.length || !selectedAccountId) {
      setNotice("Conecte e selecione uma conta profissional antes de salvar o agendamento.");
      return;
    }
    if (queue.some((post) => post.caption.trim().length + (post.hashtags.trim() ? post.hashtags.trim().length + 2 : 0) > 2200)) {
      setNotice("A legenda combinada com as hashtags excede o limite de 2.200 caracteres do Instagram.");
      return;
    }
    setSavingQueue(true);
    try {
      const { error } = await supabase.from("posts").upsert(
        queue.map((post) => ({
          idempotency_key: post.id,
          workspace_id: workspace.id,
          instagram_account_id: selectedAccountId,
          media_asset_id: post.assetId,
          content_type: "reel",
          caption: [post.caption.trim(), post.hashtags.trim()].filter(Boolean).join("\n\n"),
          hashtags: post.hashtags.trim().split(/\s+/).filter(Boolean),
          scheduled_at: post.scheduledAt,
          timezone: workspace.timezone,
          status: "scheduled",
        })),
        { onConflict: "idempotency_key", ignoreDuplicates: true },
      );
      if (error) {
        setNotice("Não foi possível salvar. Confira conta, vídeos, permissões e migrations do Supabase.");
        return;
      }
      setQueueSaved(true);
      setNotice("Agendamento salvo no Supabase. A publicação automática será ativada quando o worker estiver configurado.");
    } catch {
      setNotice("Não foi possível confirmar o salvamento. Reabra os agendamentos antes de tentar novamente.");
    } finally {
      setSavingQueue(false);
    }
  };

  const clearQueue = () => {
    setQueue([]);
    setQueueSaved(false);
    setNotice("Prévia limpa. Nenhuma publicação real foi afetada.");
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="PostKit · Automação"
          title="Automação Instagram"
            description="Conecte contas profissionais, envie vídeos para a biblioteca privada e organize sua programação do Instagram."
        />

        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-5">
          <AlertCircle className="size-4 shrink-0 text-amber-500" />
          <span>
            <strong>Publicação por etapas:</strong> contas, biblioteca privada e fila agendada estão integradas. A publicação automática começa quando o worker de produção estiver configurado.
          </span>
        </div>

        {notice && (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-md border border-border bg-secondary/50 px-4 py-3 text-xs">
            <span>{notice}</span>
            <button aria-label="Fechar aviso" onClick={() => setNotice("")} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
        )}

        <nav aria-label="Seções da automação Instagram" className="mt-6 flex gap-2 overflow-x-auto border-b border-border pb-px">
          {tabItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
                className={
                  "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition-colors " +
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
        </nav>

        {tab === "dashboard" && (
          <section className="mt-6 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Contas conectadas" value={String(connectedAccounts.filter((account) => account.connection_status === "connected").length)} icon={Instagram} detail="Instagram profissional" />
              <Metric label="Vídeos nesta sessão" value={String(videoCount)} icon={Video} detail="Ainda não enviados ao servidor" />
              <Metric label={queueSaved ? "Itens agendados" : "Itens na prévia"} value={String(scheduledCount)} icon={CalendarDays} detail={queueSaved ? "Salvos no workspace" : "Aguardando confirmação"} />
              <Metric label="Publicações realizadas" value="—" icon={CheckCircle2} detail="Disponível após integrar a Meta" />
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <Panel title="Sua preparação">
                {queue.length ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">A última prévia tem {queue.length} itens e pode ser revisada na seção Agendamento.</p>
                    <button onClick={() => setTab("fila")} className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Revisar prévia</button>
                  </div>
                ) : (
                  <Empty icon={CalendarDays} title="Sua fila começa aqui" text="Adicione vídeos à biblioteca e monte uma prévia da programação. A fila real será salva no backend." />
                )}
              </Panel>
              <Panel title="Próximos passos">
                <div className="space-y-3">
                  <Step number="1" title="Adicionar vídeos" text="Selecione arquivos do seu computador." onClick={() => setTab("biblioteca")} />
                  <Step number="2" title="Preparar legendas" text="Defina o texto e as hashtags padrão." onClick={() => setTab("conteudo")} />
                  <Step number="3" title="Montar a programação" text="Confira datas e horários na prévia." onClick={() => setTab("fila")} />
                </div>
              </Panel>
            </div>
          </section>
        )}

        {tab === "contas" && (
          <section className="mt-6">
            <Panel title="Contas do Instagram">
              {connectedAccounts.length ? (
                <div className="space-y-2">
                  {connectedAccounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between rounded-md border border-border px-4 py-3 text-sm">
                      <span>@{account.username}</span>
                      <span className="text-xs text-muted-foreground">{account.account_type ?? "Conta profissional"} · {account.connection_status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty icon={Instagram} title="Nenhuma conta conectada" text="Conecte uma conta profissional pelo fluxo oficial da Meta. Não informe sua senha do Instagram aqui." />
              )}
              <div className="mt-4 rounded-md border border-border bg-secondary/40 p-4">
                <p className="text-sm font-semibold">O que será necessário</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
                  <li>Aplicativo Meta com Instagram Login e as permissões de publicação aprovadas.</li>
                  <li>Domínio HTTPS e callback OAuth registrados no aplicativo Meta.</li>
                  <li>Supabase de desenvolvimento configurado e migrations do PostKit aplicadas.</li>
                </ul>
              </div>
              <button onClick={() => void connectInstagram()} disabled={connecting} className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                <Plus className="size-3" /> {connecting ? "Abrindo autorização…" : "Conectar conta"}
              </button>
            </Panel>
          </section>
        )}

        {tab === "biblioteca" && (
          <section className="mt-6 space-y-4">
            <Panel title="Biblioteca de vídeos" action={
              <button onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                <Upload className="size-3" /> Selecionar vídeos
              </button>
            }>
              <input ref={fileInput} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" multiple className="hidden" onChange={addFiles} />
              <button onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                event.preventDefault();
                void uploadFiles(Array.from(event.dataTransfer.files)).catch(() => setNotice("O envio foi interrompido. Confira sua conexão e atualize a biblioteca antes de reenviar."));
              }} className="w-full rounded-lg border border-dashed border-border bg-secondary/20 px-6 py-10 text-center transition-colors hover:border-primary/60">
                <Upload className="mx-auto size-7 text-primary" />
                <p className="mt-3 text-sm font-semibold">Selecione ou arraste seus vídeos</p>
                <p className="mt-1 text-xs text-muted-foreground">MP4 ou MOV · até 500 MB · armazenamento privado por workspace</p>
              </button>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>{videos.length} arquivo(s) nesta sessão</span>
                <span>{formattedSize(videos.reduce((total, video) => total + video.size, 0))} no total</span>
              </div>
              {videos.length ? (
                <div className="mt-2 divide-y divide-border">
                  {videos.map((video) => (
                    <div key={video.id} className="flex items-center gap-3 py-3">
                      <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-primary"><Video className="size-4" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{video.name}</p>
                        <p className="text-xs text-muted-foreground">{formattedSize(video.size)} · {video.type || "tipo não identificado"}</p>
                      </div>
                      <button onClick={() => removeVideo(video.id)} aria-label={`Remover ${video.name}`} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="size-4" /></button>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-4 text-center text-xs text-muted-foreground">Nenhum vídeo selecionado ainda.</p>}
            </Panel>
          </section>
        )}

        {tab === "fila" && (
          <section className="mt-6 space-y-4">
            <Panel title="Montar prévia de agendamento">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Quantidade de publicações">
                  <input type="number" min={1} max={100} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="field" />
                </Field>
                <Field label="Data inicial">
                  <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="field" />
                </Field>
                <Field label="Horários separados por vírgula">
                  <input value={times} onChange={(event) => setTimes(event.target.value)} className="field" placeholder="09:00, 13:00, 18:00" />
                </Field>
                <Field label="Limite por dia nesta prévia">
                  <input type="number" min={1} max={10} value={dailyLimit} onChange={(event) => setDailyLimit(Number(event.target.value))} className="field" />
                </Field>
                <Field label="Intervalo mínimo (minutos)">
                  <input type="number" min={1} value={intervalMinutes} onChange={(event) => setIntervalMinutes(Number(event.target.value))} className="field" />
                </Field>
                <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs leading-5 text-muted-foreground">
                  O intervalo de {intervalMinutes} minutos fica registrado como preferência de interface nesta fase. A validação real dos horários será implementada no backend.
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
                <div><p className="text-sm font-semibold">Gerar prévia local</p><p className="text-xs text-muted-foreground">Usa os arquivos selecionados e não envia nada ao Instagram.</p></div>
                <button onClick={generatePreview} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"><Sparkles className="size-3" /> Gerar prévia</button>
              </div>
            </Panel>
            <Panel title={`${queueSaved ? "Agendamentos salvos" : "Prévia da fila"} · ${queue.length} itens`} action={queue.length > 0 && !queueSaved ? <button onClick={clearQueue} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Limpar</button> : undefined}>
              {queue.length ? (
                <>
                  <Field label="Publicar em qual conta">
                    <select className="field" value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)}>
                      <option value="">Selecione uma conta conectada</option>
                      {connectedAccounts.filter((account) => account.connection_status === "connected").map((account) => (
                        <option key={account.id} value={account.id}>@{account.username}</option>
                      ))}
                    </select>
                  </Field>
                  <div className="mt-4 max-h-[560px] overflow-auto">
                    {queue.map((post, index) => (
                      <div key={post.id} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                        <span className="w-10 text-xs font-semibold text-muted-foreground">#{index + 1}</span>
                        <Video className="size-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{post.video}</p><p className="text-xs text-muted-foreground">{post.date} · {post.time} ({workspace.timezone})</p></div>
                        <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold">{queueSaved ? "Agendado" : "Prévia"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary/30 p-4">
                    <p className="max-w-xl text-xs leading-5 text-muted-foreground">Salvar registra a fila no Supabase. A publicação automática só começa depois que o worker de produção estiver ativo.</p>
                    <button onClick={() => void saveQueue()} disabled={savingQueue || queueSaved || !connectedAccounts.some((account) => account.id === selectedAccountId && account.connection_status === "connected")} className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                      {savingQueue ? "Salvando…" : queueSaved ? "Agendamento salvo" : "Salvar agendamento"}
                    </button>
                  </div>
                </>
              ) : <Empty icon={CalendarDays} title="Nenhuma prévia gerada" text="Selecione vídeos e gere uma programação para revisar a distribuição de datas e horários." />}
            </Panel>
          </section>
        )}

        {tab === "conteudo" && (
          <section className="mt-6">
            <Panel title="Legendas e hashtags">
              <div className="grid gap-5 lg:grid-cols-2">
                <Field label="Legenda padrão">
                  <textarea value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Escreva uma legenda base para seus vídeos..." className="field min-h-40" maxLength={2200} />
                </Field>
                <div className="space-y-2">
                  <Field label="Hashtags padrão">
                    <textarea value={hashtags} onChange={(event) => setHashtags(event.target.value)} placeholder="#reels #conteudo" className="field min-h-40" />
                  </Field>
                  <p className="text-xs text-muted-foreground">{hashtags.trim() ? hashtags.trim().split(/\s+/).filter(Boolean).length : 0} itens separados por espaço. As variações automáticas serão adicionadas depois.</p>
                </div>
              </div>
              <div className="mt-5 rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 text-sm font-semibold"><Hash className="size-4 text-primary" /> Prévia do texto</div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{caption || "Sua legenda aparecerá aqui."}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-primary">{hashtags || "Suas hashtags aparecerão aqui."}</p>
              </div>
              <button onClick={() => setNotice("Texto mantido somente nesta sessão. A persistência de legendas será adicionada no backend.")} className="mt-4 rounded-md border border-border px-4 py-2 text-xs font-semibold">Conferir estado local</button>
            </Panel>
          </section>
        )}

        {tab === "config" && (
          <section className="mt-6 space-y-4">
            <Panel title="Preferências de agendamento">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Fuso horário de referência">
                  <select className="field" defaultValue="America/Bahia"><option value="America/Bahia">Bahia (America/Bahia)</option><option value="America/Sao_Paulo">São Paulo (America/Sao_Paulo)</option><option value="UTC">UTC</option></select>
                </Field>
                <Field label="Limite diário padrão">
                  <input type="number" min={1} max={10} value={dailyLimit} onChange={(event) => setDailyLimit(Number(event.target.value))} className="field" />
                </Field>
                <Field label="Intervalo mínimo padrão (minutos)">
                  <input type="number" min={1} value={intervalMinutes} onChange={(event) => setIntervalMinutes(Number(event.target.value))} className="field" />
                </Field>
                <Field label="Horários padrão">
                  <input value={times} onChange={(event) => setTimes(event.target.value)} className="field" />
                </Field>
              </div>
              <button onClick={() => setNotice("Preferências aplicadas apenas à sessão atual. A gravação permanente será feita com o Supabase.")} className="mt-5 rounded-md border border-border px-4 py-2 text-xs font-semibold">Aplicar nesta sessão</button>
            </Panel>
            <Panel title="Status da integração">
              <div className="flex items-start gap-3 rounded-md border border-border bg-secondary/30 p-4">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <div><p className="text-sm font-semibold">Worker de publicação pendente</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Login, workspace, OAuth, biblioteca privada e fila persistida estão ligados ao Supabase. Falta ativar e validar o worker que envia os Reels no horário marcado. Nenhum segredo fica no frontend.</p></div>
              </div>
            </Panel>
          </section>
        )}
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
