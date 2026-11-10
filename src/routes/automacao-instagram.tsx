import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Instagram,
  Library,
  LayoutDashboard,
  ListVideo,
  Repeat2,
  Plus,
  Settings2,
  Sparkles,
  Trophy,
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
import { calendarDateInZone } from "@/lib/scheduling";
import { InstagramHistory } from "@/components/postkit/InstagramHistory";
import { InstagramDashboard } from "@/components/postkit/InstagramDashboard";
import { InstagramAnalytics } from "@/components/postkit/InstagramAnalytics";
import { InstagramTopPosts } from "@/components/postkit/InstagramTopPosts";
import { WorkspaceSelect } from "@/components/ui/workspace-select";
import { InstagramLoops } from "@/components/postkit/InstagramLoops";
import { InstagramStories } from "@/components/postkit/InstagramStories";
import { InstagramProfileDrafts } from "@/components/postkit/InstagramProfileDrafts";
import { ScheduleDate } from "@/components/postkit/DailyTimeSlots";
import { ReelTimingFields } from "@/components/postkit/ReelTimingFields";
import { ReelCaptionFields } from "@/components/postkit/ReelCaptionFields";
import { validatePostkitVideo } from "@/lib/postkit-media";
import type { PostkitDatabase } from "@/lib/postkit-database";
import {
  buildReelSchedule,
  captionWithHashtags,
  dailyReelTimes,
  maxDailyReels,
  maxReelsPerBatch,
  orderReelVideos,
  reelHashtags,
  type ReelOrder,
} from "@/lib/postkit-reel-batch";

