import { createFileRoute } from "@tanstack/react-router";
import { usePlanAccess } from "@/components/access/PlatformAccessProvider";
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
  FolderUp,
  Instagram,
  Library,
  LayoutDashboard,
  LoaderCircle,
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
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { InstagramLocalLogin } from "@/components/postkit/InstagramLocalLogin";
import {
  InstagramConnectWizard,
  resetInstagramConnectWizard,
} from "@/components/postkit/InstagramConnectWizard";
import { InstagramWorkspaceSetup } from "@/components/postkit/InstagramWorkspaceSetup";
import {
  InstagramConnectionDetails,
  type InstagramConnectionDetailsAccount,
} from "@/components/postkit/InstagramConnectionDetails";
import { InstagramAutomationReview } from "@/components/postkit/InstagramAutomationReview";
import { reviewAutomation, type StoriesChoice } from "@/lib/instagram-automation-review";
import { bridgeRequest, HOT_CONNECTION_KEY, type HotConnection } from "@/lib/hot-profiles";
import {
  findUpdatedInstagramAccount,
  INSTAGRAM_CONNECTION_CHANNEL,
  type InstagramConnectionAccount,
} from "@/lib/instagram-connect";
import { startInstagramOAuth } from "@/lib/api/instagram-oauth.functions";
import type { InstagramAuthMode } from "@/lib/instagram-oauth.server";
import {
  enableInstagramWorker,
  getInstagramWorkerStatus,
} from "@/lib/api/instagram-worker.functions";
import { calendarDateInZone } from "@/lib/scheduling";
import { InstagramHistory } from "@/components/postkit/InstagramHistory";
import { InstagramDriveLibrary } from "@/components/postkit/InstagramDriveLibrary";
import { InstagramAccountCards } from "@/components/postkit/InstagramAccountCards";
import { InstagramDashboard } from "@/components/postkit/InstagramDashboard";
import {
  InstagramLibraryShelf,
  type ReelFolderOption,
} from "@/components/postkit/InstagramLibraryShelf";
import { getInstagramWorkspaceApp } from "@/lib/api/instagram-workspace-app.functions";
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
type WorkspaceAppStatus = Awaited<ReturnType<typeof getInstagramWorkspaceApp>>;

