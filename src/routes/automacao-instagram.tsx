import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Hash,
  Instagram,
  Library,
  LayoutDashboard,
  ListVideo,
  Repeat2,
  Plus,
  Settings2,
  Sparkles,
  Upload,
  Users,
  Video,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type Ref,
} from "react";
import { WorkspaceGate, type Workspace } from "@/components/postkit/WorkspaceGate";
import { supabase } from "@/integrations/supabase/client";
import { startInstagramOAuth } from "@/lib/api/instagram-oauth.functions";
import {
  enableInstagramWorker,
  getInstagramWorkerStatus,
} from "@/lib/api/instagram-worker.functions";
import { calendarDateInZone, zonedDateTimeToIso } from "@/lib/scheduling";
import { InstagramHistory } from "@/components/postkit/InstagramHistory";
import { InstagramDashboard } from "@/components/postkit/InstagramDashboard";
import { InstagramLoops } from "@/components/postkit/InstagramLoops";
import { InstagramStories } from "@/components/postkit/InstagramStories";
import { InstagramProfileDrafts } from "@/components/postkit/InstagramProfileDrafts";
import { DailyTimeSlots, ScheduleDate } from "@/components/postkit/DailyTimeSlots";
import { validatePostkitVideo } from "@/lib/postkit-media";

