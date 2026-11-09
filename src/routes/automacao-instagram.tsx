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
import {
  enableInstagramWorker,
  getInstagramWorkerStatus,
} from "@/lib/api/instagram-worker.functions";
import { zonedDateTimeToIso } from "@/lib/scheduling";
import { InstagramHistory } from "@/components/postkit/InstagramHistory";
import { InstagramStories } from "@/components/postkit/InstagramStories";
import { InstagramProfileDrafts } from "@/components/postkit/InstagramProfileDrafts";
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

type Tab = "dashboard" | "perfis" | "contas" | "biblioteca" | "fila" | "stories" | "conteudo" | "config" | "historico";
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

const tabItems = [
  { id: "dashboard", label: "Visão geral", icon: ListVideo },
  { id: "perfis", label: "Novos perfis", icon: Plus },
  { id: "contas", label: "Contas", icon: Users },
  { id: "biblioteca", label: "Biblioteca", icon: Library },
  { id: "fila", label: "Agendamento", icon: CalendarDays },
  { id: "stories", label: "Stories", icon: Instagram },
  { id: "historico", label: "Histórico", icon: CheckCircle2 },
  { id: "conteudo", label: "Legendas e hashtags", icon: FileText },
  { id: "config", label: "Configurações", icon: Settings2 },
] as const;

function AutomacaoInstagram() {
  const { tab } = Route.useSearch();
  return (
    <WorkspaceGate>
      {(workspace) => <InstagramWorkspacePage key={workspace.id} workspace={workspace} initialTab={tab} />}
    </WorkspaceGate>
  );
}