export const Route = createFileRoute("/automacao-instagram")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    tab?:
      | "perfis"
      | "contas"
      | "nova-conta"
      | "stories"
      | "publicacoes"
      | "fila"
      | "analytics"
      | "config";
  } => ({
    tab:
      search.tab === "perfis" ||
      search.tab === "contas" ||
      search.tab === "nova-conta" ||
      search.tab === "stories" ||
      search.tab === "publicacoes" ||
      search.tab === "fila" ||
      search.tab === "analytics" ||
      search.tab === "config"
        ? search.tab
        : undefined,
  }),
  head: () => ({
    meta: [
      { property: "og:title", content: "Automatic Post · Instagram — Mousefy" },
      {
        property: "og:description",
        content: "Organize contas profissionais, vídeos, legendas e agendamentos de Reels.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Automatic Post · Instagram — Mousefy" },
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
  | "nova-conta"
  | "contas"
  | "biblioteca"
  | "fila"
  | "stories"
  | "conteudo"
  | "config"
  | "historico"
  | "publicacoes"
  | "loops";
const reelSteps = [
  { id: "videos", title: "Escolher vídeos" },
  { id: "content", title: "Legenda e capa" },
  { id: "timing", title: "Dias e horários" },
  { id: "review", title: "Revisar e agendar" },
] as const;
type ReelStep = (typeof reelSteps)[number]["id"];
const looseReelsFolder = "loose";

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
      { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
      { id: "analytics", label: "Resultados", icon: BarChart3 },
      { id: "top-posts", label: "Melhores publicações", icon: Trophy },
    ],
  },
  {
    label: "Publicar",
    items: [
      { id: "fila", label: "Agendar Reels", icon: CalendarDays },
      { id: "stories", label: "Stories", icon: Instagram },
      { id: "loops", label: "Repetir programação", icon: Repeat2 },
    ],
  },
  {
    label: "Organizar",
    items: [
      { id: "biblioteca", label: "Biblioteca de Reels", icon: Library },
      { id: "contas", label: "Contas conectadas", icon: Users },
      { id: "nova-conta", label: "Conectar nova conta", icon: Plus },
      { id: "perfis", label: "Preparar novos perfis", icon: Plus },
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
    title: "Gerenciar contas",
    text: "Veja seus perfis do Instagram e adicione outros.",
    icon: Users,
    tone: "bg-primary/10 text-brand-red",
  },
  {
    tab: "fila",
    title: "Agendar Reels",
    text: "Escolha seus vídeos e quando eles devem ser publicados.",
    icon: CalendarDays,
    tone: "bg-primary/10 text-brand-red",
  },
  {
    tab: "stories",
    title: "Preparar Stories",
    text: "Monte a prévia com figurinhas e receba um lembrete para postar.",
    icon: Instagram,
    tone: "bg-primary/10 text-brand-red",
  },
  {
    tab: "perfis",
    title: "Planejar um novo perfil",
    text: "Deixe nome, foto e bio prontos para criar o perfil no Instagram.",
    icon: Plus,
    tone: "bg-primary/10 text-brand-red",
  },
] as const;

function AutomacaoInstagram() {
  const { tab } = Route.useSearch();
  const { canExecute } = usePlanAccess();
  if (!canExecute) {
    return (
      <InstagramWorkspacePage
        key="visit"
        workspace={{
          id: "00000000-0000-0000-0000-000000000000",
          name: "Sua operação",
          timezone: "America/Sao_Paulo",
          owner_id: "",
        }}
        workspaceControls={null}
        initialTab={tab}
        app={{
          mode: "missing",
          appId: "",
          configId: "",
          callbackUrl: "",
          platformAppConfigured: false,
          canManage: false,
        }}
        onAppSaved={async () => {}}
        visiting
      />
    );
  }
  return (
    <WorkspaceGate>
      {(workspace, workspaceControls) => (
        <InstagramWorkspaceEntry
          key={workspace.id}
          workspace={workspace}
          workspaceControls={workspaceControls}
          initialTab={tab}
        />
      )}
    </WorkspaceGate>
  );
}

function InstagramWorkspaceEntry({
  workspace,
  workspaceControls,
  initialTab,
}: {
  workspace: Workspace;
  workspaceControls: ReactNode;
  initialTab?: Tab;
}) {
  const [app, setApp] = useState<WorkspaceAppStatus>();
  const [loadingError, setLoadingError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void getInstagramWorkspaceApp({ data: { workspaceId: workspace.id } })
      .then((result) => {
        if (active) setApp(result);
      })
      .catch(() => {
        if (active) setLoadingError(true);
      });
    return () => {
      active = false;
    };
  }, [workspace.id, attempt]);

  if (app) {
    return (
      <InstagramWorkspacePage
        workspace={workspace}
        workspaceControls={workspaceControls}
        initialTab={initialTab}
        app={app}
        onAppSaved={async () => {
          const updated = await getInstagramWorkspaceApp({ data: { workspaceId: workspace.id } });
          if (updated.mode !== "own") throw new Error("App Meta indisponível.");
          setApp(updated);
        }}
      />
    );
  }

  return (
    <AppShell dashboard="instagram">
      {workspaceControls}
      <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-5 sm:px-6">
        <header className="tool-section-heading rounded-xl border border-border px-4 py-4 sm:px-5">
          <p className="mb-1 text-xs font-semibold text-brand-red">Automação Instagram</p>
          <h1 className="font-display text-2xl font-semibold">Conectar Instagram</h1>
        </header>
        {loadingError ? (
          <div role="alert" className="rounded-xl border border-border bg-card p-4 text-sm">
            Não foi possível verificar a configuração da conexão do Instagram.
            <button
              type="button"
              className="ml-2 min-h-10 font-semibold text-brand-red underline"
              onClick={() => {
                setLoadingError(false);
                setAttempt((value) => value + 1);
              }}
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            Verificando a conexão do Instagram…
          </p>
        )}
      </main>
    </AppShell>
  );
}

function InstagramWorkspacePage({
  workspace,
  workspaceControls,
  initialTab,
  app,
  onAppSaved,
  visiting = false,
}: {
  workspace: Workspace;
  workspaceControls: ReactNode;
  initialTab?: Tab;
  app: WorkspaceAppStatus;
  onAppSaved: () => Promise<void>;
  visiting?: boolean;
}) {
  const { requirePlan } = usePlanAccess();
  const [requestedTab, setActiveTab] = useState<Tab>(initialTab ?? "dashboard");
  const [appSetupOpen, setAppSetupOpen] = useState(false);
  const [isolatedLogin, setIsolatedLogin] = useState(false);
  const [connectionTarget, setConnectionTarget] = useState<"reels" | "stories">("reels");
  const loginAccountsBefore = useRef<InstagramConnectionAccount[]>([]);
  const loginLock = useRef(false);
  const confirmedInstagramIds = useRef<string[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [openedAccountId, setOpenedAccountId] = useState("");
  const connectAccountButton = useRef<HTMLButtonElement>(null);
  const [analyticsAccountId, setAnalyticsAccountId] = useState("");
  const [queueAccountId, setQueueAccountId] = useState("");
  const [accountReelFlow, setAccountReelFlow] = useState(false);
  const [reelStep, setReelStep] = useState<ReelStep>("videos");
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const showReelStep = (step: ReelStep) => {
    setReelStep(step);
    requestAnimationFrame(() => stepHeading.current?.focus());
  };
  const setTab = (next: Tab, target: "reels" | "stories" = "reels") => {
    setAppSetupOpen(false);
    if (next === "nova-conta") {
      setConnectionTarget(target);
    }
    if (next !== "nova-conta" && connectionProgress?.step === "success")
      setConnectionProgress(null);
    if (next === "biblioteca") setLibraryOpen(false);
    if (next === "fila" && tab !== "fila") setReelStep("videos");
    if (next === "analytics") setAnalyticsAccountId("");
    if (next === "publicacoes") setQueueAccountId("");
    if (next === "contas" || next === "dashboard" || next === "nova-conta")
      setAccountReelFlow(false);
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
  const [videoRefresh, setVideoRefresh] = useState(0);
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
  const [times, setTimes] = useState(() => dailyReelTimes(10));
  const [intervalMinutes, setIntervalMinutes] = useState(120);
  const [notice, setNotice] = useState("");
  const [connectedAccounts, setConnectedAccounts] = useState<InstagramConnectionDetailsAccount[]>(
    [],
  );
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [queueSaved, setQueueSaved] = useState(false);
  const [previewSettings, setPreviewSettings] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [savingQueue, setSavingQueue] = useState(false);
  const [showLocalLogin, setShowLocalLogin] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<{ mode: InstagramAuthMode; analytics: boolean }>(
    { mode: "instagram_unified_login", analytics: false },
  );
  const [accountRefresh, setAccountRefresh] = useState(0);
  const [loginWaiting, setLoginWaiting] = useState(false);
  const [connectionProgress, setConnectionProgress] = useState<
    | { step: "verifying" }
    | { step: "error"; message: string }
    | { step: "success"; id: string; username: string }
    | null
  >(null);
  const connectionHeading = useRef<HTMLHeadingElement>(null);
  const connectionStep = connectionProgress?.step;
  const activeConnectionStep =
    connectionStep === "success"
      ? 3
      : connectionStep === "verifying"
        ? 2
        : loginWaiting || connectionStep === "error"
          ? 1
          : 0;
  useEffect(() => {
    if (requestedTab === "nova-conta" && (connectionStep || loginWaiting))
      connectionHeading.current?.focus();
  }, [requestedTab, connectionStep, loginWaiting]);
  const storiesChoice: StoriesChoice = "skip";
  const storyReviewCount = 0;
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  useEffect(() => {
    if (!loginWaiting) return;
    const interval = window.setInterval(() => setAccountRefresh((value) => value + 1), 5000);
    const refresh = () => setAccountRefresh((value) => value + 1);
    window.addEventListener("focus", refresh);
    const channel =
      typeof window.BroadcastChannel === "undefined"
        ? null
        : new window.BroadcastChannel(INSTAGRAM_CONNECTION_CHANNEL);
    if (channel) {
      channel.onmessage = ({ data }) => {
        if (
          data?.type !== "oauth-result" ||
          typeof data.id !== "string" ||
          !/^[\da-f-]{36}$/i.test(data.id) ||
          typeof data.success !== "boolean"
        )
          return;
        if (data.connection?.workspaceId && data.connection.workspaceId !== workspace.id) return;
        if (
          data.connection?.workspaceId === workspace.id &&
          Array.isArray(data.connection.instagramAccountIds)
        ) {
          confirmedInstagramIds.current = data.connection.instagramAccountIds.filter(
            (id: unknown): id is string => typeof id === "string" && /^\d+$/.test(id),
          );
        }
        refresh();
        if (data.success) {
          setConnectionProgress({ step: "verifying" });
          setNotice("");
        } else {
          setLoginWaiting(false);
          setNotice("");
          setConnectionProgress({
            step: "error",
            message:
              data.reason === "meta_denied"
                ? "A autorização foi cancelada ou negada. Abra o Instagram novamente para confirmar o acesso."
                : "O Mousefy não conseguiu confirmar a autorização. Tente novamente com a conta profissional que deseja conectar.",
          });
        }
        channel.postMessage({ type: "ack", id: data.id });
      };
    }
    const timeout = window.setTimeout(() => {
      setLoginWaiting(false);
      setNotice("");
      setConnectionProgress({
        step: "error",
        message: "O tempo de conexão terminou. Abra uma nova autorização para continuar.",
      });
    }, 600000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
      window.removeEventListener("focus", refresh);
      channel?.close();
    };
  }, [loginWaiting, workspace.id]);
  const [connecting, setConnecting] = useState<InstagramAuthMode | null>(null);
  const [workerStatus, setWorkerStatus] = useState<"checking" | "active" | "inactive" | "unknown">(
    "checking",
  );
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
  const [accountsLoadError, setAccountsLoadError] = useState("");
  const [videosLoaded, setVideosLoaded] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (visiting) return;
    let active = true;
    void postkit
      .from("instagram_accounts")
      .select(
        "id,username,display_name,account_type,connection_status,last_verified_at,instagram_user_id,scopes,token_expires_at,connected_at,created_at,profile_picture_url",
      )
      .eq("workspace_id", workspace.id)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setAccountsLoadError("Não foi possível carregar suas contas do Instagram.");
        } else {
          setAccountsLoadError("");
          setAccountsLoaded(true);
          setConnectedAccounts(data ?? []);
          if (loginWaiting) {
            const added = findUpdatedInstagramAccount(
              data ?? [],
              loginAccountsBefore.current,
              confirmedInstagramIds.current,
            );
            if (added) {
              resetInstagramConnectWizard(workspace.id);
              setLoginWaiting(false);
              resetReelDraft(added.id);
              setConnectionProgress({ step: "success", id: added.id, username: added.username });
              setNotice(`@${added.username} conectada no Mousefy.`);
            }
          }
          setSelectedAccountId(
            (current) =>
              current ||
              data?.find((account) => account.connection_status === "connected")?.id ||
              "",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [workspace.id, accountRefresh, loginWaiting, visiting]);

  useEffect(() => {
    if (visiting) return;
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
  }, [workspace.id, videoRefresh, visiting]);

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
      setNotice("Confira o status do perfil em Contas conectadas.");
    }
    if (result === "insights_not_granted") {
      setActiveTab("analytics");
      setNotice(
        "A Meta ainda não concedeu acesso às métricas. Confira a permissão na próxima autorização.",
      );
    }
    if (result === "connection_failed") {
      setActiveTab("nova-conta");
      const reason = new URLSearchParams(window.location.search).get("instagram_reason");
      const reasonLabels: Record<string, string> = {
        meta_denied: "a Meta não concluiu a autorização",
        state_validation: "a validação de segurança da autorização",
        authorization_code_missing: "o código de autorização retornado pela Meta",
        workspace_access: "o acesso ao espaço de trabalho",
        workspace_app_changed: "a validação do app Meta da operação",
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
        unified_code_exchange: "a troca do código do Login Unificado",
        unified_grant: "a validação do acesso concedido pelo Instagram",
        unified_permissions: "a confirmação das permissões de perfil e publicação",
        unified_account_lookup: "a busca das contas compartilhadas pela Meta",
        unified_business_lookup: "a identificação do portfólio autorizado na Meta",
        no_linked_account: "a busca por Instagram profissional vinculado a uma Página",
        account_save: "o salvamento da conta do Instagram",
        token_save: "o armazenamento seguro da autorização",
        account_activation: "a ativação da conta no sistema",
        server_configuration_or_unexpected: "uma configuração do servidor ou erro inesperado",
      };
      const detail = reason
        ? (reasonLabels[reason] ?? "uma etapa não identificada")
        : "uma etapa não identificada";
      setConnectionProgress({
        step: "error",
        message: `A conexão parou em ${detail}. Tente novamente.`,
      });
    }
  }, []);

  const platformMetaUnavailable = app.mode === "legacy" && !app.platformAppConfigured;
  const platformMetaMessage =
    "O app Meta já está vinculado a esta operação. Faltam as credenciais do app no servidor para abrir a autorização.";
  const continueConnectedAccount = () => {
    if (connectionProgress?.step !== "success") return;
    const { id } = connectionProgress;
    if (connectionTarget === "stories") {
      setStoryAccount({ id, request: crypto.randomUUID(), productUrl: null });
      setTab("stories");
    } else {
      openAccountLibrary(id);
    }
    setConnectionProgress(null);
  };
  const connectInstagram = async (mode: InstagramAuthMode, analytics = false) => {
    if (!requirePlan()) return;
    if (platformMetaUnavailable) {
      setNotice(platformMetaMessage);
      return;
    }
    if (loginLock.current || loginWaiting || !accountsLoaded || accountsLoadError) return;
    loginLock.current = true;
    setConnecting(mode);
    setNotice("");
    setConnectionProgress(null);
    loginAccountsBefore.current = connectedAccounts.map((account) => ({ ...account }));
    confirmedInstagramIds.current = [];
    try {
      setPendingLogin({ mode, analytics });
      const authorize = () =>
        startInstagramOAuth({ data: { workspaceId: workspace.id, mode, analytics } });
      if (isolatedLogin) {
        const saved = sessionStorage.getItem(HOT_CONNECTION_KEY);
        if (!saved) {
          setShowLocalLogin(true);
          setNotice(
            "Pareie o conector abaixo ou desmarque a sessão isolada para conectar neste navegador.",
          );
          return;
        }
        const connection = JSON.parse(saved) as HotConnection;
        await bridgeRequest(connection, "/v1/instagram-login", await authorize());
      } else {
        const { authorizationUrl } = await authorize();
        setLoginWaiting(true);
        setNotice(
          "Abrindo a autorização do Instagram… Você será redirecionado e voltará ao Mousefy automaticamente.",
        );
        window.location.assign(authorizationUrl);
        return;
      }
      setShowLocalLogin(false);
      setLoginWaiting(true);
      setNotice(
        "Autorização aberta. Entre no perfil desejado no Instagram e confirme o acesso solicitado.",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível abrir a autorização. Tente novamente.";
      setConnectionProgress({ step: "error", message });
      if (requestedTab !== "nova-conta") setNotice(message);
      if (isolatedLogin) setShowLocalLogin(true);
    } finally {
      loginLock.current = false;
      setConnecting(null);
    }
  };

  const formattedSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;

  const uploadFiles = async (files: File[], folder = false) => {
    if (!requirePlan()) return;
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
      if (uploaded.length)
        selectFolder(batch ?? (sourceFolder === looseReelsFolder ? looseReelsFolder : ""));
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

  const managedAccounts = connectedAccounts.filter(
    (account) => account.connection_status !== "revoked",
  );
  const readyAccounts = managedAccounts.filter(
    (account) => account.connection_status === "connected",
  );
  const needsConnection =
    !visiting && (app.mode === "missing" || app.mode === "own") && !readyAccounts.length;
  const canOpenTab = (item: Tab) =>
    !needsConnection || item === "dashboard" || item === "nova-conta" || item === "contas";
  const tab = canOpenTab(requestedTab) ? requestedTab : "dashboard";
  const reelAccount = readyAccounts.find((account) => account.id === selectedAccountId);
  const libraryAccount = libraryOpen
    ? connectedAccounts.find((account) => account.id === selectedAccountId)
    : undefined;
  const openedAccount = managedAccounts.find((account) => account.id === openedAccountId);
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
  const folders = useMemo(() => {
    const batches = new Map<string, ReelFolderOption>();
    let looseCount = 0;
    for (const video of accountVideos) {
      if (!video.importBatch) {
        looseCount++;
        continue;
      }
      const existing = batches.get(video.importBatch);
      if (existing) existing.count++;
      else {
        batches.set(video.importBatch, {
          value: video.importBatch,
          label: video.importFolder ?? "Pasta importada",
          count: 1,
        });
      }
    }
    return [
      { value: "", label: "Todos os vídeos", count: accountVideos.length },
      { value: looseReelsFolder, label: "Sem pasta", count: looseCount },
      ...batches.values(),
    ];
  }, [accountVideos]);
  const libraryVideos = useMemo(() => {
    if (!sourceFolder) return accountVideos;
    return accountVideos.filter(
      (video) => (video.importBatch ?? looseReelsFolder) === sourceFolder,
    );
  }, [accountVideos, sourceFolder]);
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
    resetReelDraft(id);
  };

  function resetReelDraft(id: string) {
    setSelectedAccountId(id);
    setReviewConfirmed(false);
    setCaption("");
    setHashtags("");
    setCover(undefined);
    setFirstComment("");
    setStartDate(calendarDateInZone(workspace.timezone, 1));
    setSingleTime("18:00");
    setTimes(dailyReelTimes(10));
    setIntervalMinutes(120);
    setSourceFolder("");
    setSelectedVideoIds(null);
    setSingleVideoId("");
    setBatchOrder("selection");
    setLegacySourceId("");
    setQuantity(null);
    setQueue([]);
    setQueueSaved(false);
    setPreviewError("");
  }

  const openAccount = (id: string) => {
    setOpenedAccountId(id);
    setTab("contas");
  };
  const startAccountReels = (id: string) => {
    chooseReelAccount(id);
    setAccountReelFlow(true);
    setReelMode("batch");
    setTab("fila");
  };

  const openAccountLibrary = (id: string) => {
    if (libraryBusy) return;
    chooseReelAccount(id);
    setAccountReelFlow(true);
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
    if (!requirePlan()) return;
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
      setReelStep("review");
      requestAnimationFrame(() => reviewHeading.current?.focus());
    } catch {
      setPreviewError("Confira se a data e os horários existem no fuso do espaço de trabalho.");
    }
  };

  const reviewSignature = JSON.stringify([currentSettings, queue, storiesChoice]);
  useEffect(() => {
    setReviewConfirmed(false);
  }, [reviewSignature]);
  const scheduleErrors = reviewAutomation({
    accountId: selectedAccountId,
    connected: !!reelAccount,
    videoCount: queue.length,
    dailyCount: slotsPerDay,
    previewCurrent: !!queue.length && !previewOutdated,
    stories: storiesChoice,
    storyCount: storyReviewCount,
    confirmed: reviewConfirmed,
  });

  const saveQueue = async () => {
    if (!requirePlan()) return;
    if (savingQueue || queueSaved || previewOutdated) return;
    if (scheduleErrors.length) {
      setNotice(scheduleErrors.join(" "));
      return;
    }
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
      const { error } = await postkit.rpc("schedule_reviewed_instagram_reels", {
        p_workspace_id: workspace.id,
        p_account_id: selectedAccountId,
        p_stories: storiesChoice,
        p_confirmed: reviewConfirmed,
        p_posts: queue.map((post) => ({
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
      });
      if (error) {
        setNotice(
          error.message.includes("stories_required")
            ? "Prepare os Stories desta conta antes de ativar."
            : error.message.includes("daily_limit_exceeded")
              ? "Esta conta já tem Reels nesses dias. O total não pode passar de 10 por dia; confira a fila."
              : error.code === "PGRST202"
                ? "A revisão de agendamentos ainda precisa ser ativada no servidor."
                : error.message.includes("reel_media_account_mismatch")
                  ? "Um vídeo não está vinculado a esta conta. Atualize a Biblioteca e gere uma nova prévia."
                  : "Não foi possível salvar o agendamento. Confira a conta e os vídeos e tente novamente.",
        );
        return;
      }
      setQueueSaved(true);
      setHistoryRefresh((value) => value + 1);
      setNotice(
        workerStatus === "active"
          ? "Agendamento salvo. Acompanhe cada publicação no Histórico."
          : workerStatus === "inactive"
            ? "Agendamento salvo na fila. A publicação automática está desativada."
            : "Agendamento salvo na fila. O status da publicação automática ainda não foi confirmado.",
      );
    } catch {
      setNotice(
        "Não foi possível confirmar o salvamento. Reabra os agendamentos antes de tentar novamente.",
      );
    } finally {
      setSavingQueue(false);
    }
  };

  useEffect(() => {
    if (visiting || (tab !== "config" && tab !== "fila")) return;
    let current = true;
    setWorkerStatus("checking");
    void getInstagramWorkerStatus({ data: { workspaceId: workspace.id } })
      .then(({ active }) => {
        if (current) setWorkerStatus(active ? "active" : "inactive");
      })
      .catch(() => {
        if (current) setWorkerStatus("unknown");
      });
    return () => {
      current = false;
    };
  }, [tab, workspace.id, visiting]);

  const activateWorker = async () => {
    if (!requirePlan()) return;
    if (activatingWorker || workerStatus === "active" || workerStatus === "checking") return;
    setActivatingWorker(true);
    setNotice("");
    try {
      const result = await enableInstagramWorker({ data: { workspaceId: workspace.id } });
      if (result.active) {
        setWorkerStatus("active");
        setNotice("Processamento automático ativado. Confira cada resultado no Histórico.");
      } else if (result.reason === "configuration") {
        setWorkerStatus("inactive");
        setNotice("O destino de publicação no Supabase precisa ser configurado ou reativado.");
      } else if (result.reason === "permission") {
        setNotice(
          "Somente o proprietário ou um administrador da operação pode ativar a publicação.",
        );
      } else {
        setWorkerStatus("unknown");
        setNotice("O servidor não conseguiu ativar a publicação automática. Tente novamente.");
      }
    } catch {
      setWorkerStatus("unknown");
      setNotice(
        "Não foi possível confirmar a ativação. Reabra Configurações para verificar o status.",
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
  const folderOptions = folders.filter(
    (folder) => folder.value !== looseReelsFolder || folder.count > 0,
  );

  return (
    <AppShell
      dashboard={tab === "dashboard" ? "instagram" : undefined}
      workspaceNavigation={(closeMenu) => (
        <nav
          aria-label="Seções da automação Instagram"
          className="mt-5 space-y-4 border-t border-border pt-4"
        >
          {tabGroups
            .filter((group) => group.items.some((item) => canOpenTab(item.id)))
            .map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                {group.items
                  .filter((item) => canOpenTab(item.id))
                  .map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setTab(id);
                        closeMenu();
                      }}
                      aria-current={tab === id ? "page" : undefined}
                      className={`tool-nav-link w-full text-left ${tab === id ? "is-active" : ""}`}
                    >
                      <Icon className="size-4 shrink-0" /> {label}
                    </button>
                  ))}
              </div>
            ))}
        </nav>
      )}
    >
      {workspaceControls}
      <main className="mx-auto w-full min-w-0 max-w-[1600px] px-4 py-5 sm:px-6">
        <header className="tool-section-heading flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border p-4 sm:p-6">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {tabItems.find((item) => item.id === tab)?.label}
            </h1>
          </div>
          {tab === "dashboard" && (
            <div className="flex flex-wrap items-center gap-2">
              {!needsConnection && (
                <button
                  type="button"
                  onClick={() => setTab("publicacoes")}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
                >
                  <ListVideo className="size-4" aria-hidden /> Ver fila
                </button>
              )}
            </div>
          )}
        </header>

        {showLocalLogin && (
          <InstagramLocalLogin
            onReady={() => void connectInstagram(pendingLogin.mode, pendingLogin.analytics)}
            onClose={() => setShowLocalLogin(false)}
          />
        )}
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
            initialAccountId={analyticsAccountId}
            connectedAccounts={readyAccounts}
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

        {appSetupOpen && (
          <InstagramWorkspaceSetup
            app={app}
            workspaceId={workspace.id}
            initialGuideStep={0}
            onSaved={onAppSaved}
            onBack={() => setTab("dashboard")}
            onConnect={() => setTab("nova-conta", connectionTarget)}
            onChoosePlan={visiting ? requirePlan : undefined}
          />
        )}

        {tab === "dashboard" && !appSetupOpen && (
          <section className="mt-4 space-y-4">
            <InstagramDashboard
              workspaceId={workspace.id}
              timezone={workspace.timezone}
              accounts={readyAccounts}
              videoCounts={videosLoaded ? videosByAccount : undefined}
              onOpenAccount={openAccount}
              refreshKey={historyRefresh}
              appMode={app.mode}
              visiting={visiting}
              platformAppConfigured={app.platformAppConfigured}
              onAppSetup={() => setAppSetupOpen(true)}
              onAccounts={() => setTab("nova-conta")}
              onLibrary={!needsConnection ? () => setTab("biblioteca") : undefined}
              onSchedule={!needsConnection ? () => setTab("fila") : undefined}
              onQueue={!needsConnection ? () => setTab("publicacoes") : undefined}
              onStories={!needsConnection ? () => setTab("stories") : undefined}
              onHistory={!needsConnection ? () => setTab("historico") : undefined}
              onAnalytics={!needsConnection ? () => setTab("analytics") : undefined}
            />
            {!needsConnection && (
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
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-brand-red" />
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {text}
                      </span>
                    </button>
                  ))}
                </div>
              </Panel>
            )}
          </section>
        )}

        {!needsConnection && (
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
                  setNotice(
                    "Revise ou salve a prévia de Reels já aberta antes de carregar a ficha.",
                  );
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
        )}
        {!needsConnection && (
          <div hidden={tab !== "stories"}>
            <InstagramStories
              workspaceId={workspace.id}
              timezone={workspace.timezone}
              accounts={readyAccounts}
              onConnect={() => setTab("nova-conta", "stories")}
              profileAccount={storyAccount}
            />
          </div>
        )}

        {(tab === "historico" || tab === "publicacoes") && (
          <InstagramHistory
            key={tab}
            mode={tab === "publicacoes" ? "queue" : "history"}
            accounts={connectedAccounts}
            initialAccountId={tab === "publicacoes" ? queueAccountId : ""}
            onSchedule={(id) => (id ? startAccountReels(id) : setTab("fila"))}
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

        {(tab === "contas" || tab === "nova-conta") && (
          <section
            aria-label={tab === "nova-conta" ? "Passo a passo por conta" : undefined}
            className="mt-6 max-w-3xl"
          >
            {tab === "nova-conta" && !appSetupOpen && (
              <Panel
                title={
                  connectionTarget === "stories"
                    ? "Conectar conta para Stories"
                    : "Conectar Instagram"
                }
              >
                {(loginWaiting || connectionProgress) && (
                  <ol
                    aria-label="Etapas da conexão"
                    className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4"
                  >
                    {["Conectar", "Autorizar no Instagram", "Verificar", "Conectada"].map(
                      (label, index) => (
                        <li
                          key={label}
                          aria-current={index === activeConnectionStep ? "step" : undefined}
                          className={`rounded-lg border px-3 py-2 text-xs font-medium ${index <= activeConnectionStep ? "border-primary/40 bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
                        >
                          {index + 1}. {label}
                        </li>
                      ),
                    )}
                  </ol>
                )}
                {connectionTarget === "stories" && !loginWaiting && !connectionProgress && (
                  <button
                    type="button"
                    onClick={() => setTab("stories")}
                    className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="size-4" aria-hidden /> Voltar para Stories
                  </button>
                )}
                {connectionProgress?.step === "success" ? (
                  <section className="space-y-4 rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4 sm:p-5">
                    <CheckCircle2 className="size-8 text-emerald-300" aria-hidden />
                    <div>
                      <h3
                        ref={connectionHeading}
                        tabIndex={-1}
                        className="font-display text-xl font-semibold"
                      >
                        Instagram conectado
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        O perfil{" "}
                        <strong className="text-foreground">@{connectionProgress.username}</strong>{" "}
                        está disponível nesta operação.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={continueConnectedAccount}
                        className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
                      >
                        {connectionTarget === "stories"
                          ? "Continuar para Stories"
                          : "Continuar para a biblioteca de Reels"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab("contas")}
                        className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold"
                      >
                        Ver contas
                      </button>
                    </div>
                  </section>
                ) : (
                  <>
                    {connectionProgress?.step === "error" && (
                      <div
                        role="alert"
                        className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-sm"
                      >
                        <h3 ref={connectionHeading} tabIndex={-1} className="font-semibold">
                          Conexão não concluída
                        </h3>
                        <p className="mt-1">{connectionProgress.message}</p>
                      </div>
                    )}
                    {visiting ? (
                      <div className="rounded-xl border border-border bg-card p-4 text-sm">
                        <p className="text-muted-foreground">
                          Conecte um perfil profissional para agendar publicações e acompanhar os
                          resultados.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setAppSetupOpen(true)}
                            className="min-h-11 rounded-lg border border-border px-4 font-semibold"
                          >
                            Ver passo a passo do app Meta
                          </button>
                          <button
                            type="button"
                            onClick={requirePlan}
                            className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground"
                          >
                            Conectar Instagram
                          </button>
                        </div>
                      </div>
                    ) : app.mode === "missing" ? (
                      <div className="rounded-xl border border-border bg-card p-4 text-sm">
                        <p className="font-semibold">Configure o app Meta da operação</p>
                        <p className="mt-1 text-muted-foreground">
                          Use o guia com capturas para preparar o app e depois conectar o Instagram.
                        </p>
                        <button
                          type="button"
                          onClick={() => setAppSetupOpen(true)}
                          className="mt-3 min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground"
                        >
                          Abrir guia do app Meta
                        </button>
                      </div>
                    ) : platformMetaUnavailable ? (
                      <p role="alert" className="text-sm text-amber-200">
                        {platformMetaMessage}
                      </p>
                    ) : (
                      !loginWaiting && (
                        <InstagramConnectWizard
                          key={workspace.id}
                          workspaceId={workspace.id}
                          appId={app.mode === "own" ? app.appId : undefined}
                        >
                          <button
                            type="button"
                            onClick={() => void connectInstagram("instagram_unified_login")}
                            disabled={
                              platformMetaUnavailable ||
                              !!connecting ||
                              loginWaiting ||
                              !accountsLoaded ||
                              !!accountsLoadError
                            }
                            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-base font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                          >
                            <Instagram aria-hidden="true" className="size-4" />
                            {connecting === "instagram_unified_login"
                              ? "Abrindo autorização…"
                              : loginWaiting
                                ? "Aguardando seu Instagram…"
                                : !accountsLoaded && !accountsLoadError
                                  ? "Carregando suas contas…"
                                  : connectionStep === "error"
                                    ? "Tentar novamente"
                                    : "Conectar Instagram"}
                          </button>
                        </InstagramConnectWizard>
                      )
                    )}
                    {accountsLoadError && (
                      <p role="alert" className="mt-3 text-sm text-amber-200">
                        {accountsLoadError}{" "}
                        <button
                          type="button"
                          className="underline underline-offset-4"
                          onClick={() => {
                            setAccountsLoadError("");
                            setAccountRefresh((value) => value + 1);
                          }}
                        >
                          Tentar carregar novamente
                        </button>
                      </p>
                    )}
                    {loginWaiting && (
                      <div className="mb-4 rounded-lg border border-sky-400/30 bg-sky-400/5 p-4 text-sm">
                        <h3
                          ref={connectionHeading}
                          tabIndex={-1}
                          className="flex items-center gap-2 font-semibold"
                        >
                          <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" />
                          {connectionStep === "verifying"
                            ? "Verificando a conexão"
                            : "Autorize no Instagram"}
                        </h3>
                        <p className="mt-2 text-muted-foreground">
                          {connectionStep === "verifying"
                            ? "Conferindo se a conta já aparece conectada nesta operação."
                            : "A autorização abriu em outra janela. Entre no perfil desejado e confirme o acesso solicitado."}
                        </p>
                        {connectionStep !== "verifying" && (
                          <p className="mt-2 text-muted-foreground">
                            Se a Meta disser que o aplicativo está indisponível, confirme se o
                            perfil escolhido aceitou o convite. Volte aqui e clique em{" "}
                            <strong>Refazer configuração</strong> para revisar as etapas.
                          </p>
                        )}
                        <button
                          type="button"
                          className="mr-4 mt-2 font-medium underline underline-offset-4"
                          onClick={() => {
                            setConnectionProgress({ step: "verifying" });
                            setAccountRefresh((value) => value + 1);
                          }}
                        >
                          Já autorizei · verificar conexão
                        </button>
                        <button
                          type="button"
                          className="mt-2 font-medium underline underline-offset-4"
                          onClick={() => {
                            setLoginWaiting(false);
                            setConnectionProgress(null);
                            setNotice(
                              "Acompanhamento encerrado. Feche a janela do Instagram se ela continuar aberta. Você pode iniciar outra conexão.",
                            );
                          }}
                        >
                          Cancelar esta tentativa
                        </button>
                        <button
                          type="button"
                          className="ml-4 mt-2 font-medium underline underline-offset-4"
                          onClick={() => {
                            resetInstagramConnectWizard(workspace.id, 1);
                            setLoginWaiting(false);
                            setConnectionProgress(null);
                          }}
                        >
                          Refazer configuração
                        </button>
                      </div>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">
                      Para conectar outro perfil, use <strong>Trocar de conta</strong> na tela do
                      Instagram. Seus vídeos e agendamentos ficam separados por conta.
                    </p>
                    <details className="mt-4 rounded-md border border-border px-3 py-2 text-xs">
                      <summary className="cursor-pointer font-medium">Opções de navegador</summary>
                      <label className="mt-3 flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isolatedLogin}
                          disabled={loginWaiting || !!connecting}
                          onChange={(e) => setIsolatedLogin(e.target.checked)}
                        />
                        Usar uma sessão nova do Chrome (requer conector local)
                      </label>
                      <p className="mt-2 text-muted-foreground">
                        Use esta opção apenas se quiser uma janela independente. A conexão padrão
                        usa este navegador.
                      </p>
                    </details>
                  </>
                )}
              </Panel>
            )}
            {tab === "contas" && (
              <Panel title="Contas conectadas">
                {tab === "contas" && (
                  <button
                    ref={connectAccountButton}
                    type="button"
                    disabled={
                      !!connecting || loginWaiting || !accountsLoaded || !!accountsLoadError
                    }
                    className="mb-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    onClick={() => {
                      setConnectionTarget("reels");
                      setTab("nova-conta");
                    }}
                  >
                    Adicionar conta
                  </button>
                )}
                {accountsLoadError || !accountsLoaded ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    {accountsLoadError || "Carregando contas…"}
                  </p>
                ) : managedAccounts.length ? (
                  <>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Abra um perfil para enviar vídeos, agendar Reels ou acompanhar os resultados
                      dessa conta.
                    </p>
                    <InstagramAccountCards
                      accounts={managedAccounts}
                      selected={tab === "contas" ? openedAccountId : selectedAccountId}
                      videoCounts={videosLoaded ? videosByAccount : undefined}
                      disabled={libraryBusy || loginWaiting || !!connecting}
                      onSelect={tab === "contas" ? setOpenedAccountId : chooseReelAccount}
                      management={
                        tab === "contas"
                          ? {
                              workspaceId: workspace.id,
                              fallbackFocus: connectAccountButton,
                              onDisconnected: (account) => {
                                setConnectedAccounts((accounts) =>
                                  accounts.map((item) =>
                                    item.id === account.id
                                      ? {
                                          ...item,
                                          connection_status: "revoked",
                                          scopes: [],
                                          token_expires_at: null,
                                        }
                                      : item,
                                  ),
                                );
                                setOpenedAccountId((id) => (id === account.id ? "" : id));
                                if (selectedAccountId === account.id) resetReelDraft("");
                                setAccountRefresh((value) => value + 1);
                                setHistoryRefresh((value) => value + 1);
                                setNotice(`@${account.username} foi desconectada do Mousefy.`);
                              },
                            }
                          : undefined
                      }
                    />
                    {tab === "contas" && openedAccount && (
                      <section
                        aria-label={`Opções de @${openedAccount.username}`}
                        className="mt-5 space-y-4 rounded-xl border border-primary/30 bg-background/50 p-4 sm:p-5"
                      >
                        <InstagramConnectionDetails
                          key={openedAccount.id}
                          account={openedAccount}
                          workspaceId={workspace.id}
                          timeZone={workspace.timezone}
                          disabled={!!connecting || loginWaiting}
                          onChanged={() => setAccountRefresh((value) => value + 1)}
                          onReconnect={() => {
                            chooseReelAccount(openedAccount.id);
                            setTab("nova-conta");
                            void connectInstagram("instagram_unified_login");
                          }}
                        />
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          <button
                            type="button"
                            disabled={libraryBusy}
                            className="rounded-lg border border-border px-3 py-3 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
                            onClick={() => openAccountLibrary(openedAccount.id)}
                          >
                            Biblioteca de Reels
                          </button>
                          {openedAccount.connection_status === "connected" && (
                            <>
                              <button
                                type="button"
                                disabled={libraryBusy}
                                className="rounded-lg bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                                onClick={() => startAccountReels(openedAccount.id)}
                              >
                                Agendar Reels
                              </button>
                              <button
                                type="button"
                                className="rounded-lg border border-border px-3 py-3 text-sm font-semibold hover:bg-secondary"
                                onClick={() => {
                                  setStoryAccount({
                                    id: openedAccount.id,
                                    request: crypto.randomUUID(),
                                    productUrl: null,
                                  });
                                  setTab("stories");
                                }}
                              >
                                Configurar Stories
                              </button>
                              <button
                                type="button"
                                className="rounded-lg border border-border px-3 py-3 text-sm font-semibold hover:bg-secondary"
                                onClick={() => {
                                  setTab("analytics");
                                  setAnalyticsAccountId(openedAccount.id);
                                }}
                              >
                                Ver resultados
                              </button>
                            </>
                          )}
                        </div>
                      </section>
                    )}
                  </>
                ) : (
                  <Empty
                    icon={Instagram}
                    title="Nenhuma conta conectada"
                    text="Depois da autorização, o nome de usuário da conta aparece aqui."
                  />
                )}
              </Panel>
            )}
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
                            <ArrowRight className="size-4 shrink-0 text-brand-red" aria-hidden />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : accountsLoaded ? (
                  <button
                    type="button"
                    className="text-sm font-semibold text-brand-red"
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
                  className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-brand-red hover:bg-primary/10"
                >
                  <ArrowLeft className="size-4" aria-hidden /> Todas as bibliotecas
                </button>
                <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-4 sm:px-5">
                  <div className="min-w-0">
                    <h2 className="break-all font-display text-lg font-semibold">
                      Biblioteca de @{libraryAccount.username}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {reelAccount
                        ? "Envie vídeos e escolha quais vão para o próximo agendamento."
                        : "Reconecte a conta para enviar vídeos ou agendar Reels."}
                    </p>
                  </div>
                  {reelAccount && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => folderInput.current?.click()}
                        disabled={uploading || !videosLoaded}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
                      >
                        <FolderUp className="size-4" aria-hidden /> Importar pasta
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInput.current?.click()}
                        disabled={uploading || !videosLoaded}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        <Upload className="size-4" aria-hidden /> Enviar vídeos
                      </button>
                      <input
                        ref={fileInput}
                        type="file"
                        accept="video/mp4,video/quicktime,.mp4,.mov"
                        aria-label="Arquivos para a biblioteca de Reels"
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
                        aria-label="Pasta de vídeos para importar"
                        multiple
                        disabled={uploading || !videosLoaded}
                        className="hidden"
                        onChange={(event) => addFiles(event, true)}
                      />
                    </div>
                  )}
                </header>
                {reelAccount && (
                  <InstagramDriveLibrary
                    key={reelAccount.id}
                    workspaceId={workspace.id}
                    accountId={reelAccount.id}
                    onLibraryChange={() => setVideoRefresh((value) => value + 1)}
                  />
                )}
                {uploading && (
                  <p
                    role="status"
                    className="rounded-lg border border-brand-red/25 bg-primary/10 px-4 py-3 text-sm"
                  >
                    {uploadProgress || "Preparando o envio…"}
                  </p>
                )}
                <InstagramLibraryShelf
                  key={libraryAccount.id}
                  folders={folders}
                  activeFolder={sourceFolder}
                  onFolder={selectFolder}
                  videos={libraryVideos}
                  loaded={videosLoaded}
                  selectedIds={selectedIds}
                  selectedCount={reelVideos.length}
                  onSelect={
                    reelAccount
                      ? (id, checked) => {
                          const selection = reelVideos.map((video) => video.id);
                          setSelectedVideoIds(
                            checked
                              ? [...selection, id]
                              : selection.filter((value) => value !== id),
                          );
                        }
                      : undefined
                  }
                  formatSize={formattedSize}
                  empty={
                    reelAccount ? (
                      <button
                        type="button"
                        disabled={uploading || !videosLoaded}
                        onClick={() => fileInput.current?.click()}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (uploading || !videosLoaded) return;
                          void uploadFiles(Array.from(event.dataTransfer.files)).catch(() =>
                            setNotice(
                              "O envio foi interrompido. Confira sua conexão e tente novamente.",
                            ),
                          );
                        }}
                        className="w-full rounded-xl border border-dashed border-brand-red/30 bg-primary/5 p-8 text-center hover:border-brand-red/70 disabled:opacity-50"
                      >
                        <Upload className="mx-auto size-6 text-brand-red" aria-hidden />
                        <span className="mt-3 block text-sm font-semibold">
                          {sourceFolder && sourceFolder !== looseReelsFolder
                            ? "Pasta sem vídeos"
                            : "Envie seus vídeos para começar"}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Clique ou arraste arquivos MP4 ou MOV de até 500 MB.
                        </span>
                      </button>
                    ) : (
                      <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                        Ainda não há vídeos nesta pasta.
                      </p>
                    )
                  }
                >
                  {reelAccount && libraryVideos.length > 0 && (
                    <div className="sticky bottom-2 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-lg lg:static lg:bg-secondary/30 lg:shadow-none">
                      <span className="text-sm text-muted-foreground">
                        Use a seleção desta pasta para montar o agendamento.
                      </span>
                      <button
                        type="button"
                        disabled={!reelVideos.length}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                        onClick={() => {
                          if (sourceFolder) setReelMode("batch");
                          setTab("fila");
                        }}
                      >
                        Próximo: configurar Reels <ArrowRight className="size-4" aria-hidden />
                      </button>
                    </div>
                  )}
                </InstagramLibraryShelf>
                {reelAccount && (
                  <>
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
                                    source.name + (source.batch ? ` (${source.count} vídeos)` : ""),
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
                )}
              </>
            )}
          </section>
        )}

        {tab === "fila" && (
          <section className="mt-6 space-y-4">
            <section aria-label="Etapas do agendamento de Reels" className="space-y-3">
              <ol className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {reelSteps.map((step, index) => (
                  <li
                    key={step.id}
                    aria-current={reelStep === step.id ? "step" : undefined}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground aria-[current=step]:border-primary aria-[current=step]:bg-primary/10 aria-[current=step]:text-foreground sm:text-sm"
                  >
                    {index + 1}. {step.title}
                  </li>
                ))}
              </ol>
              {reelAccount && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm">
                  <strong>Publicar em @{reelAccount.username}</strong>
                  <button
                    type="button"
                    disabled={savingQueue}
                    className="font-semibold text-brand-red hover:underline disabled:opacity-50"
                    onClick={() => openAccount(reelAccount.id)}
                  >
                    Voltar à conta
                  </button>
                </div>
              )}
            </section>
            <div hidden={reelStep === "review"}>
              <Panel
                title={reelSteps.find((step) => step.id === reelStep)?.title ?? "Agendar Reels"}
                headingRef={stepHeading}
              >
                <div hidden={reelStep !== "videos"}>
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
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {option.help}
                        </span>
                      </button>
                    ))}
                  </div>
                  {!accountReelFlow && (
                    <fieldset className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
                      <legend className="px-1 text-sm font-semibold text-brand-red">
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
                          className="py-1 text-sm font-semibold text-brand-red underline"
                          onClick={() => setTab("contas")}
                        >
                          Conectar minha primeira conta
                        </button>
                      )}
                    </fieldset>
                  )}
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-brand-red">
                        {reelMode === "single" ? "2. Qual vídeo?" : "2. Quais vídeos?"}
                      </h3>
                      {reelMode === "single" && libraryVideos.length > 0 ? (
                        <WorkspaceSelect
                          label="Escolha o vídeo do Reel"
                          className="mt-2"
                          value={singleVideoId}
                          options={[
                            { value: "", label: "Selecione na biblioteca" },
                            ...libraryVideos.map((video) => ({
                              value: video.id,
                              label: video.name,
                            })),
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
                      {folderOptions.length > 1 && (
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
                </div>
                <section
                  hidden={reelStep !== "content"}
                  className="mb-5 space-y-3 rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/5 p-3 sm:p-4"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-fuchsia-200">
                      3. Conteúdo dos Reels
                    </h3>
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
                              className="text-xs font-semibold text-brand-red"
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
                <section
                  hidden={reelStep !== "timing"}
                  className="space-y-4 rounded-xl border border-sky-400/25 bg-card p-3 sm:p-4"
                >
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
                        <div className="space-y-2">
                          <div
                            role="group"
                            aria-label="Escolher ordem dos Reels"
                            className="flex flex-wrap gap-2"
                          >
                            {(
                              [
                                ["selection", "Na ordem da biblioteca"],
                                ["numeric", "Ordem numérica"],
                                ["random", "Ordem aleatória"],
                              ] as const
                            ).map(([value, label]) => (
                              <button
                                type="button"
                                key={value}
                                aria-pressed={batchOrder === value}
                                className="filter-chip"
                                onClick={() => setBatchOrder(value)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
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
                <div
                  hidden={reelStep !== "timing"}
                  className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-4"
                >
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
                    <Sparkles className="size-3" /> Próximo: revisar Reels
                  </button>
                  {previewError && (
                    <p role="alert" className="basis-full text-sm text-amber-300">
                      {previewError}
                    </p>
                  )}
                </div>
                {reelStep !== "timing" && (
                  <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-border pt-4">
                    {reelStep === "content" && (
                      <button
                        type="button"
                        onClick={() => showReelStep("videos")}
                        className="rounded-lg border border-border px-4 py-2 font-semibold hover:bg-secondary"
                      >
                        Voltar
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={
                        reelStep === "videos" &&
                        (!reelAccount || !scheduleVideos.length || libraryBusy)
                      }
                      onClick={() => showReelStep(reelStep === "videos" ? "content" : "timing")}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {reelStep === "videos"
                        ? "Próximo: legenda e capa"
                        : "Próximo: dias e horários"}
                      <ArrowRight className="size-4" aria-hidden />
                    </button>
                  </div>
                )}
                {reelStep === "timing" && (
                  <button
                    type="button"
                    onClick={() => showReelStep("content")}
                    className="mt-4 rounded-lg border border-border px-4 py-2 font-semibold hover:bg-secondary"
                  >
                    Voltar à legenda e capa
                  </button>
                )}
              </Panel>
            </div>
            {reelStep === "review" && (
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
                      {queue.length === 1 ? "1 publicação" : `${queue.length} publicações`} ·
                      Confira os vídeos, contas e horários abaixo.
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
                    {previewSettings === currentSettings &&
                      (coverPreview || firstComment.trim()) && (
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
                            <Video className="size-4 shrink-0 text-brand-red" />
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
                                  <summary className="cursor-pointer font-semibold text-brand-red">
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
                                            item.id === post.id
                                              ? { ...item, caption: value }
                                              : item,
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
                    <InstagramAutomationReview
                      username={reelAccount?.username ?? ""}
                      confirmed={reviewConfirmed}
                      onConfirm={setReviewConfirmed}
                      disabled={savingQueue || queueSaved}
                    />
                    {workerStatus !== "active" && (
                      <div className="mt-3 rounded-lg border border-amber-500/30 p-3 text-sm">
                        <p>
                          {workerStatus === "inactive"
                            ? "A publicação automática está desativada. Você pode salvar o agendamento na fila."
                            : workerStatus === "checking"
                              ? "Verificando o status da publicação automática."
                              : "O status da publicação automática está indisponível. Você pode salvar o agendamento na fila."}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Revise os horários vencidos na fila antes de reativar a publicação.
                        </p>
                        <button
                          type="button"
                          className="mt-2 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
                          disabled={activatingWorker || workerStatus === "checking"}
                          onClick={() => void activateWorker()}
                        >
                          {activatingWorker ? "Ativando…" : "Ativar publicação automática"}
                        </button>
                      </div>
                    )}
                    {!queueSaved && scheduleErrors.length > 0 && (
                      <ul className="mt-3 space-y-1 text-xs text-amber-200">
                        {scheduleErrors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary/30 p-4">
                      <p className="max-w-xl text-xs leading-5 text-muted-foreground">
                        Confira contas, vídeos e horários. Salvar autoriza a programação deste lote;
                        o Histórico mostra o resultado individual de cada publicação.
                      </p>
                      {queueSaved ? (
                        <button
                          type="button"
                          onClick={() => {
                            setTab("publicacoes");
                            setQueueAccountId(selectedAccountId);
                          }}
                          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                        >
                          Próximo: acompanhar na fila
                        </button>
                      ) : (
                        <button
                          onClick={() => void saveQueue()}
                          disabled={
                            savingQueue ||
                            scheduleErrors.length > 0 ||
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
                          {savingQueue ? "Salvando…" : "Salvar agendamento"}
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <Empty
                    icon={CalendarDays}
                    title="Nenhuma prévia gerada"
                    text="Selecione vídeos e gere uma programação para revisar a distribuição de datas e horários."
                  />
                )}
                {!queueSaved && (
                  <button
                    type="button"
                    disabled={savingQueue}
                    onClick={() => showReelStep("timing")}
                    className="mt-4 rounded-lg border border-border px-4 py-2 font-semibold hover:bg-secondary disabled:opacity-50"
                  >
                    Voltar aos horários
                  </button>
                )}
              </Panel>
            )}
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
                  {workerStatus === "active" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  ) : (
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {workerStatus === "checking"
                        ? "Verificando o status"
                        : workerStatus === "active"
                          ? "Publicação automática ativa"
                          : workerStatus === "inactive"
                            ? "Publicação automática desativada"
                            : "Status da publicação automática indisponível"}
                    </p>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                      Os Reels entram na fila ao salvar o agendamento. Confira os horários vencidos
                      antes de ativar a publicação e acompanhe os resultados no Histórico.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void activateWorker()}
                  disabled={
                    activatingWorker || workerStatus === "checking" || workerStatus === "active"
                  }
                  className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {activatingWorker
                    ? "Ativando…"
                    : workerStatus === "active"
                      ? "Ativo"
                      : "Ativar publicação automática"}
                </button>
              </div>
            </Panel>
          </section>
        )}
      </main>
    </AppShell>
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