const postkit = supabase as unknown as SupabaseClient<PostkitDatabase>;

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
  | "analytics"
  | "top-posts"
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
  importBatch: string | null;
  importFolder: string | null;
  importPosition: number | null;
  reelAccountId: string | null;
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
  {
    label: "Geral",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
      { id: "top-posts", label: "Top posts", icon: Trophy },
    ],
  },
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
  const [tab, setActiveTab] = useState<Tab>(initialTab ?? "dashboard");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const setTab = (next: Tab) => {
    if (next === "biblioteca") setLibraryOpen(false);
    setActiveTab(next);
  };
  const [storyAccount, setStoryAccount] = useState<{
    id: string;
    request: string;
    productUrl: string | null;
  }>();
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [reelMode, setReelMode] = useState<"single" | "batch">("batch");
  const [singleVideoId, setSingleVideoId] = useState("");
  const [singleTime, setSingleTime] = useState("18:00");
  const [batchOrder, setBatchOrder] = useState<ReelOrder>("selection");
  const [sourceFolder, setSourceFolder] = useState("");
  const [cover, setCover] = useState<File>();
  const [coverPreview, setCoverPreview] = useState("");
  const [firstComment, setFirstComment] = useState("");
  const [reviewPage, setReviewPage] = useState(0);
  const [quantity, setQuantity] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(() => calendarDateInZone(workspace.timezone, 1));
  const [times, setTimes] = useState("09:00, 13:00, 18:00");
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
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[] | null>(null);
  const [legacySourceId, setLegacySourceId] = useState("");
  const [linkingVideos, setLinkingVideos] = useState(false);
  const [repeatVideos, setRepeatVideos] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadLock = useRef(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [videosLoaded, setVideosLoaded] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
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
    let active = true;
    async function load() {
      const entries: VideoItem[] = [];
      const size = 500;
      for (let start = 0; active; start += size) {
        const { data, error } = await postkit
          .from("media_assets")
          .select(
            "id,original_filename,size_bytes,mime_type,storage_path,status,import_batch_id,import_folder,import_position,reel_account_id",
          )
          .eq("workspace_id", workspace.id)
          .is("archived_at", null)
          .in("mime_type", ["video/mp4", "video/quicktime"])
          .in("status", ["uploaded", "ready"])
          .order("created_at", { ascending: false })
          .order("id")
          .range(start, start + size - 1);
        if (error || !data) throw error ?? new Error("Library unavailable");
        for (const asset of data) {
          entries.push({
            id: asset.id,
            name: asset.original_filename,
            size: Number(asset.size_bytes),
            type: asset.mime_type,
            storagePath: asset.storage_path,
            status: asset.status,
            importBatch: asset.import_batch_id,
            importFolder: asset.import_folder,
            importPosition: asset.import_position,
            reelAccountId: asset.reel_account_id,
          });
        }
        if (data.length < size) break;
      }
      if (active) {
        setVideos(entries);
        setVideosLoaded(true);
      }
    }
    void load().catch(() => {
      if (active)
        setNotice(
          "Não foi possível carregar seus vídeos. Atualize a página para tentar novamente.",
        );
    });
    return () => {
      active = false;
    };
  }, [workspace.id]);

  useEffect(() => {
    if (!cover) {
      setCoverPreview("");
      return;
    }
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("instagram");
    if (result === "connected") {
      setActiveTab("contas");
      setNotice("Conexão concluída. Confira o @ em Suas contas.");
    }
    if (result === "insights_not_granted") {
      setActiveTab("analytics");
      setNotice(
        "A Meta ainda não concedeu acesso às métricas. Confira a permissão na próxima autorização.",
      );
    }
    if (result === "connection_failed") {
      setActiveTab("contas");
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

  const connectInstagram = async (
    mode: "instagram_login" | "facebook_login",
    analytics = false,
  ) => {
    setConnecting(mode);
    setNotice("");
    try {
      const { authorizationUrl } = await startInstagramOAuth({
        data: { workspaceId: workspace.id, mode, analytics },
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

  const uploadFiles = async (files: File[], folder = false) => {
    if (uploadLock.current || !files.length || !reelAccount) return;
    const accountId = reelAccount.id;
    const batch = folder ? crypto.randomUUID() : null;
    const folderName = folder
      ? (files[0].webkitRelativePath.split("/")[0] || "Pasta importada").slice(0, 255)
      : null;
    const candidates = folder ? files.filter((file) => /\.(mp4|mov)$/i.test(file.name)) : files;
    if (!candidates.length) {
      setNotice("Esta pasta não contém vídeos MP4 ou MOV.");
      return;
    }
    uploadLock.current = true;
    setUploading(true);
    setNotice(`Enviando vídeos para @${reelAccount.username}…`);
    const uploaded: VideoItem[] = [];
    const errors: string[] = [];
    try {
      for (const [index, file] of candidates.entries()) {
        setUploadProgress(`Arquivo ${index + 1} de ${candidates.length}: ${file.name}`);
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
        const { error: assetError } = await postkit.from("media_assets").insert({
          id,
          workspace_id: workspace.id,
          original_filename: file.name,
          storage_path: storagePath,
          mime_type: mimeType,
          size_bytes: file.size,
          status: "uploaded",
          import_batch_id: batch,
          import_folder: folderName,
          import_position: folder ? index : null,
          reel_account_id: accountId,
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
          importBatch: batch,
          importFolder: folderName,
          importPosition: folder ? index : null,
          reelAccountId: accountId,
        });
      }
    } finally {
      uploadLock.current = false;
      setUploading(false);
      setUploadProgress("");
      setVideos((current) => [...uploaded, ...current]);
      if (uploaded.length) selectFolder(batch ?? "");
    }
    setNotice(
      `${uploaded.length} vídeo(s) salvo(s) para @${reelAccount.username}. ${errors.slice(0, 3).join(" ")}${errors.length > 3 ? ` E mais ${errors.length - 3} arquivo(s) com erro.` : ""}`,
    );
  };

  const addFiles = (event: ChangeEvent<HTMLInputElement>, folder = false) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void uploadFiles(files, folder).catch(() =>
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
  const reelAccount = readyAccounts.find((account) => account.id === selectedAccountId);
  const libraryAccount = libraryOpen
    ? connectedAccounts.find((account) => account.id === selectedAccountId)
    : undefined;
  const libraryBusy = uploading || linkingVideos || savingQueue;
  const videosByAccount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const video of videos) {
      if (video.reelAccountId) {
        counts.set(video.reelAccountId, (counts.get(video.reelAccountId) ?? 0) + 1);
      }
    }
    return counts;
  }, [videos]);
  const accountVideos = useMemo(
    () => videos.filter((video) => video.reelAccountId === selectedAccountId),
    [selectedAccountId, videos],
  );
  const folders = useMemo(
    () =>
      Array.from(
        new Map(
          accountVideos.flatMap((video) =>
            video.importBatch && video.importFolder
              ? [[video.importBatch, video.importFolder] as const]
              : [],
          ),
        ),
      ),
    [accountVideos],
  );
  const libraryVideos = sourceFolder
    ? accountVideos.filter((video) => video.importBatch === sourceFolder)
    : accountVideos;
  const selectedIds = selectedVideoIds && new Set(selectedVideoIds);
  const reelVideos = selectedIds
    ? libraryVideos.filter((video) => selectedIds.has(video.id))
    : libraryVideos;

  const legacySources = useMemo(() => {
    const sources = new Map<string, { name: string; batch: boolean; count: number }>();
    for (const video of videos) {
      if (video.reelAccountId) continue;
      const id = video.importBatch ?? video.id;
      const source = sources.get(id);
      if (source) source.count++;
      else
        sources.set(id, {
          name: video.importFolder ?? video.name,
          batch: !!video.importBatch,
          count: 1,
        });
    }
    return sources;
  }, [videos]);

  const linkLegacyVideos = async () => {
    const source = legacySources.get(legacySourceId);
    if (!reelAccount || !source || linkingVideos) return;
    setLinkingVideos(true);
    try {
      const { count, error } = await postkit
        .from("media_assets")
        .update({ reel_account_id: reelAccount.id }, { count: "exact" })
        .eq("workspace_id", workspace.id)
        .eq(source.batch ? "import_batch_id" : "id", legacySourceId)
        .is("reel_account_id", null)
        .is("archived_at", null)
        .in("mime_type", ["video/mp4", "video/quicktime"])
        .in("status", ["uploaded", "ready"]);
      if (error || count !== source.count) {
        setNotice(
          error?.message.includes("reel_media_used_by_another_account")
            ? "Um vídeo deste grupo já foi publicado ou agendado para outra conta. Confira o histórico antes de vincular."
            : "Não foi possível vincular. Atualize a página e confira se os vídeos ainda estão sem conta.",
        );
        return;
      }
      setVideos((current) =>
        current.map((video) =>
          !video.reelAccountId && (source.batch ? video.importBatch : video.id) === legacySourceId
            ? { ...video, reelAccountId: reelAccount.id }
            : video,
        ),
      );
      setLegacySourceId("");
      setNotice(`Vínculo concluído para @${reelAccount.username}.`);
    } catch {
      setNotice("Não foi possível confirmar o vínculo. Atualize a Biblioteca para conferir.");
    } finally {
      setLinkingVideos(false);
    }
  };

  const chooseReelAccount = (id: string) => {
    if (id === selectedAccountId || libraryBusy) return;
    setSelectedAccountId(id);
    setSourceFolder("");
    setSelectedVideoIds(null);
    setSingleVideoId("");
    setBatchOrder("selection");
    setLegacySourceId("");
    setQuantity(null);
    setQueue([]);
    setQueueSaved(false);
    setPreviewError("");
  };

  const openAccountLibrary = (id: string) => {
    if (libraryBusy) return;
    chooseReelAccount(id);
    setLibraryOpen(true);
    setActiveTab("biblioteca");
  };

  const selectFolder = (id: string) => {
    setSourceFolder(id);
    setSelectedVideoIds(null);
    setSingleVideoId("");
    setBatchOrder("selection");
    setQuantity(null);
  };
  const scheduleVideos =
    reelMode === "batch" ? reelVideos : libraryVideos.filter((video) => video.id === singleVideoId);
  const commonBatch = scheduleVideos[0]?.importBatch;
  const useFolderOrder =
    !!commonBatch && scheduleVideos.every((video) => video.importBatch === commonBatch);
  const reelsPerAccount =
    reelMode === "single"
      ? 1
      : Math.max(1, Math.min(maxReelsPerBatch, Math.floor(quantity ?? reelVideos.length)));
  const scheduleTimes = reelMode === "single" ? [singleTime].filter(Boolean) : timeSlots;
  const slotsPerDay = scheduleTimes.length;
  const daysInBatch = slotsPerDay ? Math.ceil(reelsPerAccount / slotsPerDay) : 0;
  const agendaNow = new Date();
  const agendaClock = new Intl.DateTimeFormat("pt-BR", {
    timeZone: workspace.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const pastTimeToday =
    startDate === calendarDateInZone(workspace.timezone, 0, agendaNow)
      ? scheduleTimes
          .slice(0, reelsPerAccount)
          .find((time) => time <= agendaClock.format(agendaNow))
      : undefined;
  const timezoneLabel =
    new Intl.DateTimeFormat("pt-BR", { timeZone: workspace.timezone, timeZoneName: "long" })
      .formatToParts(agendaNow)
      .find((part) => part.type === "timeZoneName")?.value ?? workspace.timezone;
  const currentSettings = JSON.stringify([
    reelAccount?.id,
    scheduleVideos.map((video) => video.id),
    reelMode,
    singleTime,
    batchOrder,
    startDate,
    times,
    quantity,
    intervalMinutes,
    repeatVideos,
    caption,
    hashtags,
    firstComment,
    cover ? [cover.name, cover.size, cover.lastModified, coverPreview] : null,
    sourceFolder,
  ]);
  const previewOutdated = !queueSaved && previewSettings !== currentSettings;
  const reviewPageSize = 40;
  const reviewPages = Math.ceil(queue.length / reviewPageSize);

  const generatePreview = () => {
    setPreviewError("");
    if (!reelAccount) {
      setPreviewError("Escolha uma conta do Instagram.");
      return;
    }
    if (!scheduleVideos.length) {
      setPreviewError("Escolha pelo menos um vídeo vinculado a esta conta.");
      return;
    }
    if (
      !scheduleTimes.length ||
      (reelMode === "batch" && times.split(",").some((slot) => !slot.trim()))
    ) {
      setPreviewError("Preencha todos os horários ou remova os campos vazios.");
      return;
    }
    if (reelMode === "batch" && timeSlots.length !== times.split(",").length) {
      setPreviewError("Use horários diferentes para cada Reel.");
      return;
    }
    if (scheduleTimes.length > maxDailyReels) {
      setPreviewError(`Escolha até ${maxDailyReels} Reels por dia em cada conta.`);
      return;
    }
    if (captionWithHashtags(caption, hashtags).length > 2200) {
      setPreviewError("Reduza a legenda ou as hashtags para caber nos 2.200 caracteres.");
      return;
    }
    if (!repeatVideos && reelsPerAccount > scheduleVideos.length) {
      setPreviewError("Escolha mais vídeos ou reduza o total por conta em Mais opções.");
      return;
    }
    if (!startDate) {
      setPreviewError("Escolha o primeiro dia da programação.");
      return;
    }
    try {
      const ordered = orderReelVideos(scheduleVideos, batchOrder, useFolderOrder);
      const next = buildReelSchedule(
        ordered,
        reelsPerAccount,
        startDate,
        scheduleTimes,
        workspace.timezone,
      );
      const minimumIntervalMs = Math.max(1, Number(intervalMinutes) || 1) * 60 * 1000;
      if (
        next.some(
          (post, index) =>
            index > 0 &&
            new Date(post.scheduledAt).getTime() - new Date(next[index - 1].scheduledAt).getTime() <
              minimumIntervalMs,
        )
      ) {
        setPreviewError("Separe os horários ou ajuste o intervalo em Mais opções.");
        return;
      }
      if (next.some((post) => new Date(post.scheduledAt).getTime() <= Date.now())) {
        setPreviewError(
          "Algum horário já passou. Escolha horários mais tarde ou comece em outro dia.",
        );
        return;
      }
      setQueue(
        next.map(({ video, ...slot }) => ({
          ...slot,
          id: crypto.randomUUID(),
          assetId: video.id,
          video: video.name,
          accountId: reelAccount.id,
          accountName: reelAccount.username,
          caption,
          hashtags,
        })),
      );
      setQueueSaved(false);
      setReviewPage(0);
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
    if (queue.some((post) => captionWithHashtags(post.caption, post.hashtags).length > 2200)) {
      setNotice(
        "A legenda combinada com as hashtags excede o limite de 2.200 caracteres do Instagram.",
      );
      return;
    }
    setSavingQueue(true);
    try {
      const coverId = cover ? queue[0].id : null;
      if (cover && coverId) {
        const signature = new Uint8Array(await cover.slice(0, 3).arrayBuffer());
        if (signature[0] !== 255 || signature[1] !== 216 || signature[2] !== 255) {
          setNotice("A capa precisa ser uma imagem JPEG válida.");
          return;
        }
        const path = `${workspace.id}/${coverId}/reel-cover.jpg`;
        const uploaded = await supabase.storage
          .from("postkit-media")
          .upload(path, cover, { contentType: "image/jpeg", upsert: true });
        if (uploaded.error) throw uploaded.error;
        const stored = await postkit.from("media_assets").upsert(
          {
            id: coverId,
            workspace_id: workspace.id,
            original_filename: cover.name,
            storage_path: path,
            mime_type: "image/jpeg",
            size_bytes: cover.size,
            status: "uploaded",
          },
          { onConflict: "id", ignoreDuplicates: true },
        );
        if (stored.error) throw stored.error;
      }
      const { error } = await postkit.from("posts").upsert(
        queue.map((post) => ({
          idempotency_key: post.id,
          workspace_id: workspace.id,
          instagram_account_id: post.accountId,
          media_asset_id: post.assetId,
          content_type: "reel",
          caption: captionWithHashtags(post.caption, post.hashtags),
          hashtags: reelHashtags(post.hashtags),
          scheduled_at: post.scheduledAt,
          timezone: workspace.timezone,
          status: "scheduled",
          cover_asset_id: coverId,
          first_comment: firstComment.trim() || null,
        })),
        { onConflict: "idempotency_key", ignoreDuplicates: true },
      );
      if (error) {
        setNotice(
          error.message.includes("reel_media_account_mismatch")
            ? "Um vídeo não está vinculado a esta conta. Atualize a Biblioteca e gere uma nova prévia."
            : "Não foi possível salvar o agendamento. Confira a conta e os vídeos e tente novamente.",
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
  const folderOptions = [
    { value: "", label: "Todos os vídeos desta conta" },
    ...folders.map(([value, label]) => ({ value, label })),
  ];

  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[200px_minmax(0,1fr)] xl:items-start xl:gap-6">
      <aside className="rounded-xl border border-border bg-card p-3 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto">
        <div className="mb-3 flex items-center gap-2 xl:px-2">
          <span className="flex size-9 items-center justify-center rounded-lg border border-brand-red/25 bg-brand-red/10 text-brand-red">
            <Instagram className="size-4" />
          </span>
          <span className="font-display text-sm font-semibold">Automação Instagram</span>
        </div>
        <div className="block text-xs font-medium text-muted-foreground xl:hidden">
          Seção do painel
          <WorkspaceSelect
            label="Seção do painel"
            className="mt-1"
            value={tab}
            options={tabItems.map((item) => ({ value: item.id, label: item.label }))}
            onValueChange={(value) => setTab(value as Tab)}
          />
        </div>
        <nav aria-label="Seções da automação Instagram" className="hidden space-y-4 xl:block">
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
                  className={`tool-nav-link w-full text-left ${tab === id ? "is-active" : ""}`}
                >
                  <Icon className="size-4 shrink-0" /> {label}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="min-w-0">
        <header className="tool-section-heading flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-4 sm:px-5">
          <div>
            <p className="mb-1 text-xs font-semibold text-brand-red">Automação Instagram</p>
            <h1 className="font-display text-2xl font-semibold">
              {tabItems.find((item) => item.id === tab)?.label}
            </h1>
          </div>
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

        {tab === "analytics" && (
          <InstagramAnalytics
            workspaceId={workspace.id}
            timezone={workspace.timezone}
            connecting={!!connecting}
            onAuthorize={(mode) => void connectInstagram(mode, true)}
            onConnect={() => setTab("contas")}
          />
        )}

        {tab === "top-posts" && (
          <InstagramTopPosts
            workspaceId={workspace.id}
            timezone={workspace.timezone}
            onAnalytics={() => setTab("analytics")}
          />
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
            onLibrary={openAccountLibrary}
            onReels={(accountId, daily, videoIds) => {
              if (uploading || linkingVideos || savingQueue) {
                setNotice("Aguarde a operação em andamento antes de abrir outro agendamento.");
                return;
              }
              if (queue.length && !queueSaved) {
                setNotice("Revise ou salve a prévia de Reels já aberta antes de carregar a ficha.");
                setTab("fila");
                return;
              }
              const owned = new Set(
                videos
                  .filter((video) => video.reelAccountId === accountId)
                  .map((video) => video.id),
              );
              const available = videoIds.filter((id) => owned.has(id));
              setQueue([]);
              setQueueSaved(false);
              setReelMode("batch");
              chooseReelAccount(accountId);
              setSourceFolder("");
              setSelectedVideoIds(videoIds.length ? available : null);
              setTimes(
                timeSlots.length >= daily
                  ? timeSlots.slice(0, daily).join(", ")
                  : dailyReelTimes(daily),
              );
              setQuantity(null);
              setRepeatVideos(false);
              setNotice(
                available.length < videoIds.length
                  ? "A ficha contém vídeos sem vínculo com esta conta. Confira a Biblioteca."
                  : "Conta e preferências da ficha carregadas. Gere uma prévia antes de agendar.",
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
              videos={videos}
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
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={libraryBusy}
                            aria-label={`Abrir biblioteca de @${account.username}`}
                            className="rounded-md border border-border px-3 py-1 text-xs font-semibold disabled:opacity-50"
                            onClick={() => openAccountLibrary(account.id)}
                          >
                            Abrir biblioteca
                          </button>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${ready ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}
                          >
                            {ready ? "Conectada" : "Precisa de atenção"}
                          </span>
                        </div>
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
            {!libraryAccount ? (
              <Panel title="Bibliotecas das contas">
                <p className="mb-4 text-sm text-muted-foreground">
                  Abra a biblioteca da conta que vai receber os vídeos.
                </p>
                {connectedAccounts.length > 0 ? (
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {connectedAccounts.map((account) => {
                      const count = videosByAccount.get(account.id) ?? 0;
                      return (
                        <li key={account.id} className="min-w-0">
                          <button
                            type="button"
                            disabled={libraryBusy}
                            onClick={() => openAccountLibrary(account.id)}
                            className="flex h-full w-full items-center gap-3 rounded-xl border border-border bg-background/60 p-3 text-left hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
                          >
                            <span className="rounded-lg bg-fuchsia-400/10 p-2.5 text-fuchsia-300">
                              <Library className="size-5" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block break-all text-sm font-semibold">
                                @{account.username}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {videosLoaded
                                  ? count === 1
                                    ? "1 vídeo"
                                    : `${count} vídeos`
                                  : "Biblioteca de Reels"}
                                {account.connection_status !== "connected" &&
                                  " · Reconexão pendente"}
                              </span>
                            </span>
                            <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : accountsLoaded ? (
                  <button
                    type="button"
                    className="text-sm font-semibold text-primary"
                    onClick={() => setTab("contas")}
                  >
                    Conectar conta do Instagram
                  </button>
                ) : (
                  <p className="text-sm text-muted-foreground">Carregando suas contas…</p>
                )}
              </Panel>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setLibraryOpen(false)}
                  className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10"
                >
                  <ArrowLeft className="size-4" aria-hidden /> Todas as bibliotecas
                </button>
                <Panel title={`Biblioteca de @${libraryAccount.username}`}>
                  {reelAccount ? (
                    <>
                      <p className="mb-3 text-sm text-muted-foreground">
                        Os vídeos que você enviar aqui ficam na biblioteca de{" "}
                        <strong>@{reelAccount.username}</strong>.
                      </p>
                      <div className="mb-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => folderInput.current?.click()}
                          disabled={uploading || !videosLoaded}
                          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                        >
                          Importar pasta de vídeos
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInput.current?.click()}
                          disabled={uploading || !videosLoaded}
                          className="rounded-md border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50"
                        >
                          Adicionar vídeos avulsos
                        </button>
                      </div>
                      <input
                        ref={fileInput}
                        type="file"
                        accept="video/mp4,video/quicktime,.mp4,.mov"
                        disabled={uploading}
                        multiple
                        className="hidden"
                        onChange={(event) => addFiles(event)}
                      />
                      <input
                        ref={(input) => {
                          folderInput.current = input;
                          input?.setAttribute("webkitdirectory", "");
                        }}
                        type="file"
                        multiple
                        disabled={uploading || !videosLoaded}
                        className="hidden"
                        onChange={(event) => addFiles(event, true)}
                      />
                      <button
                        onClick={() => fileInput.current?.click()}
                        disabled={uploading || !videosLoaded}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (!videosLoaded) return;
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
                          MP4 ou MOV, até 500 MB por vídeo. Os arquivos ficam na sua biblioteca
                          privada.
                        </p>
                      </button>
                      {legacySources.size > 0 && (
                        <details className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/5 p-3">
                          <summary className="cursor-pointer text-sm font-semibold text-amber-200">
                            Vincular pastas e vídeos antigos
                          </summary>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Arquivos antigos precisam de uma conta antes de entrar na programação.
                            Confira a pasta e o destino. O vínculo fica fixo após salvar.
                          </p>
                          <div className="mt-3 max-w-sm">
                            <Field label="Pasta ou vídeo sem conta">
                              <WorkspaceSelect
                                label="Pasta ou vídeo sem conta"
                                value={legacySourceId}
                                disabled={linkingVideos}
                                onValueChange={setLegacySourceId}
                                options={[
                                  { value: "", label: "Escolher pasta ou vídeo" },
                                  ...[...legacySources].map(([value, source]) => ({
                                    value,
                                    label:
                                      source.name +
                                      (source.batch ? ` (${source.count} vídeos)` : ""),
                                  })),
                                ]}
                              />
                            </Field>
                          </div>
                          <button
                            type="button"
                            disabled={!legacySourceId || linkingVideos}
                            className="mt-2 rounded-md border border-amber-400/30 px-3 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
                            onClick={() => void linkLegacyVideos()}
                          >
                            {linkingVideos ? "Vinculando…" : `Vincular a @${reelAccount.username}`}
                          </button>
                        </details>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Você pode consultar estes vídeos. Reconecte a conta para importar ou agendar.
                    </p>
                  )}
                  {folders.length > 0 && (
                    <div className="mt-4 max-w-sm">
                      <Field label="Pasta para agendar">
                        <WorkspaceSelect
                          label="Pasta para agendar"
                          value={sourceFolder}
                          options={folderOptions}
                          onValueChange={selectFolder}
                        />
                      </Field>
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    {reelAccount ? (
                      <span>
                        {reelVideos.length} de {libraryVideos.length} selecionados
                      </span>
                    ) : (
                      <span>{libraryVideos.length} nesta biblioteca</span>
                    )}
                    <span>
                      {formattedSize(libraryVideos.reduce((total, video) => total + video.size, 0))}{" "}
                      no total
                    </span>
                  </div>
                  {libraryVideos.length ? (
                    <div className="mt-2 divide-y divide-border">
                      {libraryVideos.map((video) => (
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
                          {reelAccount && (
                            <input
                              type="checkbox"
                              aria-label={`Usar ${video.name}`}
                              checked={selectedIds?.has(video.id) ?? true}
                              onChange={(event) =>
                                setSelectedVideoIds(
                                  event.target.checked
                                    ? [...reelVideos.map((item) => item.id), video.id]
                                    : reelVideos
                                        .filter((item) => item.id !== video.id)
                                        .map((item) => item.id),
                                )
                              }
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-center text-xs text-muted-foreground">
                      {videosLoaded
                        ? "Ainda não há vídeos nesta biblioteca."
                        : "Carregando os vídeos desta conta…"}
                    </p>
                  )}
                  {reelAccount && !!libraryVideos.length && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                      <p className="text-sm text-muted-foreground">
                        Marque os vídeos que você quer usar na próxima programação.
                      </p>
                      <button
                        type="button"
                        disabled={!reelVideos.length}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                        onClick={() => {
                          if (sourceFolder) setReelMode("batch");
                          setTab("fila");
                        }}
                      >
                        Ir para os dias e horários <ArrowRight className="size-4" />
                      </button>
                    </div>
                  )}
                </Panel>
              </>
            )}
          </section>
        )}

        {tab === "fila" && (
          <section className="mt-6 space-y-4">
            <Panel title="Agendar Reels">
              <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
                Escolha a conta e os vídeos dela, prepare o texto e monte os horários. Confira tudo
                na prévia antes de colocar os Reels na fila.
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
                    className="rounded-xl border border-border bg-card p-3 text-left hover:bg-secondary/40 aria-pressed:border-primary/60 aria-pressed:bg-primary/10"
                  >
                    <span className="block text-sm font-semibold">{option.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{option.help}</span>
                  </button>
                ))}
              </div>
              <fieldset className="mb-5 rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-4">
                <legend className="px-1 text-sm font-semibold text-cyan-200">
                  1. Em qual conta você vai publicar?
                </legend>
                {!!readyAccounts.length && (
                  <div className="max-w-sm">
                    <ReelAccountSelect
                      accounts={readyAccounts}
                      value={reelAccount?.id ?? ""}
                      onChange={chooseReelAccount}
                      disabled={uploading || linkingVideos || savingQueue}
                    />
                  </div>
                )}
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
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-400/25 bg-violet-400/5 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-violet-200">
                    {reelMode === "single" ? "2. Qual vídeo?" : "2. Quais vídeos?"}
                  </h3>
                  {reelMode === "single" && libraryVideos.length > 0 ? (
                    <WorkspaceSelect
                      label="Escolha o vídeo do Reel"
                      className="mt-2"
                      value={singleVideoId}
                      options={[
                        { value: "", label: "Selecione na biblioteca" },
                        ...libraryVideos.map((video) => ({ value: video.id, label: video.name })),
                      ]}
                      onValueChange={setSingleVideoId}
                    />
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {scheduleVideos.length === 1
                        ? "1 vídeo escolhido"
                        : scheduleVideos.length
                          ? `${scheduleVideos.length} vídeos escolhidos`
                          : "Abra a Biblioteca para escolher os vídeos desta conta."}
                    </p>
                  )}
                  {folders.length > 0 && (
                    <div className="mt-2">
                      <Field label="Pasta desta conta">
                        <WorkspaceSelect
                          label="Pasta desta conta"
                          value={sourceFolder}
                          options={folderOptions}
                          onValueChange={selectFolder}
                        />
                      </Field>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary"
                  disabled={libraryBusy}
                  onClick={() =>
                    reelAccount ? openAccountLibrary(reelAccount.id) : setTab("biblioteca")
                  }
                >
                  {reelMode === "single"
                    ? "Abrir biblioteca"
                    : accountVideos.length
                      ? "Escolher vídeos na Biblioteca"
                      : "Adicionar vídeos na Biblioteca"}
                </button>
              </div>
              <section className="mb-5 space-y-3 rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/5 p-3 sm:p-4">
                <div>
                  <h3 className="text-sm font-semibold text-fuchsia-200">3. Conteúdo dos Reels</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Se preencher, o texto vale para todos os Reels. Ajuste cada um na prévia.
                  </p>
                </div>
                <ReelCaptionFields
                  caption={caption}
                  hashtags={hashtags}
                  onCaptionChange={setCaption}
                  onHashtagsChange={setHashtags}
                />
                <details className="rounded-lg border border-fuchsia-400/20 p-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Capa e primeiro comentário (opcionais)
                  </summary>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
                      <Field label="Foto de capa (opcional · JPEG, até 8 MB)">
                        <input
                          className="field"
                          type="file"
                          accept=".jpg,.jpeg,image/jpeg"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (!file) return;
                            if (
                              !/\.jpe?g$/i.test(file.name) ||
                              file.size > 8_000_000 ||
                              !file.size
                            ) {
                              setNotice("Escolha uma imagem JPEG de até 8 MB para a capa.");
                              return;
                            }
                            setCover(file);
                          }}
                        />
                      </Field>
                      {coverPreview && (
                        <div className="flex items-center gap-3">
                          <img
                            className="h-24 w-14 rounded-md border border-border object-cover"
                            src={coverPreview}
                            alt="Prévia da capa do Reel"
                          />
                          <button
                            type="button"
                            className="text-xs font-semibold text-primary"
                            onClick={() => setCover(undefined)}
                          >
                            Remover capa
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3">
                      <Field label="Primeiro comentário (opcional)">
                        <textarea
                          className="field min-h-20"
                          value={firstComment}
                          maxLength={2200}
                          placeholder="Texto ou hashtags para o primeiro comentário"
                          onChange={(event) => setFirstComment(event.target.value)}
                        />
                      </Field>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Sai após a confirmação do Reel. A conta precisa autorizar comentários na
                        Meta.
                      </p>
                    </div>
                  </div>
                </details>
              </section>
              <section className="space-y-4 rounded-xl border border-sky-400/25 bg-card p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-sky-200">4. Dias e horários</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {reelMode === "batch"
                        ? "Os horários se repetem até acabarem os vídeos."
                        : "Escolha a data e o horário em que o Reel deve sair."}
                    </p>
                  </div>
                  <span className="rounded-full border border-sky-400/25 px-2.5 py-1 text-xs text-sky-200">
                    {timezoneLabel}
                  </span>
                </div>
                <div className={reelMode === "single" ? "grid gap-3 lg:grid-cols-2" : undefined}>
                  <ScheduleDate
                    value={startDate}
                    timezone={workspace.timezone}
                    onChange={setStartDate}
                  />
                  {reelMode === "single" ? (
                    <div className="flex items-center gap-3 rounded-xl border border-sky-400/20 bg-sky-400/5 p-3">
                      <span className="shrink-0 rounded-lg bg-sky-400/15 px-2.5 py-1.5 text-sm font-semibold text-sky-200">
                        Reel 1
                      </span>
                      <Field label="Horário de publicação">
                        <input
                          type="time"
                          aria-label="Horário de publicação do Reel 1"
                          className="field text-base"
                          value={singleTime}
                          onChange={(event) => setSingleTime(event.target.value)}
                        />
                      </Field>
                    </div>
                  ) : null}
                </div>
                {pastTimeToday && (
                  <p className="rounded-lg bg-amber-400/10 p-3 text-sm text-amber-200">
                    O horário de {pastTimeToday} de hoje já passou. Escolha Amanhã ou edite o
                    horário.
                  </p>
                )}
                {reelMode === "batch" && (
                  <ReelTimingFields
                    value={times}
                    slots={timeSlots}
                    onChange={setTimes}
                    intervalMinutes={intervalMinutes}
                    onIntervalChange={setIntervalMinutes}
                  >
                    <div className="grid items-start gap-3 lg:grid-cols-2">
                      <Field label="Total de Reels por conta (opcional)">
                        <input
                          type="number"
                          min={1}
                          max={maxReelsPerBatch}
                          value={quantity ?? ""}
                          placeholder="Usar os vídeos selecionados"
                          onChange={(event) =>
                            setQuantity(
                              event.target.value === "" ? null : Number(event.target.value),
                            )
                          }
                          className="field"
                        />
                      </Field>
                      <Field label="Ordem dos vídeos">
                        <WorkspaceSelect
                          label="Ordem dos vídeos"
                          value={batchOrder}
                          onValueChange={(value) => setBatchOrder(value as ReelOrder)}
                          options={[
                            {
                              value: "selection",
                              label: useFolderOrder
                                ? "Ordem da pasta importada"
                                : "Ordem da biblioteca",
                            },
                            { value: "numeric", label: "Ordem numérica pelo nome (1, 2, 10…)" },
                            { value: "random", label: "Ordem aleatória na prévia" },
                          ]}
                        />
                      </Field>
                      <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={repeatVideos}
                          onChange={(event) => setRepeatVideos(event.target.checked)}
                        />
                        Repetir vídeos se a seleção for menor que o total do lote.
                      </label>
                    </div>
                  </ReelTimingFields>
                )}
              </section>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
                <div>
                  <p className="text-sm font-semibold">5. Confira a programação</p>
                  <p className="text-xs text-muted-foreground">
                    {reelAccount && scheduleVideos.length && slotsPerDay
                      ? `@${reelAccount.username} · ${reelsPerAccount} ${reelsPerAccount === 1 ? "Reel" : "Reels"} · ${daysInBatch} ${daysInBatch === 1 ? "dia" : "dias"} de programação.`
                      : "Escolha a conta, os vídeos e os horários para ver a prévia."}
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
                  {previewSettings === currentSettings && (coverPreview || firstComment.trim()) && (
                    <div className="mt-3 flex flex-wrap items-start gap-3 rounded-lg border border-border p-3">
                      {coverPreview && (
                        <img
                          className="h-20 w-12 rounded object-cover"
                          src={coverPreview}
                          alt="Capa compartilhada do agendamento"
                        />
                      )}
                      <div className="min-w-0 text-sm">
                        {coverPreview && (
                          <p className="font-medium">Capa aplicada a todos os Reels</p>
                        )}
                        {firstComment.trim() && (
                          <p className="break-words text-muted-foreground">
                            Primeiro comentário: {firstComment.trim()}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="mt-4 max-h-[560px] overflow-auto">
                    {queue
                      .slice(reviewPage * reviewPageSize, (reviewPage + 1) * reviewPageSize)
                      .map((post, index) => (
                        <div
                          key={post.id}
                          className="flex items-center gap-3 border-b border-border py-3 last:border-0"
                        >
                          <span className="w-10 text-xs font-semibold text-muted-foreground">
                            #{reviewPage * reviewPageSize + index + 1}
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
                              {captionWithHashtags(post.caption, post.hashtags) ||
                                "Sem descrição ou hashtags"}
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
                  {reviewPages > 1 && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <button
                        type="button"
                        className="rounded border border-border px-3 py-1.5 disabled:opacity-50"
                        disabled={reviewPage === 0}
                        onClick={() => setReviewPage((page) => page - 1)}
                      >
                        Anterior
                      </button>
                      <span aria-live="polite">
                        Página {reviewPage + 1} de {reviewPages}
                      </span>
                      <button
                        type="button"
                        className="rounded border border-border px-3 py-1.5 disabled:opacity-50"
                        disabled={reviewPage + 1 >= reviewPages}
                        onClick={() => setReviewPage((page) => page + 1)}
                      >
                        Próxima
                      </button>
                    </div>
                  )}
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
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Prepare o texto opcional do próximo agendamento. Você pode editar estes mesmos
                  campos na tela Agendar Reels.
                </p>
                <ReelCaptionFields
                  caption={caption}
                  hashtags={hashtags}
                  onCaptionChange={setCaption}
                  onHashtagsChange={setHashtags}
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  onClick={() => setTab("fila")}
                >
                  Ir para Agendar Reels <ArrowRight className="size-4" />
                </button>
              </div>
            </Panel>
          </section>
        )}

        {tab === "config" && (
          <section className="mt-6 space-y-4">
            <Panel title="Horários para agendar Reels">
              <div className="space-y-4">
                <p className="max-w-xl text-sm text-muted-foreground">
                  Ajuste os horários do próximo lote aqui ou na tela Agendar Reels. As escolhas
                  ficam disponíveis enquanto o painel estiver aberto.
                </p>
                <div className="flex items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-3">
                  <Clock3 className="size-5 shrink-0 text-emerald-300" aria-hidden />
                  <div>
                    <p className="text-xs text-muted-foreground">Fuso horário da operação</p>
                    <p className="break-all text-sm font-semibold text-emerald-200">
                      {timezoneLabel}
                    </p>
                  </div>
                </div>
                <ReelTimingFields
                  value={times}
                  slots={timeSlots}
                  onChange={setTimes}
                  intervalMinutes={intervalMinutes}
                  onIntervalChange={setIntervalMinutes}
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  onClick={() => {
                    setReelMode("batch");
                    setTab("fila");
                  }}
                >
                  Usar horários em um lote <ArrowRight className="size-4" />
                </button>
              </div>
            </Panel>
            <Panel title="Publicação automática">
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
                        ? "Verificando o status"
                        : workerActive
                          ? "Publicação automática ativa"
                          : "Publicação automática desativada"}
                    </p>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                      Os Reels entram na fila quando você confirma o agendamento. Acompanhe no
                      Histórico quando cada publicação sair.
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

function ReelAccountSelect({
  accounts,
  value,
  onChange,
  disabled,
}: {
  accounts: { id: string; username: string }[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <Field label="Conta do Instagram">
      <WorkspaceSelect
        label="Conta do Instagram"
        value={value}
        disabled={disabled || !accounts.length}
        options={[
          { value: "", label: "Escolher conta" },
          ...accounts.map((account) => ({ value: account.id, label: `@${account.username}` })),
        ]}
        onValueChange={onChange}
      />
    </Field>
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