function InstagramWorkspacePage({ workspace, initialTab }: { workspace: Workspace; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "dashboard");
  const [storyAccount, setStoryAccount] = useState<{ id: string; request: string; productUrl: string | null }>();
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);
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
  const [connectedAccounts, setConnectedAccounts] = useState<
    Array<{ id: string; username: string; account_type: string | null; connection_status: string }>
  >([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [queueSaved, setQueueSaved] = useState(false);
  const [savingQueue, setSavingQueue] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [workerActive, setWorkerActive] = useState<boolean | null>(null);
  const [activatingWorker, setActivatingWorker] = useState(false);
  const [extraAccountIds, setExtraAccountIds] = useState<string[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [repeatVideos, setRepeatVideos] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadLock = useRef(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void supabase
      .from("instagram_accounts")
      .select("id,username,account_type,connection_status")
      .eq("workspace_id", workspace.id)
      .then(({ data, error }) => {
        if (error)
          setNotice(
            "Não foi possível carregar as contas. Confira se as migrations do PostKit foram aplicadas no Supabase de desenvolvimento.",
          );
        else {
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
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error)
          setNotice(
            "Não foi possível carregar a biblioteca. Confira se as migrations do PostKit foram aplicadas.",
          );
        else {
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
    let active = true;
    void supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("status", "published")
      .then(({ count, error }) => {
        if (active) setSavedCount(error ? null : count);
      });
    return () => {
      active = false;
    };
  }, [workspace.id, historyRefresh]);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("instagram");
    if (result === "connected") setNotice("Conta do Instagram conectada com sucesso.");
    if (result === "connection_failed") {
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
        instagram_not_linked_to_page: "a conta profissional não apareceu vinculada às Páginas autorizadas",
        facebook_instagram_profile_lookup: "a leitura dos dados da conta profissional do Instagram",
        no_linked_account: "a busca por Instagram profissional vinculado a uma Página",
        account_save: "o salvamento da conta do Instagram",
        token_save: "o armazenamento seguro da autorização",
        account_activation: "a ativação da conta no sistema",
        server_configuration_or_unexpected: "uma configuração do servidor ou erro inesperado",
      };
      const detail = reason ? reasonLabels[reason] ?? "uma etapa não identificada" : "uma etapa não identificada";
      setNotice(`A conexão não foi concluída. Falha em: ${detail}. Tente conectar novamente.`);
    }
  }, []);

  const connectInstagram = async (mode: "instagram_login" | "facebook_login") => {
    setConnecting(true);
    setNotice("");
    try {
      const { authorizationUrl } = await startInstagramOAuth({
        data: { workspaceId: workspace.id, mode },
      });
      window.location.assign(authorizationUrl);
    } catch {
      setNotice(
        "Não foi possível iniciar a conexão. Confirme o login, o acesso ao workspace e as configurações do servidor.",
      );
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

  const generatePreview = () => {
    const selectedVideos = videos.filter((video) => selectedVideoIds.includes(video.id));
    const accountIds = [...new Set([selectedAccountId, ...extraAccountIds])].filter(Boolean);
    const accounts = connectedAccounts.filter(
      (account) => accountIds.includes(account.id) && account.connection_status === "connected",
    );
    if (!accounts.length) {
      setNotice("Conecte e selecione pelo menos uma conta na seção Contas.");
      setTab("contas");
      return;
    }
    if (!selectedVideos.length) {
      setNotice("Adicione pelo menos um vídeo antes de montar a prévia.");
      setTab("biblioteca");
      return;
    }
    if (!timeSlots.length) {
      setNotice("Informe pelo menos um horário válido, por exemplo: 09:00, 13:00.");
      return;
    }
    const count = Math.max(1, Math.min(100, Number(quantity) || 1));
    if (!repeatVideos && count > selectedVideos.length) {
      setNotice(
        "A quantidade é maior que os vídeos selecionados. Reduza a quantidade ou permita a repetição do acervo.",
      );
      return;
    }
    if (count * accounts.length > 500) {
      setNotice("Divida a programação em lotes de até 500 publicações.");
      return;
    }
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
          assetId: selectedVideos[index % selectedVideos.length].id,
          video: selectedVideos[index % selectedVideos.length].name,
          accountId: accounts[0].id,
          accountName: accounts[0].username,
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
        setNotice("Os horários ficam mais próximos do que o intervalo mínimo configurado.");
        return;
      }
      if (next.some((post) => new Date(post.scheduledAt).getTime() <= Date.now())) {
        setNotice("Escolha apenas horários futuros no fuso horário do workspace.");
        return;
      }
      setQueue(
        accounts.flatMap((account) =>
          next.map((post) => ({
            ...post,
            id: crypto.randomUUID(),
            accountId: account.id,
            accountName: account.username,
          })),
        ),
      );
      setQueueSaved(false);
      setNotice("Prévia criada. Revise os horários antes de salvar o agendamento.");
      setTab("fila");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Não foi possível montar os horários neste fuso.",
      );
    }
  };

  const saveQueue = async () => {
    if (savingQueue || queueSaved) return;
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
      setNotice("Não foi possível ativar o processamento. Confira se você é administradora do workspace.");
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
    <>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="PostKit · Automação"
          title="Automatic Post · Instagram"
          description="Conecte contas profissionais, envie vídeos para a biblioteca privada e organize sua programação do Instagram."
        />

        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-5">
          <AlertCircle className="size-4 shrink-0 text-amber-500" />
          <span>
            <strong>Organize e acompanhe:</strong> escolha os vídeos e as contas, revise a
            programação e acompanhe as confirmações no Histórico. O serviço de publicação precisa
            estar ativado no servidor para executar os horários salvos.
          </span>
        </div>

        {notice && (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-md border border-border bg-secondary/50 px-4 py-3 text-xs">
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
          aria-label="Seções da automação Instagram"
          className="mt-6 flex gap-2 overflow-x-auto border-b border-border pb-px"
        >
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
              <Metric
                label="Contas conectadas"
                value={String(
                  connectedAccounts.filter((account) => account.connection_status === "connected")
                    .length,
                )}
                icon={Instagram}
                detail="Instagram profissional"
              />
              <Metric
                label="Vídeos na biblioteca"
                value={String(videoCount)}
                icon={Video}
                detail="Salvos na biblioteca privada"
              />
              <Metric
                label={queueSaved ? "Itens agendados" : "Itens na prévia"}
                value={String(scheduledCount)}
                icon={CalendarDays}
                detail={queueSaved ? "Salvos no workspace" : "Aguardando confirmação"}
              />
              <Metric
                label="Publicações realizadas"
                value={savedCount === null ? "—" : String(savedCount)}
                icon={CheckCircle2}
                detail="Confirmadas no histórico"
              />
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <Panel title="Sua preparação">
                {queue.length ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      A última prévia tem {queue.length} itens e pode ser revisada na seção
                      Agendamento.
                    </p>
                    <button
                      onClick={() => setTab("fila")}
                      className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                    >
                      Revisar prévia
                    </button>
                  </div>
                ) : (
                  <Empty
                    icon={CalendarDays}
                    title="Sua fila começa aqui"
                    text="Adicione vídeos à biblioteca e monte sua programação. Os agendamentos salvos aparecem no Histórico."
                  />
                )}
              </Panel>
              <Panel title="Próximos passos">
                <div className="space-y-3">
                  <Step
                    number="1"
                    title="Adicionar vídeos"
                    text="Selecione arquivos do seu computador."
                    onClick={() => setTab("biblioteca")}
                  />
                  <Step
                    number="2"
                    title="Preparar legendas"
                    text="Defina o texto e as hashtags padrão."
                    onClick={() => setTab("conteudo")}
                  />
                  <Step
                    number="3"
                    title="Montar a programação"
                    text="Confira datas e horários na prévia."
                    onClick={() => setTab("fila")}
                  />
                </div>
              </Panel>
            </div>
          </section>
        )}

        <div hidden={tab !== "perfis"}>
          <InstagramProfileDrafts
            workspaceId={workspace.id}
            accounts={connectedAccounts.filter((account) => account.connection_status === "connected")}
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
              setSelectedAccountId(accountId);
              setExtraAccountIds([]);
              setSelectedVideoIds(available);
              setDailyLimit(daily);
              setQuantity(available.length || daily);
              setRepeatVideos(false);
              setNotice("Conta e preferências da ficha carregadas. Gere uma prévia antes de agendar.");
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
            accounts={connectedAccounts.filter((account) => account.connection_status === "connected")}
            profileAccount={storyAccount}
          />
        </div>

        {tab === "historico" && (
          <InstagramHistory
            workspaceId={workspace.id}
            timezone={workspace.timezone}
            refreshKey={historyRefresh}
          />
        )}

        {tab === "contas" && (
          <section className="mt-6">
            <Panel title="Contas do Instagram">
              {connectedAccounts.length ? (
                <div className="space-y-2">
                  {connectedAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-md border border-border px-4 py-3 text-sm"
                    >
                      <span>@{account.username}</span>
                      <span className="text-xs text-muted-foreground">
                        {account.account_type ?? "Conta profissional"} · {account.connection_status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  icon={Instagram}
                  title="Nenhuma conta conectada"
                  text="Conecte uma conta profissional pelo fluxo oficial da Meta. Não informe sua senha do Instagram aqui."
                />
              )}
              <div className="mt-4 rounded-md border border-border bg-secondary/40 p-4">
                <p className="text-sm font-semibold">O que será necessário</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
                  <li>
                    Aplicativo Meta com as permissões de publicação aprovadas
                    (pages_show_list, pages_read_engagement, instagram_basic,
                    instagram_content_publish, business_management).
                  </li>
                  <li>Domínio HTTPS e callback OAuth registrados no aplicativo Meta.</li>
                  <li>
                    Para conectar pelo Facebook: conta profissional do Instagram vinculada a uma
                    Página do Facebook.
                  </li>
                </ul>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => void connectInstagram("facebook_login")}
                  disabled={connecting}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <Plus className="size-3" />{" "}
                  {connecting ? "Abrindo autorização…" : "Conectar com Facebook"}
                </button>
                <button
                  onClick={() => void connectInstagram("instagram_login")}
                  disabled={connecting}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-4 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  <Instagram className="size-3" /> Conectar com Instagram
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Recomendado: conectar com Facebook, para contas profissionais vinculadas a uma
                Página do Facebook.
              </p>
            </Panel>
          </section>
        )}

        {tab === "biblioteca" && (
          <section className="mt-6 space-y-4">
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
                  MP4 ou MOV · até 500 MB · armazenamento privado por workspace
                </p>
              </button>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {selectedVideoIds.length} selecionado(s) de {videos.length} arquivo(s) salvos
                </span>
                <span>
                  {formattedSize(videos.reduce((total, video) => total + video.size, 0))} no total
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
              <fieldset className="mb-5 rounded-md border border-border p-3">
                <legend className="px-1 text-xs font-semibold">Publicar nas contas</legend>
                {connectedAccounts
                  .filter((account) => account.connection_status === "connected")
                  .map((account) => (
                    <label
                      key={account.id}
                      className="mr-4 inline-flex items-center gap-2 py-2 text-sm"
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
                {!connectedAccounts.some(
                  (account) => account.connection_status === "connected",
                ) && (
                  <p className="text-xs text-muted-foreground">
                    Conecte sua primeira conta na seção Contas.
                  </p>
                )}
              </fieldset>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Publicações por conta">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={quantity}
                    onChange={(event) => setQuantity(Number(event.target.value))}
                    className="field"
                  />
                </Field>
                <Field label="Data inicial">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="field"
                  />
                </Field>
                <Field label="Horários separados por vírgula">
                  <input
                    value={times}
                    onChange={(event) => setTimes(event.target.value)}
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
                    onChange={(event) => setDailyLimit(Number(event.target.value))}
                    className="field"
                  />
                </Field>
                <Field label="Intervalo mínimo (minutos)">
                  <input
                    type="number"
                    min={1}
                    value={intervalMinutes}
                    onChange={(event) => setIntervalMinutes(Number(event.target.value))}
                    className="field"
                  />
                </Field>
                <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs leading-5 text-muted-foreground">
                  Fuso: {workspace.timezone}. A prévia verifica o intervalo mínimo entre os horários
                  deste lote. Confira também os agendamentos anteriores no Histórico.
                </div>
              </div>
              <label className="mt-4 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={repeatVideos}
                  onChange={(event) => setRepeatVideos(event.target.checked)}
                />{" "}
                Permitir repetir os vídeos selecionados quando o lote for maior que o acervo.
              </label>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
                <div>
                  <p className="text-sm font-semibold">Gerar prévia local</p>
                  <p className="text-xs text-muted-foreground">
                    Usa os arquivos selecionados e não envia nada ao Instagram.
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
              title={`${queueSaved ? "Agendamentos salvos" : "Prévia da fila"} · ${queue.length} itens`}
              action={
                queue.length > 0 && !queueSaved ? (
                  <button
                    onClick={clearQueue}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Limpar
                  </button>
                ) : undefined
              }
            >
              {queue.length ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    As contas e legendas abaixo fazem parte desta prévia. Para mudar, ajuste as
                    opções e gere uma nova prévia.
                  </p>
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
                          : "Salvar agendamento"}
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
                <Field label="Horários padrão">
                  <input
                    value={times}
                    onChange={(event) => setTimes(event.target.value)}
                    className="field"
                  />
                </Field>
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
                      no Vault do Supabase. Só publica itens que já foram agendados pela equipe.
                      O horário real pode variar; acompanhe o resultado no Histórico.
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
    </>
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
