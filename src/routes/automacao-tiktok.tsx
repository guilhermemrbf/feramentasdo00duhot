import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Hash,
  Instagram,
  Library,
  ListVideo,
  Music2,
  Settings2,
  Sparkles,
  Upload,
  Users,
  Video,
  X,
} from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { AppShell, PageIntro } from "@/components/AppShell";

export const Route = createFileRoute("/automacao-tiktok")({
  head: () => ({
    meta: [
      { title: "Automação TikTok — 00duHot" },
      {
        name: "description",
        content: "Prepare vídeos, legendas e lembretes para publicação manual no TikTok.",
      },
    ],
  }),
  component: AutomacaoTikTok,
});

type Tab = "dashboard" | "contas" | "biblioteca" | "fila" | "conteudo" | "config";
type VideoItem = { id: string; name: string; size: number; type: string; file: File };
type QueueItem = {
  id: string;
  videoId: string;
  video: string;
  date: string;
  time: string;
  caption: string;
  hashtags: string;
  published: boolean;
};

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
  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const valid = files.filter(
      (file) => validMime.includes(file.type) || /\.(mp4|mov|webm)$/i.test(file.name),
    );
    setVideos((current) => [
      ...current,
      ...valid.map((file) => ({
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size: file.size,
        type: file.type || "tipo não identificado",
        file,
      })),
    ]);
    setNotice(
      valid.length !== files.length
        ? "Alguns arquivos foram ignorados. Use vídeos MP4, MOV ou WEBM."
        : "",
    );
    event.target.value = "";
  };

  const removeVideo = (id: string) => {
    const removed = videos.find((video) => video.id === id);
    setVideos((current) => current.filter((video) => video.id !== id));
    if (removed) setQueue((current) => current.filter((post) => post.videoId !== id));
  };

  const timeSlots = useMemo(
    () =>
      times
        .split(",")
        .map((value) => value.trim())
        .filter((value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)),
    [times],
  );

  const downloadVideo = (post: QueueItem) => {
    const video = videos.find((item) => item.id === post.videoId);
    if (!video) {
      setNotice(
        "Este arquivo não está mais disponível nesta sessão. Selecione o vídeo novamente na biblioteca.",
      );
      return;
    }
    const url = URL.createObjectURL(video.file);
    const link = document.createElement("a");
    link.href = url;
    link.download = video.name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`Download iniciado: ${video.name}. Depois, envie o arquivo pelo TikTok Studio.`);
  };

  const copyPostText = async (post: QueueItem) => {
    const text = [post.caption.trim(), post.hashtags.trim()].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Legenda e hashtags copiadas. Cole-as no TikTok Studio antes de publicar.");
    } catch {
      setNotice(
        "Não foi possível acessar a área de transferência. Copie a legenda manualmente pela seção de conteúdo.",
      );
    }
  };

  const markPublished = (id: string) => {
    setQueue((current) =>
      current.map((post) => (post.id === id ? { ...post, published: true } : post)),
    );
    setNotice(
      "Item marcado como publicado manualmente. O projeto não consegue confirmar a publicação no TikTok.",
    );
  };

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
        videoId: videos[index % videos.length].id,
        video: videos[index % videos.length].name,
        date: date.toLocaleDateString("pt-BR"),
        time: timeSlots[index % Math.min(perDay, timeSlots.length)],
        caption,
        hashtags,
        published: false,
      };
    });
    setQueue(next);
    setNotice("Prévia local criada. Ela não foi salva no servidor nem publicada no TikTok.");
    setTab("fila");
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="PostKit · Publicação multiplataforma"
          title="Automatic Post"
          description="Gerencie a preparação de vídeos para TikTok e Instagram em uma única área de trabalho."
        />
        <div
          className="mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2"
          aria-label="Plataforma de publicação"
        >
          <span className="px-2 text-xs font-semibold text-muted-foreground">PLATAFORMA</span>
          <span
            aria-current="page"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            <Music2 className="size-4" /> TikTok
          </span>
          <Link
            to="/automacao-instagram"
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Instagram className="size-4" /> Instagram
          </Link>
        </div>
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-5">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <p>
            <strong>Envio manual:</strong> arquivos e fila ficam somente nesta sessão do navegador.
            Use o TikTok Studio para enviar e agendar; este projeto não faz publicação automática.
          </p>
        </div>
        <div className="mt-3 rounded-lg border border-border bg-secondary/40 p-3 text-xs leading-5 text-muted-foreground">
          O Content Posting API (Direct Post e envio de rascunhos) exige revisão e não pode ser
          usado por aplicativos privados para as próprias contas ou contas da equipe.{" "}
          <a
            className="font-semibold text-primary underline"
            href="https://developers.tiktok.com/docs/en/content-sharing-guidelines"
            target="_blank"
            rel="noreferrer"
          >
            Diretrizes de compartilhamento
          </a>{" "}
          ·{" "}
          <a
            className="font-semibold text-primary underline"
            href="https://developers.tiktok.com/docs/en/app-review-guidelines"
            target="_blank"
            rel="noreferrer"
          >
            Regras de revisão
          </a>
          .
        </div>
        {notice && (
          <div
            role="status"
            className="mt-4 flex items-start justify-between gap-3 rounded-md border border-border bg-secondary/50 px-4 py-3 text-xs"
          >
            <span>{notice}</span>
            <button
              aria-label="Fechar aviso"
              onClick={() => setNotice("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <nav
          aria-label="Seções da automação TikTok"
          className="mt-6 flex gap-2 overflow-x-auto border-b border-border pb-px"
        >
          {tabs.map((item) => {
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
              <Metric
                label="Publicação automática"
                value="Indisponível"
                icon={Music2}
                detail="Restrição de elegibilidade do TikTok"
              />
              <Metric
                label="Vídeos nesta sessão"
                value={String(videos.length)}
                icon={Video}
                detail="Ainda não enviados ao servidor"
              />
              <Metric
                label="Itens na fila manual"
                value={String(queue.length)}
                icon={CalendarDays}
                detail="Horários usados como lembretes"
              />
              <Metric
                label="Marcadas como publicadas"
                value={String(queue.filter((post) => post.published).length)}
                icon={CheckCircle2}
                detail="Confirmação manual, sem API"
              />
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <Panel title="Sua preparação">
                {queue.length ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Sua fila tem {queue.length} itens com lembretes para envio manual.
                    </p>
                    <button
                      onClick={() => setTab("fila")}
                      className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                    >
                      Abrir fila manual
                    </button>
                  </div>
                ) : (
                  <Empty
                    icon={CalendarDays}
                    title="Sua fila começa aqui"
                    text="Adicione vídeos e monte uma fila de preparação local para concluir cada publicação pelo TikTok Studio."
                  />
                )}
              </Panel>
              <Panel title="Próximos passos">
                <div className="space-y-3">
                  <Step
                    number="1"
                    title="Adicionar vídeos"
                    text="Selecione vários arquivos de uma vez."
                    onClick={() => setTab("biblioteca")}
                  />
                  <Step
                    number="2"
                    title="Preparar legendas"
                    text="Defina texto e hashtags padrão."
                    onClick={() => setTab("conteudo")}
                  />
                  <Step
                    number="3"
                    title="Programar conteúdos"
                    text="Confira a distribuição por data e horário."
                    onClick={() => setTab("fila")}
                  />
                </div>
              </Panel>
            </div>
            <Panel title="Fluxo planejado">
              <div className="grid gap-3 sm:grid-cols-3">
                <Info
                  title="Biblioteca em lote"
                  text="Organize os arquivos e prepare os metadados antes do upload."
                />
                <Info
                  title="Fila com controle"
                  text="Planeje datas, horários, limites e estados de cada conteúdo."
                />
                <Info
                  title="Envio manual oficial"
                  text="Conclua o upload, agendamento e publicação dentro do TikTok Studio."
                />
              </div>
            </Panel>
          </section>
        )}

        {tab === "contas" && (
          <section className="mt-6">
            <Panel title="Contas do TikTok">
              <Empty
                icon={Music2}
                title="A publicação automática não está disponível para este projeto privado"
                text="A API oficial não aprova ferramentas privadas para publicar nas contas próprias ou da equipe. Você ainda pode concluir o envio pelo TikTok Studio, sem compartilhar sua senha com este projeto."
              />
              <div className="mt-4 rounded-md border border-border bg-secondary/40 p-4">
                <p className="text-sm font-semibold">Preparação para integração</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
                  <li>Selecione os vídeos e monte a fila como lembrete local.</li>
                  <li>Baixe o vídeo, copie a legenda e envie pelo TikTok Studio.</li>
                  <li>Agende ou publique dentro do TikTok; depois, marque o item aqui.</li>
                </ul>
                <a
                  href="https://www.tiktok.com/tiktokstudio"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary"
                >
                  Abrir TikTok Studio <ExternalLink className="size-3" />
                </a>
              </div>
            </Panel>
          </section>
        )}

        {tab === "biblioteca" && (
          <section className="mt-6">
            <Panel
              title="Biblioteca de vídeos"
              action={
                <button
                  onClick={() => fileInput.current?.click()}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                >
                  <Upload className="size-3" /> Selecionar vídeos
                </button>
              }
            >
              <input
                ref={fileInput}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                multiple
                className="hidden"
                onChange={addFiles}
              />
              <button
                onClick={() => fileInput.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const files = Array.from(event.dataTransfer.files);
                  const valid = files.filter(
                    (file) => validMime.includes(file.type) || /\.(mp4|mov|webm)$/i.test(file.name),
                  );
                  setVideos((current) => [
                    ...current,
                    ...valid.map((file) => ({
                      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                      name: file.name,
                      size: file.size,
                      type: file.type || "tipo não identificado",
                      file,
                    })),
                  ]);
                  if (valid.length !== files.length)
                    setNotice("Alguns arquivos foram ignorados. Use vídeos MP4, MOV ou WEBM.");
                }}
                className="w-full rounded-lg border border-dashed border-border bg-secondary/20 px-6 py-10 text-center transition-colors hover:border-primary/60"
              >
                <Upload className="mx-auto size-7 text-primary" />
                <p className="mt-3 text-sm font-semibold">Selecione ou arraste seus vídeos</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  MP4, MOV ou WEBM · seleção local, sem upload nesta etapa
                </p>
              </button>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>{videos.length} arquivo(s) nesta sessão</span>
                <span>
                  {formatSize(videos.reduce((sum, video) => sum + video.size, 0))} no total
                </span>
              </div>
              {videos.length ? (
                <div className="mt-2 divide-y divide-border">
                  {videos.map((video) => (
                    <div key={video.id} className="flex items-center gap-3 py-3">
                      <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-primary">
                        <Video className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{video.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatSize(video.size)} · {video.type}
                        </p>
                      </div>
                      <button
                        onClick={() => removeVideo(video.id)}
                        aria-label={`Remover ${video.name}`}
                        className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Nenhum vídeo selecionado ainda.
                </p>
              )}
            </Panel>
          </section>
        )}

        {tab === "fila" && (
          <section className="mt-6 space-y-4">
            <Panel title="Montar prévia de agendamento">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Quantidade de publicações">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="field"
                  />
                </Field>
                <Field label="Data inicial">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="field"
                  />
                </Field>
                <Field label="Horários separados por vírgula">
                  <input
                    value={times}
                    onChange={(e) => setTimes(e.target.value)}
                    className="field"
                    placeholder="09:00, 13:00, 18:00"
                  />
                </Field>
                <Field label="Limite por dia nesta prévia">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(Number(e.target.value))}
                    className="field"
                  />
                </Field>
                <Field label="Intervalo mínimo (minutos)">
                  <input
                    type="number"
                    min={1}
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                    className="field"
                  />
                </Field>
                <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs leading-5 text-muted-foreground">
                  O intervalo de {intervalMinutes} minutos é uma preferência local nesta fase; a
                  validação real será feita no backend.
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
                <div>
                  <p className="text-sm font-semibold">Gerar prévia local</p>
                  <p className="text-xs text-muted-foreground">
                    Nenhum conteúdo será enviado ao TikTok.
                  </p>
                </div>
                <button
                  onClick={generatePreview}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                >
                  <Sparkles className="size-3" /> Gerar prévia
                </button>
              </div>
            </Panel>
            <Panel
              title={`Fila de publicação manual · ${queue.length} itens`}
              action={
                queue.length ? (
                  <button
                    onClick={() => {
                      setQueue([]);
                      setNotice("Fila local limpa; nenhuma publicação real foi afetada.");
                    }}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Limpar fila
                  </button>
                ) : undefined
              }
            >
              {queue.length ? (
                <div className="max-h-[720px] overflow-auto">
                  {queue.map((post) => (
                    <div key={post.id} className="border-b border-border py-4 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="w-10 text-xs font-semibold text-muted-foreground">
                          #{post.id.split("-").pop()}
                        </span>
                        <Video className="size-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{post.video}</p>
                          <p className="text-xs text-muted-foreground">
                            Lembrete: {post.date} · {post.time}
                          </p>
                        </div>
                        <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold">
                          {post.published ? "Marcado manualmente" : "Pendente"}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 pl-12">
                        <button
                          onClick={() => downloadVideo(post)}
                          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                        >
                          <Download className="size-3" /> Baixar vídeo
                        </button>
                        <button
                          onClick={() => void copyPostText(post)}
                          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
                        >
                          <Copy className="size-3" /> Copiar legenda
                        </button>
                        <a
                          href="https://www.tiktok.com/tiktokstudio"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
                        >
                          Abrir TikTok Studio <ExternalLink className="size-3" />
                        </a>
                        {!post.published && (
                          <button
                            onClick={() => markPublished(post.id)}
                            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
                          >
                            <Check className="size-3" /> Marcar publicado
                          </button>
                        )}
                      </div>
                      <p className="mt-2 pl-12 text-xs leading-5 text-muted-foreground">
                        Revise e publique no TikTok Studio. Este horário é um lembrete; a publicação
                        só ocorre dentro do TikTok.
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  icon={CalendarDays}
                  title="Fila vazia"
                  text="Selecione vídeos, defina horários e gere uma fila local. Você poderá baixar cada vídeo e copiar o texto para concluir o envio no TikTok Studio."
                />
              )}
            </Panel>
          </section>
        )}

        {tab === "conteudo" && (
          <section className="mt-6">
            <Panel title="Legendas e hashtags">
              <div className="grid gap-5 lg:grid-cols-2">
                <Field label="Legenda padrão">
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Escreva uma legenda base para seus vídeos..."
                    className="field min-h-40"
                    maxLength={2200}
                  />
                </Field>
                <div className="space-y-2">
                  <Field label="Hashtags padrão">
                    <textarea
                      value={hashtags}
                      onChange={(e) => setHashtags(e.target.value)}
                      placeholder="#tiktok #conteudo"
                      className="field min-h-40"
                    />
                  </Field>
                  <p className="text-xs text-muted-foreground">
                    {hashtags.trim() ? hashtags.trim().split(/\s+/).filter(Boolean).length : 0}{" "}
                    itens separados por espaço.
                  </p>
                </div>
              </div>
              <div className="mt-5 rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Hash className="size-4 text-primary" /> Prévia do texto
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                  {caption || "Sua legenda aparecerá aqui."}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-primary">
                  {hashtags || "Suas hashtags aparecerão aqui."}
                </p>
              </div>
              <button
                onClick={() =>
                  setNotice(
                    "Texto mantido somente nesta sessão. A persistência será adicionada no backend.",
                  )
                }
                className="mt-4 rounded-md border border-border px-4 py-2 text-xs font-semibold"
              >
                Conferir estado local
              </button>
            </Panel>
          </section>
        )}

        {tab === "config" && (
          <section className="mt-6 space-y-4">
            <Panel title="Preferências de agendamento">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Fuso horário de referência">
                  <select className="field" defaultValue="America/Bahia">
                    <option value="America/Bahia">Bahia (America/Bahia)</option>
                    <option value="America/Sao_Paulo">São Paulo (America/Sao_Paulo)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </Field>
                <Field label="Limite diário padrão">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(Number(e.target.value))}
                    className="field"
                  />
                </Field>
                <Field label="Intervalo mínimo padrão (minutos)">
                  <input
                    type="number"
                    min={1}
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                    className="field"
                  />
                </Field>
                <Field label="Horários padrão">
                  <input
                    value={times}
                    onChange={(e) => setTimes(e.target.value)}
                    className="field"
                  />
                </Field>
              </div>
              <button
                onClick={() => setNotice("Preferências aplicadas somente à sessão atual.")}
                className="mt-5 rounded-md border border-border px-4 py-2 text-xs font-semibold"
              >
                Aplicar nesta sessão
              </button>
            </Panel>
            <Panel title="Publicação no TikTok">
              <div className="flex items-start gap-3 rounded-md border border-border bg-secondary/30 p-4">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold">O TikTok Studio conclui o envio</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    O projeto prepara a mídia e o texto. Para este aplicativo privado, a publicação
                    deve ser feita pelo próprio usuário no TikTok Studio.
                  </p>
                </div>
              </div>
            </Panel>
          </section>
        )}
      </main>
    </AppShell>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  detail,
}: {
  label: string;
  value: string;
  icon: typeof CalendarDays;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-3 font-display text-2xl font-bold">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}
function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {action}
      </div>
      <div className="pt-4">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function Empty({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof CalendarDays;
  title: string;
  text: string;
}) {
  return (
    <div className="py-10 text-center">
      <Icon className="mx-auto size-7 text-muted-foreground" />
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}
function Step({
  number,
  title,
  text,
  onClick,
}: {
  number: string;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-md border border-border p-3 text-left transition-colors hover:border-primary/50"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary">
        {number}
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{text}</span>
      </span>
    </button>
  );
}
function Info({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/20 p-4">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}