export const Route = createFileRoute("/automacao-instagram")({
  validateSearch: (search: Record<string, unknown>): { tab?: "perfis" } => ({
    tab: search.tab === "perfis" ? "perfis" : undefined,
  }),
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

type Tab =
  | "dashboard"
  | "perfis"
  | "contas"
  | "biblioteca"
  | "fila"
  | "stories"
  | "conteudo"
  | "config"
  | "historico"
  | "publicacoes"
  | "loops";
type VideoItem = {
  id: string;
  name: string;
  size: number;
  type: string;
  storagePath: string;
  status: string;
};
type QueueItem = {
  id: string;
  assetId: string;
  video: string;
  scheduledAt: string;
  date: string;
  time: string;
  caption: string;
  hashtags: string;
  accountId: string;
  accountName: string;
};

const tabGroups = [
  { label: "Geral", items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Publicar",
    items: [
      { id: "fila", label: "Agendar Reels", icon: CalendarDays },
      { id: "stories", label: "Stories", icon: Instagram },
      { id: "loops", label: "Loops de Reels", icon: Repeat2 },
    ],
  },
  {
    label: "Organizar",
    items: [
      { id: "biblioteca", label: "Biblioteca", icon: Library },
      { id: "contas", label: "Contas do Instagram", icon: Users },
      { id: "perfis", label: "Novos perfis", icon: Plus },
      { id: "conteudo", label: "Legendas e hashtags", icon: FileText },
    ],
  },
  {
    label: "Acompanhar",
    items: [
      { id: "publicacoes", label: "Fila de publicações", icon: ListVideo },
      { id: "historico", label: "Histórico", icon: CheckCircle2 },
      { id: "config", label: "Configurações", icon: Settings2 },
    ],
  },
] as const;

const tabItems = tabGroups.flatMap(
  ({ items }) => [...items] as ReadonlyArray<{ id: Tab; label: string }>,
);

const quickActions = [
  {
    tab: "contas",
    title: "Conectar nova conta",
    text: "Adicione a conta do Instagram em que você quer publicar.",
    icon: Users,
    tone: "bg-sky-500/10 text-sky-300",
  },
  {
    tab: "fila",
    title: "Agendar Reels",
    text: "Escolha seus vídeos e quando eles devem ser publicados.",
    icon: CalendarDays,
    tone: "bg-primary/10 text-primary",
  },
  {
    tab: "stories",
    title: "Preparar Stories",
    text: "Monte a prévia com figurinhas e receba um lembrete para postar.",
    icon: Instagram,
    tone: "bg-fuchsia-500/10 text-fuchsia-300",
  },
  {
    tab: "perfis",
    title: "Planejar um novo perfil",
    text: "Deixe nome, foto e bio prontos para criar o perfil no Instagram.",
    icon: Plus,
    tone: "bg-emerald-500/10 text-emerald-300",
  },
] as const;

function AutomacaoInstagram() {
  const { tab } = Route.useSearch();
  return (
    <WorkspaceGate>
      {(workspace) => (
        <InstagramWorkspacePage key={workspace.id} workspace={workspace} initialTab={tab} />
      )}
    </WorkspaceGate>
  );
}

function InstagramWorkspacePage({
  workspace,
  initialTab,
}: {
  workspace: Workspace;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "dashboard");
  const [storyAccount, setStoryAccount] = useState<{
    id: string;
    request: string;
    productUrl: string | null;
  }>();
  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("#reels #instagram");
  const [reelMode, setReelMode] = useState<"single" | "batch">("batch");
  const [singleVideoId, setSingleVideoId] = useState("");
  const [singleTime, setSingleTime] = useState("18:00");
  const [batchOrder, setBatchOrder] = useState("selection");
  const [quantity, setQuantity] = useState(3);
  const [startDate, setStartDate] = useState(() => calendarDateInZone(workspace.timezone));
  const [times, setTimes] = useState("09:00, 13:00, 18:00");
  const [dailyLimit, setDailyLimit] = useState(3);
  const [intervalMinutes, setIntervalMinutes] = useState(120);
  const [notice, setNotice] = useState("");
  const [connectedAccounts, setConnectedAccounts] = useState<
    Array<{ id: string; username: string; account_type: string | null; connection_status: string }>
  >([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [queueSaved, setQueueSaved] = useState(false);
  const [previewSettings, setPreviewSettings] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [savingQueue, setSavingQueue] = useState(false);
  const [connecting, setConnecting] = useState<"instagram_login" | "facebook_login" | null>(null);
  const [workerActive, setWorkerActive] = useState<boolean | null>(null);
  const [activatingWorker, setActivatingWorker] = useState(false);
  const [extraAccountIds, setExtraAccountIds] = useState<string[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [repeatVideos, setRepeatVideos] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadLock = useRef(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [videosLoaded, setVideosLoaded] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    void supabase
      .from("instagram_accounts")
      .select("id,username,account_type,connection_status")
      .eq("workspace_id", workspace.id)
      .then(({ data, error }) => {
        if (error)
          setNotice(
            "Não foi possível carregar suas contas do Instagram. Atualize a página para tentar novamente.",
          );
        else {
          setAccountsLoaded(true);
          setConnectedAccounts(data ?? []);
          setSelectedAccountId(
            (current) =>
              current ||
              data?.find((account) => account.connection_status === "connected")?.id ||
              "",
          );
        }
      });
  }, [workspace.id]);

  useEffect(() => {
    void supabase
      .from("media_assets")
      .select("id,original_filename,size_bytes,mime_type,storage_path,status")
      .eq("workspace_id", workspace.id)
      .is("archived_at", null)
      .in("mime_type", ["video/mp4", "video/quicktime"])
      .in("status", ["uploaded", "ready"])
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error)
          setNotice(
            "Não foi possível carregar seus vídeos. Atualize a página para tentar novamente.",
          );
        else {
          setVideosLoaded(true);
          setSelectedVideoIds((data ?? []).map((asset) => asset.id));
          setVideos(
            (data ?? []).map((asset) => ({
              id: asset.id,
              name: asset.original_filename,
              size: Number(asset.size_bytes),
              type: asset.mime_type,
              storagePath: asset.storage_path,
              status: asset.status,
            })),
          );
        }
      });
  }, [workspace.id]);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("instagram");
    if (result === "connected") {
      setTab("contas");
      setNotice("Conexão concluída. Confira o @ em Suas contas.");
    }
    if (result === "connection_failed") {
      setTab("contas");
      const reason = new URLSearchParams(window.location.search).get("instagram_reason");
      const reasonLabels: Record<string, string> = {
        meta_denied: "a Meta não concluiu a autorização",
        state_validation: "a validação de segurança da autorização",
        authorization_code_missing: "o código de autorização retornado pela Meta",
        workspace_access: "o acesso ao espaço de trabalho",
        facebook_code_exchange: "a troca do código de autorização do Facebook",
        facebook_token_missing: "o retorno do token temporário do Facebook",
        facebook_token_exchange: "a troca pelo token de longa duração do Facebook",
        facebook_long_token_missing: "o retorno do token de longa duração do Facebook",
        facebook_pages_lookup: "a busca pelas Páginas do Facebook",
        facebook_pages_empty: "a Meta não retornou Páginas acessíveis para esta conta",
        facebook_page_token_missing: "o token de acesso das Páginas autorizadas",
        instagram_not_linked_to_page:
          "a conta profissional não apareceu vinculada às Páginas autorizadas",
        facebook_instagram_profile_lookup: "a leitura dos dados da conta profissional do Instagram",
        no_linked_account: "a busca por Instagram profissional vinculado a uma Página",
        account_save: "o salvamento da conta do Instagram",
        token_save: "o armazenamento seguro da autorização",
        account_activation: "a ativação da conta no sistema",
        server_configuration_or_unexpected: "uma configuração do servidor ou erro inesperado",
      };
      const detail = reason
        ? (reasonLabels[reason] ?? "uma etapa não identificada")
        : "uma etapa não identificada";
      setNotice(`A conexão parou em ${detail}. Escolha uma opção abaixo para tentar novamente.`);
    }
  }, []);

  const connectInstagram = async (mode: "instagram_login" | "facebook_login") => {
    setConnecting(mode);
    setNotice("");
    try {
      const { authorizationUrl } = await startInstagramOAuth({
        data: { workspaceId: workspace.id, mode },
      });
      window.location.assign(authorizationUrl);
    } catch {
      setNotice(
        "Não foi possível abrir a tela de autorização. Atualize a página e tente conectar novamente.",
      );
      setConnecting(null);
    }
  };

  const videoCount = videos.length;
  const formattedSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;

  const uploadFiles = async (files: File[]) => {
    if (uploadLock.current || !files.length) return;
    uploadLock.current = true;
    setUploading(true);
    setNotice("Enviando vídeos para sua biblioteca privada…");
    const uploaded: VideoItem[] = [];
    const errors: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        setUploadProgress(`Arquivo ${index + 1} de ${files.length}: ${file.name}`);
        let mimeType: string;
        try {
          mimeType = await validatePostkitVideo(file);
        } catch (error) {
          errors.push(
            `${file.name}: ${error instanceof Error ? error.message : "Arquivo inválido"}`,
          );
          continue;
        }
        const id = crypto.randomUUID();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "video.mp4";
        const storagePath = `${workspace.id}/${id}/${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("postkit-media")
          .upload(storagePath, file, {
            contentType: mimeType,
            upsert: false,
          });
        if (uploadError) {
          errors.push(`${file.name}: falha no envio.`);
          continue;
        }
        const { error: assetError } = await supabase.from("media_assets").insert({
          id,
          workspace_id: workspace.id,
          original_filename: file.name,
          storage_path: storagePath,
          mime_type: mimeType,
          size_bytes: file.size,
          status: "uploaded",
        });
        if (assetError) {
          await supabase.storage.from("postkit-media").remove([storagePath]);
          errors.push(`${file.name}: não foi possível registrar na biblioteca.`);
          continue;
        }
        uploaded.push({
          id,
          name: file.name,
          size: file.size,
          type: mimeType,
          storagePath,
          status: "uploaded",
        });
      }
    } finally {
      uploadLock.current = false;
      setUploading(false);
      setUploadProgress("");
      setVideos((current) => [...uploaded, ...current]);
      setSelectedVideoIds((current) => [...uploaded.map((file) => file.id), ...current]);
    }
    setNotice(
      `${uploaded.length} vídeo(s) salvo(s). ${errors.slice(0, 3).join(" ")}${errors.length > 3 ? ` E mais ${errors.length - 3} arquivo(s) com erro.` : ""}`,
    );
  };

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void uploadFiles(files).catch(() =>
      setNotice(
        "O envio foi interrompido. Confira sua conexão e atualize a biblioteca antes de reenviar.",
      ),
    );
  };

  const timeSlots = useMemo(
    () =>
      times
        .split(",")
        .map((value) => value.trim())
        .filter((value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value))
        .filter((value, index, all) => all.indexOf(value) === index)
        .sort(),
    [times],
  );

  const readyAccounts = connectedAccounts.filter(
    (account) => account.connection_status === "connected",
  );
  const reelAccounts = readyAccounts.filter(
    (account) => account.id === selectedAccountId || extraAccountIds.includes(account.id),
  );
  const reelVideos = useMemo(() => {
    const ids = new Set(selectedVideoIds);
    return videos.filter((video) => ids.has(video.id));
  }, [selectedVideoIds, videos]);
  const scheduleVideos =
    reelMode === "batch" ? reelVideos : videos.filter((video) => video.id === singleVideoId);
  const reelsPerAccount =
    reelMode === "single" ? 1 : Math.max(1, Math.min(100, Number(quantity) || 1));
  const allowedPerDay = Math.max(1, Math.min(10, Number(dailyLimit) || 1));
  const scheduleTimes = reelMode === "single" ? [singleTime].filter(Boolean) : timeSlots;
  const slotsPerDay = Math.min(allowedPerDay, scheduleTimes.length);
  const currentSettings = JSON.stringify([
    reelAccounts.map((account) => account.id),
    scheduleVideos.map((video) => video.id),
    reelMode,
    singleTime,
    batchOrder,
    startDate,
    times,
    quantity,
    dailyLimit,
    intervalMinutes,
    repeatVideos,
    caption,
    hashtags,
  ]);
  const previewOutdated = !queueSaved && previewSettings !== currentSettings;

  const generatePreview = () => {
    setPreviewError("");
    if (!reelAccounts.length) {
      setPreviewError("Marque pelo menos uma conta no primeiro passo.");
      return;
    }
    if (!scheduleVideos.length) {
      setPreviewError("Escolha pelo menos um vídeo no segundo passo.");
      return;
    }
    if (
      !scheduleTimes.length ||
      (reelMode === "batch" && times.split(",").some((slot) => !slot.trim()))
    ) {
      setPreviewError("Preencha todos os horários ou remova os campos vazios.");
      return;
    }
    if (!repeatVideos && reelsPerAccount > scheduleVideos.length) {
      setPreviewError("Escolha mais vídeos ou reduza o total de Reels por conta.");
      return;
    }
    if (reelsPerAccount * reelAccounts.length > 500) {
      setPreviewError("Agende até 500 Reels por vez, somando todas as contas selecionadas.");
      return;
    }
    if (!startDate) {
      setPreviewError("Escolha o primeiro dia da programação.");
      return;
    }
    try {
      const ordered = [...scheduleVideos];
      if (reelMode === "batch" && batchOrder === "random") {
        for (let index = ordered.length - 1; index > 0; index--) {
          const other = Math.floor(Math.random() * (index + 1));
          [ordered[index], ordered[other]] = [ordered[other], ordered[index]];
        }
      }
      const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
      const base = new Date(Date.UTC(startYear, startMonth - 1, startDay));
      const next: QueueItem[] = Array.from({ length: reelsPerAccount }, (_, index) => {
        const date = new Date(base);
        date.setUTCDate(base.getUTCDate() + Math.floor(index / slotsPerDay));
        const dateValue = date.toISOString().slice(0, 10);
        const time = scheduleTimes[index % slotsPerDay];
        const scheduledAt = zonedDateTimeToIso(dateValue, time, workspace.timezone);
        return {
          id: crypto.randomUUID(),
          assetId: ordered[index % ordered.length].id,
          video: ordered[index % ordered.length].name,
          accountId: reelAccounts[0].id,
          accountName: reelAccounts[0].username,
          scheduledAt,
          date: new Intl.DateTimeFormat("pt-BR", {
            timeZone: workspace.timezone,
            dateStyle: "short",
          }).format(new Date(scheduledAt)),
          time,
          caption,
          hashtags,
        };
      });
      const minimumIntervalMs = Math.max(1, Number(intervalMinutes) || 1) * 60 * 1000;
      if (
        next.some(
          (post, index) =>
            index > 0 &&
            new Date(post.scheduledAt).getTime() - new Date(next[index - 1].scheduledAt).getTime() <
              minimumIntervalMs,
        )
      ) {
        setPreviewError("Separe mais os horários ou ajuste o intervalo mínimo em Mais opções.");
        return;
      }
      if (next.some((post) => new Date(post.scheduledAt).getTime() <= Date.now())) {
        setPreviewError(
          "Algum horário já passou. Escolha horários mais tarde ou comece em outro dia.",
        );
        return;
      }
      setQueue(
        reelAccounts.flatMap((account) =>
          next.map((post) => ({
            ...post,
            id: crypto.randomUUID(),
            accountId: account.id,
            accountName: account.username,
          })),
        ),
      );
      setQueueSaved(false);
      setPreviewSettings(currentSettings);
      setNotice("");
      requestAnimationFrame(() => reviewHeading.current?.focus());
    } catch {
      setPreviewError("Confira se a data e os horários existem no fuso do espaço de trabalho.");
    }
  };

  const saveQueue = async () => {
    if (savingQueue || queueSaved || previewOutdated) return;
    if (
      queue.some(
        (post) =>
          !connectedAccounts.some(
            (account) => account.id === post.accountId && account.connection_status === "connected",
          ),
      )
    ) {
      setNotice("A conta selecionada não está conectada. Reconecte antes de salvar.");
      return;
    }
    if (
      queue.some(
        (post) =>
          !Number.isFinite(Date.parse(post.scheduledAt)) ||
          Date.parse(post.scheduledAt) <= Date.now(),
      )
    ) {
      setNotice("Há horários vencidos ou inválidos. Gere uma nova prévia antes de salvar.");
      return;
    }
    if (!queue.length) {
      setNotice("Conecte e selecione uma conta profissional antes de salvar o agendamento.");
      return;
    }
    if (
      queue.some(
        (post) =>
          post.caption.trim().length +
            (post.hashtags.trim() ? post.hashtags.trim().length + 2 : 0) >
          2200,
      )
    ) {
      setNotice(
        "A legenda combinada com as hashtags excede o limite de 2.200 caracteres do Instagram.",
      );
      return;
    }
    setSavingQueue(true);
    try {
      const { error } = await supabase.from("posts").upsert(
        queue.map((post) => ({
          idempotency_key: post.id,
          workspace_id: workspace.id,
          instagram_account_id: post.accountId,
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
        setNotice(
          "Não foi possível salvar. Confira conta, vídeos, permissões e migrations do Supabase.",
        );
        return;
      }
      setQueueSaved(true);
      setHistoryRefresh((value) => value + 1);
      setNotice("Programação salva. Acompanhe cada publicação na seção Histórico.");
    } catch {
      setNotice(
        "Não foi possível confirmar o salvamento. Reabra os agendamentos antes de tentar novamente.",
      );
    } finally {
      setSavingQueue(false);
    }
  };

  useEffect(() => {
    if (tab !== "config") return;
    let current = true;
    void getInstagramWorkerStatus({ data: { workspaceId: workspace.id } })
      .then(({ active }) => {
        if (current) setWorkerActive(active);
      })
      .catch(() => {
        if (current) setWorkerActive(false);
      });
    return () => {
      current = false;
    };
  }, [tab, workspace.id]);

  const activateWorker = async () => {
    if (activatingWorker || workerActive === true) return;
    setActivatingWorker(true);
    setNotice("");
    try {
      const result = await enableInstagramWorker({ data: { workspaceId: workspace.id } });
      setWorkerActive(result.active);
      setNotice(
        result.active
          ? "Processamento automático ativado. A fila será verificada periodicamente; confira cada resultado no Histórico."
          : "Não foi possível confirmar a ativação do processamento.",
      );
    } catch {
      setNotice(
        "Não foi possível ativar o processamento. Confira se você é administradora do workspace.",
      );
    } finally {
      setActivatingWorker(false);
    }
  };

  const clearQueue = () => {
    setQueue([]);
    setQueueSaved(false);
    setNotice("Prévia limpa. Nenhuma publicação real foi afetada.");
  };

  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-6">
      <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:rounded-xl lg:border lg:border-border lg:bg-card lg:p-3">
        <div className="mb-3 flex items-center gap-2 lg:px-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Instagram className="size-4" />
          </span>
          <span className="font-display text-sm font-semibold">Automação Instagram</span>
        </div>
        <label className="block text-xs font-medium text-muted-foreground lg:hidden">
          Seção do painel
          <select
            className="field mt-1"
            value={tab}
            onChange={(event) => setTab(event.target.value as Tab)}
          >
            {tabItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <nav aria-label="Seções da automação Instagram" className="hidden space-y-4 lg:block">
          {tabGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              {group.items.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-current={tab === id ? "page" : undefined}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground aria-[current=page]:bg-primary/15 aria-[current=page]:text-primary"
                >
                  <Icon className="size-4 shrink-0" /> {label}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 rounded-2xl bg-[image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[32px_32px]">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:px-5">
          <h1 className="font-display text-xl font-semibold">
            {tabItems.find((item) => item.id === tab)?.label}
          </h1>
          {tab === "dashboard" && (
            <button
              type="button"
              onClick={() => {
                setReelMode("single");
                setTab("fila");
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="size-4" /> Nova publicação
            </button>
          )}
        </header>

        {notice && (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-md border border-border bg-secondary/50 px-4 py-3 text-sm">
            <span role="status">{notice}</span>
            <button
              aria-label="Fechar aviso"
              onClick={() => setNotice("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {tab === "dashboard" && (
          <section className="mt-4 space-y-4">
            <InstagramDashboard
              workspaceId={workspace.id}
              timezone={workspace.timezone}
              accountCount={accountsLoaded ? readyAccounts.length : null}
              videoCount={videosLoaded ? videoCount : null}
              refreshKey={historyRefresh}
              onAccounts={() => setTab("contas")}
              onLibrary={() => setTab("biblioteca")}
              onSchedule={() => setTab("fila")}
              onQueue={() => setTab("publicacoes")}
              onHistory={() => setTab("historico")}
            />
            <Panel title="O que você quer fazer?">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {quickActions.map(({ tab: target, title, text, icon: Icon, tone }) => (
                  <button
                    key={target}
                    type="button"
                    className="group rounded-xl border border-border bg-background/40 p-4 text-left hover:border-primary/50 hover:bg-secondary/40"
                    onClick={() => setTab(target)}
                  >
                    <span className={`inline-flex rounded-lg p-2 ${tone}`}>
                      <Icon className="size-5" />
                    </span>
                    <span className="mt-3 flex items-center justify-between gap-2 text-sm font-semibold">
                      {title}
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {text}
                    </span>
                  </button>
                ))}
              </div>
            </Panel>
          </section>
        )}

        <div hidden={tab !== "perfis"}>
          <InstagramProfileDrafts
            workspaceId={workspace.id}
            accounts={readyAccounts}
            videos={videos}
            onConnect={() => setTab("contas")}
            onLibrary={() => setTab("biblioteca")}
            onReels={(accountId, daily, videoIds) => {
              if (queue.length && !queueSaved) {
                setNotice("Revise ou salve a prévia de Reels já aberta antes de carregar a ficha.");
                setTab("fila");
                return;
              }
              const available = videoIds.filter((id) => videos.some((video) => video.id === id));
              setQueue([]);
              setQueueSaved(false);
              setReelMode("batch");
              setSelectedAccountId(accountId);
              setExtraAccountIds([]);
              setSelectedVideoIds(available);
              setDailyLimit(daily);
              setQuantity(available.length || daily);
              setRepeatVideos(false);
              setNotice(
                "Conta e preferências da ficha carregadas. Gere uma prévia antes de agendar.",
              );
              setTab("fila");
            }}
            onStories={(accountId, productUrl) => {
              setStoryAccount({ id: accountId, request: crypto.randomUUID(), productUrl });
              setTab("stories");
            }}
          />
        </div>

        <div hidden={tab !== "stories"}>
          <InstagramStories
            workspaceId={workspace.id}
            timezone={workspace.timezone}
            accounts={readyAccounts}
            onConnect={() => setTab("contas")}
            profileAccount={storyAccount}
          />
        </div>

        {(tab === "historico" || tab === "publicacoes") && (
          <InstagramHistory
            key={tab}
            mode={tab === "publicacoes" ? "queue" : "history"}
            accounts={connectedAccounts}
            onSchedule={() => setTab("fila")}
            workspaceId={workspace.id}
            timezone={workspace.timezone}
            refreshKey={historyRefresh}
          />
        )}

        <div hidden={tab !== "loops"}>
          {tab === "loops" && (
            <InstagramLoops
              workspaceId={workspace.id}
              timezone={workspace.timezone}
              accounts={readyAccounts}
              videos={videos.filter(
                (video) =>
                  ["uploaded", "ready"].includes(video.status) &&
                  ["video/mp4", "video/quicktime"].includes(video.type),
              )}
              onAccounts={() => setTab("contas")}
              onLibrary={() => setTab("biblioteca")}
            />
          )}
        </div>

        {tab === "contas" && (
          <section className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Panel title="Conectar uma conta">
              <p className="text-sm text-muted-foreground">
                Escolha como entrar. Você vai confirmar o acesso na tela oficial e voltar para cá. A
                conta precisa ser profissional, do tipo empresa ou criador.
              </p>
              <div className="mt-4 grid gap-3">
                <div className="space-y-2 rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/5 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Instagram className="size-4 text-fuchsia-300" /> Entrar pelo Instagram
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Use os dados da própria conta do Instagram que você quer adicionar.
                  </p>
                  <button
                    type="button"
                    onClick={() => void connectInstagram("instagram_login")}
                    disabled={!!connecting}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {connecting === "instagram_login"
                      ? "Abrindo autorização…"
                      : "Continuar com Instagram"}
                    <ArrowRight className="size-4" />
                  </button>
                </div>
                <div className="space-y-2 rounded-xl border border-sky-500/25 bg-sky-500/5 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Users className="size-4 text-sky-300" /> Entrar pelo Facebook
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Escolha esta opção se seu Instagram está ligado a uma Página do Facebook que
                    você gerencia.
                  </p>
                  <button
                    type="button"
                    onClick={() => void connectInstagram("facebook_login")}
                    disabled={!!connecting}
                    className="inline-flex items-center gap-2 rounded-md border border-sky-500/30 px-4 py-2 text-sm font-semibold hover:bg-sky-500/10 disabled:opacity-50"
                  >
                    {connecting === "facebook_login"
                      ? "Abrindo autorização…"
                      : "Continuar com Facebook"}
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>
            </Panel>
            <Panel title="Suas contas">
              <p className="mb-3 text-sm text-muted-foreground">
                Quando aparecer como conectada, a conta já pode ser escolhida ao preparar uma
                publicação.
              </p>
              {connectedAccounts.length ? (
                <div className="space-y-2">
                  {connectedAccounts.map((account) => {
                    const ready = account.connection_status === "connected";
                    return (
                      <div
                        key={account.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Instagram className="size-5 shrink-0 text-fuchsia-300" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">@{account.username}</p>
                            <p className="text-xs text-muted-foreground">
                              {ready
                                ? "Pode ser usada em Reels e Stories"
                                : "Conecte esta conta novamente"}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${ready ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}
                        >
                          {ready ? "Conectada" : "Precisa de atenção"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty
                  icon={Instagram}
                  title="Nenhuma conta conectada"
                  text="Depois da autorização, o nome de usuário da conta aparece aqui."
                />
              )}
              {!!readyAccounts.length && (
                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary"
                  onClick={() => setTab("fila")}
                >
                  Ir para o agendamento de Reels <ArrowRight className="size-4" />
                </button>
              )}
            </Panel>
          </section>
        )}

        {tab === "biblioteca" && (
          <section className="mt-6 space-y-4">
            <Panel
              title="Vídeos para Reels"
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
                accept="video/mp4,video/quicktime,.mp4,.mov"
                disabled={uploading}
                multiple
                className="hidden"
                onChange={addFiles}
              />
              <button
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void uploadFiles(Array.from(event.dataTransfer.files)).catch(() =>
                    setNotice(
                      "O envio foi interrompido. Confira sua conexão e atualize a biblioteca antes de reenviar.",
                    ),
                  );
                }}
                className="w-full rounded-lg border border-dashed border-border bg-secondary/20 px-6 py-10 text-center transition-colors hover:border-primary/60"
              >
                <Upload className="mx-auto size-7 text-primary" />
                <p className="mt-3 text-sm font-semibold" role="status">
                  {uploading ? uploadProgress : "Selecione ou arraste seus vídeos"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  MP4 ou MOV, até 500 MB por vídeo. Os arquivos ficam na sua biblioteca privada.
                </p>
              </button>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {reelVideos.length} de {videoCount} para agendar
                </span>
                <span>
                  {formattedSize(videos.reduce((total, video) => total + video.size, 0))} no total
                </span>
              </div>
              {videos.length ? (
                <div className="mt-2 divide-y divide-border">
                  {videos.map((video) => (
                    <label
                      key={video.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-3 hover:bg-secondary/40"
                    >
                      <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-primary">
                        <Video className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{video.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formattedSize(video.size)} · {video.type || "tipo não identificado"}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        aria-label={`Usar ${video.name}`}
                        checked={selectedVideoIds.includes(video.id)}
                        onChange={(event) =>
                          setSelectedVideoIds((current) =>
                            event.target.checked
                              ? [...current, video.id]
                              : current.filter((id) => id !== video.id),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Seus vídeos aparecem aqui depois do envio.
                </p>
              )}
              {!!videoCount && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="text-sm text-muted-foreground">
                    Marque os vídeos que você quer usar na próxima programação.
                  </p>
                  <button
                    type="button"
                    disabled={!reelVideos.length}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    onClick={() => setTab("fila")}
                  >
                    Ir para os dias e horários <ArrowRight className="size-4" />
                  </button>
                </div>
              )}
            </Panel>
          </section>
        )}

        {tab === "fila" && (
          <section className="mt-6 space-y-4">
            <Panel title="Agendar Reels">
              <p className="mb-5 text-sm text-muted-foreground">
                Escolha o que vai ao ar e quando. Depois de confirmar, os Reels entram na
                programação automática.
              </p>
              <div
                role="group"
                aria-label="Tipo de agendamento"
                className="mb-4 grid gap-2 sm:grid-cols-2"
              >
                {(
                  [
                    { id: "single", title: "Um Reel", help: "Escolha um vídeo e um horário." },
                    {
                      id: "batch",
                      title: "Vários Reels",
                      help: "Monte uma programação com vários vídeos.",
                    },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={reelMode === option.id}
                    onClick={() => setReelMode(option.id)}
                    className="rounded-lg border border-border p-3 text-left hover:bg-secondary/40 aria-pressed:border-primary/50 aria-pressed:bg-primary/10"
                  >
                    <span className="block text-sm font-semibold">{option.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{option.help}</span>
                  </button>
                ))}
              </div>
              <fieldset className="mb-5 rounded-md border border-border p-3">
                <legend className="px-1 text-sm font-semibold">1. Em quais contas?</legend>
                {!!readyAccounts.length && (
                  <p className="mb-2 text-xs text-muted-foreground">
                    Se marcar mais de uma conta, cada uma recebe a mesma programação.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {readyAccounts.map((account) => (
                    <label
                      key={account.id}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-checked:border-primary/50 has-checked:bg-primary/10"
                    >
                      <input
                        type="checkbox"
                        checked={
                          account.id === selectedAccountId || extraAccountIds.includes(account.id)
                        }
                        onChange={(event) => {
                          if (event.target.checked)
                            setExtraAccountIds((current) => [...current, account.id]);
                          else {
                            if (account.id === selectedAccountId) setSelectedAccountId("");
                            setExtraAccountIds((current) =>
                              current.filter((id) => id !== account.id),
                            );
                          }
                        }}
                      />{" "}
                      @{account.username}
                    </label>
                  ))}
                </div>
                {!readyAccounts.length && (
                  <button
                    type="button"
                    className="py-1 text-sm font-semibold text-primary underline"
                    onClick={() => setTab("contas")}
                  >
                    Conectar minha primeira conta
                  </button>
                )}
              </fieldset>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                <div>
                  <h3 className="text-sm font-semibold">
                    {reelMode === "single" ? "2. Qual vídeo?" : "2. Quais vídeos?"}
                  </h3>
                  {reelMode === "single" && videos.length > 0 ? (
                    <select
                      aria-label="Escolha o vídeo do Reel"
                      className="field mt-2"
                      value={singleVideoId}
                      onChange={(event) => setSingleVideoId(event.target.value)}
                    >
                      <option value="">Selecione na biblioteca</option>
                      {videos.map((video) => (
                        <option key={video.id} value={video.id}>
                          {video.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {scheduleVideos.length === 1
                        ? "1 vídeo escolhido"
                        : scheduleVideos.length
                          ? `${scheduleVideos.length} vídeos escolhidos`
                          : "Escolha os vídeos na Biblioteca."}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary"
                  onClick={() => setTab("biblioteca")}
                >
                  {reelMode === "single"
                    ? "Abrir biblioteca"
                    : reelVideos.length
                      ? "Trocar os vídeos"
                      : "Escolher vídeos"}
                </button>
              </div>
              <details className="mb-5 rounded-lg border border-border p-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  Legenda e hashtags (opcional)
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Legenda padrão">
                    <textarea
                      className="field min-h-20"
                      value={caption}
                      maxLength={2200}
                      onChange={(event) => setCaption(event.target.value)}
                    />
                  </Field>
                  <Field label="Hashtags ao final da legenda">
                    <textarea
                      className="field min-h-20"
                      value={hashtags}
                      maxLength={2200}
                      onChange={(event) => setHashtags(event.target.value)}
                    />
                  </Field>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Esse texto vale para o lote inteiro. Você pode mudar a legenda de um vídeo na
                  prévia.
                </p>
              </details>
              <h3 className="mb-1 text-sm font-semibold">3. Quando publicar?</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                {reelMode === "batch" &&
                  "Os horários se repetem a cada dia até publicar o total escolhido. "}
                Fuso da agenda: {workspace.timezone}.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <ScheduleDate
                  value={startDate}
                  timezone={workspace.timezone}
                  onChange={setStartDate}
                />
                {reelMode === "single" ? (
                  <Field label="Horário de publicação">
                    <input
                      type="time"
                      className="field"
                      value={singleTime}
                      onChange={(event) => setSingleTime(event.target.value)}
                    />
                  </Field>
                ) : (
                  <>
                    <Field label="Quantos Reels por conta no total?">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={quantity}
                        onChange={(event) => setQuantity(Number(event.target.value))}
                        className="field"
                      />
                    </Field>
                    <div className="md:col-span-2">
                      <DailyTimeSlots value={times} onChange={setTimes} limit={10} />
                    </div>
                    <Field label="Em que ordem?">
                      <select
                        className="field"
                        value={batchOrder}
                        onChange={(event) => setBatchOrder(event.target.value)}
                      >
                        <option value="selection">Na ordem da biblioteca</option>
                        <option value="random">Embaralhar na prévia</option>
                      </select>
                    </Field>
                  </>
                )}
              </div>
              {reelMode === "batch" && (
                <details className="mt-4 rounded-lg border border-border p-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Mais opções de publicação
                  </summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Limite de Reels por dia em cada conta">
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={dailyLimit}
                        onChange={(event) => setDailyLimit(Number(event.target.value))}
                        className="field"
                      />
                    </Field>
                    <Field label="Tempo mínimo entre Reels (minutos)">
                      <input
                        type="number"
                        min={1}
                        value={intervalMinutes}
                        onChange={(event) => setIntervalMinutes(Number(event.target.value))}
                        className="field"
                      />
                    </Field>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Se você adicionar mais horários que o limite por dia, serão usados os primeiros
                    horários do dia.
                  </p>
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={repeatVideos}
                      onChange={(event) => setRepeatVideos(event.target.checked)}
                    />{" "}
                    Repetir vídeos quando faltarem arquivos para completar a programação.
                  </label>
                </details>
              )}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
                <div>
                  <p className="text-sm font-semibold">4. Confira a programação</p>
                  <p className="text-xs text-muted-foreground">
                    {reelAccounts.length && slotsPerDay
                      ? `${reelsPerAccount} por conta × ${reelAccounts.length} ${reelAccounts.length === 1 ? "conta" : "contas"} · Até ${Math.min(slotsPerDay, reelsPerAccount)} por dia em cada conta.`
                      : "Escolha as contas, os vídeos e os horários para ver a prévia."}
                  </p>
                </div>
                <button
                  onClick={generatePreview}
                  disabled={savingQueue}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                >
                  <Sparkles className="size-3" /> Ver prévia dos Reels
                </button>
                {previewError && (
                  <p role="alert" className="basis-full text-sm text-amber-300">
                    {previewError}
                  </p>
                )}
              </div>
            </Panel>
            <Panel
              title={queueSaved ? "Reels agendados" : "Prévia da programação"}
              headingRef={reviewHeading}
              action={
                queue.length > 0 && !queueSaved ? (
                  <button
                    onClick={clearQueue}
                    disabled={savingQueue}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Limpar prévia
                  </button>
                ) : undefined
              }
            >
              {queue.length ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    {queue.length === 1 ? "1 publicação" : `${queue.length} publicações`} · Confira
                    os vídeos, contas e horários abaixo.
                  </p>
                  {previewOutdated && (
                    <p
                      role="status"
                      className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
                    >
                      Você mudou a programação. Clique em “Ver prévia dos Reels” para revisar os
                      novos dados.
                    </p>
                  )}
                  <div className="mt-4 max-h-[560px] overflow-auto">
                    {queue.map((post, index) => (
                      <div
                        key={post.id}
                        className="flex items-center gap-3 border-b border-border py-3 last:border-0"
                      >
                        <span className="w-10 text-xs font-semibold text-muted-foreground">
                          #{index + 1}
                        </span>
                        <Video className="size-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {post.video} · @{post.accountName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {post.date} · {post.time} ({workspace.timezone})
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                            {post.caption || "Sem legenda"}
                          </p>
                          {!queueSaved && !previewOutdated && (
                            <details className="mt-2 text-xs">
                              <summary className="cursor-pointer font-semibold text-primary">
                                Editar só esta legenda
                              </summary>
                              <label className="mt-2 block">
                                Legenda deste Reel
                                <textarea
                                  className="field mt-1 min-h-16"
                                  value={post.caption}
                                  maxLength={2200}
                                  disabled={savingQueue}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setQueue((current) =>
                                      current.map((item) =>
                                        item.id === post.id ? { ...item, caption: value } : item,
                                      ),
                                    );
                                  }}
                                />
                              </label>
                              <p className="mt-1 text-muted-foreground">
                                As hashtags do agendamento continuam ao final.
                              </p>
                            </details>
                          )}
                        </div>
                        <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold">
                          {queueSaved ? "Agendado" : "Prévia"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary/30 p-4">
                    <p className="max-w-xl text-xs leading-5 text-muted-foreground">
                      Confira contas, vídeos e horários. Salvar autoriza a programação deste lote; o
                      Histórico mostra o resultado individual de cada publicação.
                    </p>
                    <button
                      onClick={() => void saveQueue()}
                      disabled={
                        savingQueue ||
                        queueSaved ||
                        previewOutdated ||
                        queue.some(
                          (post) =>
                            !connectedAccounts.some(
                              (account) =>
                                account.id === post.accountId &&
                                account.connection_status === "connected",
                            ),
                        )
                      }
                      className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {savingQueue
                        ? "Salvando…"
                        : queueSaved
                          ? "Agendamento salvo"
                          : "Confirmar agendamento"}
                    </button>
                  </div>
                </>
              ) : (
                <Empty
                  icon={CalendarDays}
                  title="Nenhuma prévia gerada"
                  text="Selecione vídeos e gere uma programação para revisar a distribuição de datas e horários."
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
                    onChange={(event) => setCaption(event.target.value)}
                    placeholder="Escreva uma legenda base para seus vídeos..."
                    className="field min-h-40"
                    maxLength={2200}
                  />
                </Field>
                <div className="space-y-2">
                  <Field label="Hashtags padrão">
                    <textarea
                      value={hashtags}
                      onChange={(event) => setHashtags(event.target.value)}
                      placeholder="#reels #conteudo"
                      className="field min-h-40"
                    />
                  </Field>
                  <p className="text-xs text-muted-foreground">
                    {hashtags.trim() ? hashtags.trim().split(/\s+/).filter(Boolean).length : 0}{" "}
                    itens separados por espaço. As variações automáticas serão adicionadas depois.
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
                    "Texto mantido somente nesta sessão. A persistência de legendas será adicionada no backend.",
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
                  <input className="field" value={workspace.timezone} readOnly />
                </Field>
                <Field label="Limite diário padrão">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={dailyLimit}
                    onChange={(event) => setDailyLimit(Number(event.target.value))}
                    className="field"
                  />
                </Field>
                <Field label="Intervalo mínimo padrão (minutos)">
                  <input
                    type="number"
                    min={1}
                    value={intervalMinutes}
                    onChange={(event) => setIntervalMinutes(Number(event.target.value))}
                    className="field"
                  />
                </Field>
                <DailyTimeSlots value={times} onChange={setTimes} limit={10} />
              </div>
              <button
                onClick={() =>
                  setNotice(
                    "Preferências aplicadas apenas à sessão atual. A gravação permanente será feita com o Supabase.",
                  )
                }
                className="mt-5 rounded-md border border-border px-4 py-2 text-xs font-semibold"
              >
                Aplicar nesta sessão
              </button>
            </Panel>
            <Panel title="Status da integração">
              <div className="flex flex-wrap items-start justify-between gap-4 rounded-md border border-border bg-secondary/30 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  {workerActive ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  ) : (
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {workerActive === null
                        ? "Verificando processamento"
                        : workerActive
                          ? "Processamento automático ativo"
                          : "Processamento automático pendente"}
                    </p>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                      O servidor verifica a fila a cada minuto usando credencial gerada e guardada
                      no Vault do Supabase. Só publica itens que já foram agendados pela equipe. O
                      horário real pode variar; acompanhe o resultado no Histórico.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void activateWorker()}
                  disabled={activatingWorker || workerActive === null || workerActive}
                  className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {activatingWorker
                    ? "Ativando…"
                    : workerActive
                      ? "Ativo"
                      : "Ativar publicação automática"}
                </button>
              </div>
            </Panel>
          </section>
        )}
      </main>
    </div>
  );
}

function Panel({
  title,
  action,
  headingRef,
  children,
}: {
  title: string;
  action?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <h2
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className="scroll-mt-6 font-display text-base font-semibold"
        >
          {title}
        </h2>
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
