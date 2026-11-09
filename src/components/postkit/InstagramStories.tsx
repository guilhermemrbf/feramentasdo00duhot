import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { zonedDateTimeToIso } from "@/lib/scheduling";
import { CalendarDays, CaseSensitive, Hash, ImagePlus, Link2, UserRound } from "lucide-react";
import { DailyTimeSlots } from "@/components/postkit/DailyTimeSlots";
import {
  buildStorySchedule,
  clampSticker,
  readStoryStickers,
  stickerKinds,
  stickerLabels,
  stickerPositions,
  stickerText,
  storyBatchLimit,
  validateStoryStickers,
  type Position,
  type StickerKind,
  type StoryAudience,
  type StorySticker,
  type StoryStickers,
} from "@/lib/instagram-story-layout";

type Account = { id: string; username: string };
type MediaType = "image/jpeg" | "image/png" | "video/mp4" | "video/quicktime" | "video/webm";
type Media = { id: string; file: File; url: string; mime: MediaType };
type Planned = { media: Media; date: string; time: string };
const stickerIcons = { link: Link2, mention: UserRound, hashtag: Hash, text: CaseSensitive };
const stickerHelp = {
  link: "Leva quem tocar na figurinha para o endereço escolhido.",
  mention: "Mostra o @ de outro perfil do Instagram.",
  hashtag: "Adiciona um tópico ao Story, como #oferta.",
  text: "Mostra uma frase sobre a foto ou o vídeo.",
};
type State = "pending" | "done" | "cancelled";
type Reminder = {
  id: string;
  workspace_id: string;
  instagram_account_id: string;
  storage_path: string;
  filename: string;
  mime_type: MediaType;
  link_url: string | null;
  link_title: string | null;
  stickers: StoryStickers | null;
  audience: StoryAudience;
  sticker_x: number;
  sticker_y: number;
  scheduled_at: string;
  state: State;
  created_at: string;
};
type ReminderInsert = Omit<Reminder, "state" | "created_at">;
type StoryDatabase = {
  public: {
    Tables: {
      instagram_story_reminders: {
        Row: Reminder;
        Insert: ReminderInsert;
        Update: { state: State };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

const storyClient = supabase as unknown as SupabaseClient<StoryDatabase>;
const mimeTypes: Record<string, MediaType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};
const button =
  "rounded-md border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50";
const primary =
  "rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50";
const mediaBucket = "postkit-media";
function localDate(zone: string) {
  const pieces = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((type) => pieces.find((piece) => piece.type === type)?.value)
    .join("-");
}

function saveDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function escapeCalendar(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n|\r/g, "\\n")
    .replace(/([,;])/g, "\\$1");
}

function calendarStamp(iso: string) {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function exportCalendar(rows: Reminder[], accounts: Account[]) {
  const items = rows.filter(
    (row) => row.state === "pending" && Date.parse(row.scheduled_at) > Date.now(),
  );
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//00duHot//Stories//PT-BR",
    "CALSCALE:GREGORIAN",
  ];
  for (const row of items) {
    const account = accounts.find((item) => item.id === row.instagram_account_id);
    const title = "Publicar Story" + (account ? " em @" + account.username : "");
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + row.id + "@00duhot",
      "DTSTAMP:" + calendarStamp(new Date().toISOString()),
      "DTSTART:" + calendarStamp(row.scheduled_at),
      "SUMMARY:" + escapeCalendar(title),
      "DESCRIPTION:" +
        escapeCalendar(
          row.filename + "\nAbra a aba Stories do 00duHot para preparar a publicação.",
        ),
      "BEGIN:VALARM",
      "TRIGGER:PT0M",
      "ACTION:DISPLAY",
      "DESCRIPTION:" + escapeCalendar(title),
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR", "");
  const encoder = new TextEncoder();
  const folded = lines.map((line) => {
    let part = "";
    let bytes = 0;
    const parts: string[] = [];
    for (const char of line) {
      const length = encoder.encode(char).length;
      if (bytes + length > 75) {
        parts.push(part);
        part = " ";
        bytes = 1;
      }
      part += char;
      bytes += length;
    }
    parts.push(part);
    return parts.join("\r\n");
  });
  saveDownload(
    new Blob([folded.join("\r\n")], { type: "text/calendar;charset=utf-8" }),
    "00duhot-stories.ics",
  );
}

function StoryPreview({
  source,
  mime,
  stickers,
  onMove,
  onSelect,
}: {
  source?: string;
  mime?: string;
  stickers: StoryStickers;
  onMove?: (kind: StickerKind, next: Position) => void;
  onSelect?: (kind: StickerKind) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: StickerKind; x: number; y: number } | null>(null);
  function move(event: PointerEvent<HTMLButtonElement>, kind: StickerKind) {
    const bounds = frame.current?.getBoundingClientRect();
    const offset = drag.current;
    if (!bounds || !offset || offset.kind !== kind) return;
    onMove?.(
      kind,
      clampSticker({
        x: ((event.clientX - bounds.left - offset.x) * 100) / bounds.width,
        y: ((event.clientY - bounds.top - offset.y) * 100) / bounds.height,
      }),
    );
  }
  return (
    <div className="mx-auto max-w-[330px] rounded-[2rem] border-[5px] border-white/15 bg-black p-1">
      <div
        ref={frame}
        className="relative flex aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-[1.6rem] bg-[#111114]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-3 z-10 h-2.5 w-14 -translate-x-1/2 rounded-full bg-white/25"
        />
        {source &&
          (mime?.startsWith("video/") ? (
            <video
              key={source}
              src={source}
              controls
              muted
              playsInline
              preload="metadata"
              className="size-full object-contain"
            />
          ) : (
            <img
              src={source}
              alt="Mídia selecionada para Story"
              className="size-full object-contain"
            />
          ))}
        {!source && (
          <span className="px-4 text-center text-sm text-white/70">
            Arraste ou selecione uma foto ou vídeo.
          </span>
        )}
        {source &&
          stickerKinds.map((kind) => {
            const item = stickers[kind];
            if (!item?.value.trim()) return null;
            const style = {
              left: item.x + "%",
              top: item.y + "%",
              maxWidth:
                Math.min(kind === "text" ? 72 : 54, 2 * Math.min(item.x, 100 - item.x)) + "%",
            };
            const badge =
              "absolute -translate-x-1/2 -translate-y-1/2 break-words rounded-lg px-2.5 py-1.5 text-center text-xs font-bold shadow " +
              (kind === "text"
                ? "whitespace-pre-wrap bg-black/75 text-white"
                : kind === "link"
                  ? "bg-white text-sky-800"
                  : kind === "mention"
                    ? "bg-white text-fuchsia-800"
                    : "bg-white text-violet-800");
            const label = (kind === "link" ? "🔗 " : "") + stickerText(kind, item);
            if (!onMove)
              return (
                <span key={kind} className={badge} style={style}>
                  {label}
                </span>
              );
            return (
              <button
                key={kind}
                type="button"
                className={badge + " touch-none cursor-grab"}
                style={style}
                aria-label={stickerLabels[kind] + ". Use as setas para mover."}
                onFocus={() => onSelect?.(kind)}
                onPointerDown={(event) => {
                  const bounds = event.currentTarget.getBoundingClientRect();
                  drag.current = {
                    kind,
                    x: event.clientX - bounds.left - bounds.width / 2,
                    y: event.clientY - bounds.top - bounds.height / 2,
                  };
                  onSelect?.(kind);
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event, kind);
                }}
                onLostPointerCapture={() => {
                  drag.current = null;
                }}
                onKeyDown={(event) => {
                  const dx = event.key === "ArrowLeft" ? -2 : event.key === "ArrowRight" ? 2 : 0;
                  const dy = event.key === "ArrowUp" ? -2 : event.key === "ArrowDown" ? 2 : 0;
                  if (!dx && !dy) return;
                  event.preventDefault();
                  onMove(kind, clampSticker({ x: item.x + dx, y: item.y + dy }));
                }}
              >
                {label}
              </button>
            );
          })}
      </div>
    </div>
  );
}

export function InstagramStories({
  workspaceId,
  timezone,
  accounts,
  profileAccount,
}: {
  workspaceId: string;
  timezone: string;
  accounts: Account[];
  profileAccount?: { id: string; request: string; productUrl: string | null };
}) {
  const [accountId, setAccountId] = useState("");
  const account = accountId ? accounts.find((item) => item.id === accountId) : accounts[0];
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase
      .rpc("has_workspace_role", {
        target_workspace: workspaceId,
        allowed_roles: ["owner", "admin", "editor"],
      })
      .then(({ data, error }) => {
        if (active) setCanEdit(!error && data === true);
      });
    return () => {
      active = false;
    };
  }, [workspaceId]);
  const [media, setMedia] = useState<Media[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [layouts, setLayouts] = useState<Record<string, StoryStickers>>({});
  const [audiences, setAudiences] = useState<Record<string, StoryAudience>>({});
  const [stickerKind, setStickerKind] = useState<StickerKind>("link");
  const [uploadProgress, setUploadProgress] = useState("");
  const uploaded = useRef(new Set<string>());
  const [date, setDate] = useState(() => localDate(timezone));
  const [times, setTimes] = useState("09:00, 18:00");
  const [order, setOrder] = useState("selection");
  const [plan, setPlan] = useState<Planned[]>([]);
  const [planError, setPlanError] = useState("");
  const [saved, setSaved] = useState<Reminder[]>([]);
  const [opened, setOpened] = useState<{ row: Reminder; url: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [profileLink, setProfileLink] = useState<{ id: string; url: string }>();
  const handledProfile = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!profileAccount || handledProfile.current === profileAccount.request) return;
    handledProfile.current = profileAccount.request;
    if (busy || media.length) {
      setNotice("Finalize o lote de Stories que já está aberto antes de carregar outra ficha.");
      return;
    }
    setAccountId(profileAccount.id);
    setProfileLink(
      profileAccount.productUrl
        ? { id: profileAccount.id, url: profileAccount.productUrl }
        : undefined,
    );
    setNotice("Conta da ficha selecionada. Adicione a mídia para preparar os Stories.");
  }, [profileAccount, busy, media.length]);
  const [browserAlerts, setBrowserAlerts] = useState(false);
  const urls = useRef(new Set<string>());
  const notified = useRef(new Set<string>());
  const pendingDue = saved.filter(
    (row) => row.state === "pending" && Date.parse(row.scheduled_at) <= now,
  );
  const current = media.find((item) => item.id === selectedId) ?? media[0];
  const currentLayout = current ? (layouts[current.id] ?? {}) : {};
  const currentAudience = current ? (audiences[current.id] ?? "story") : "story";
  const currentSticker = currentLayout[stickerKind] ?? {
    ...stickerPositions[stickerKind],
    value: "",
  };
  const previewSequence = plan.length ? plan.map((entry) => entry.media) : media;
  const previewIndex = previewSequence.findIndex((entry) => entry.id === current?.id);
  const savedStickers = opened ? readStoryStickers(opened.row.stickers, opened.row) : {};

  function setSticker(id: string, kind: StickerKind, item?: StorySticker) {
    setLayouts((all) => ({ ...all, [id]: { ...all[id], [kind]: item } }));
  }

  function copySticker(kind: StickerKind) {
    if (!opened) return;
    const item = savedStickers[kind];
    if (!item) return;
    void navigator.clipboard
      .writeText(item.value)
      .then(() => setNotice(stickerLabels[kind] + " copiado."))
      .catch(() => setNotice("Selecione e copie o conteúdo exibido."));
  }

  const formatTime = (value: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(value));

  const refresh = useCallback(async () => {
    const { data, error } = await storyClient
      .from("instagram_story_reminders")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("scheduled_at");
    if (error) {
      setLoadError("Não foi possível carregar a agenda de Stories.");
      return;
    }
    setLoadError("");
    setSaved(data ?? []);
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 15_000);
    const reload = window.setInterval(() => {
      void refresh();
    }, 60_000);
    const localUrls = urls.current;
    return () => {
      window.clearInterval(timer);
      window.clearInterval(reload);
      for (const url of localUrls) URL.revokeObjectURL(url);
      localUrls.clear();
    };
  }, [refresh]);

  useEffect(() => {
    if (
      !browserAlerts ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    )
      return;
    for (const row of pendingDue) {
      if (notified.current.has(row.id)) continue;
      try {
        new Notification("Story pronto no 00duHot", {
          body: "Abra a agenda para copiar o link e publicar no Instagram.",
          tag: row.id,
        });
        notified.current.add(row.id);
      } catch {
        setBrowserAlerts(false);
        break;
      }
    }
  }, [browserAlerts, pendingDue]);

  function chooseFiles(files: FileList | null) {
    if (busy || !canEdit || !account || loadError) return;
    const additions: Media[] = [];
    let skipped = 0;
    for (const file of Array.from(files ?? [])) {
      const mime = mimeTypes[file.name.split(".").at(-1)?.toLowerCase() ?? ""];
      if (
        !mime ||
        !file.size ||
        file.size > 50 * 1024 * 1024 ||
        media.length + additions.length >= storyBatchLimit
      ) {
        skipped += 1;
        continue;
      }
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      additions.push({ id: crypto.randomUUID(), file, url, mime });
    }
    setMedia((previous) => [...previous, ...additions]);
    if (profileLink && profileLink.id === account?.id && additions.length) {
      const link = profileLink.url;
      setLayouts((previous) => ({
        ...previous,
        ...Object.fromEntries(
          additions.map((item) => [item.id, { link: { ...stickerPositions.link, value: link } }]),
        ),
      }));
    }
    setPlan([]);
    setNotice(
      skipped
        ? "Alguns arquivos foram ignorados. Use JPG, PNG, MP4, MOV ou WebM de até 50 MB, com até 45 itens por lote."
        : "",
    );
  }

  function moveMedia(index: number, delta: number) {
    const next = [...media];
    const item = next[index];
    const target = next[index + delta];
    if (!item || !target) return;
    next[index] = target;
    next[index + delta] = item;
    setMedia(next);
    setPlan([]);
  }

  function removeMedia(item: Media) {
    URL.revokeObjectURL(item.url);
    urls.current.delete(item.url);
    setMedia((previous) => previous.filter((entry) => entry.id !== item.id));
    setPlan([]);
  }

  function generatePlan() {
    setPlanError("");
    try {
      if (!account || !media.length) throw new Error("Escolha a conta e pelo menos uma mídia.");
      if (times.split(",").some((slot) => !slot.trim()))
        throw new Error("Preencha todos os horários ou remova os campos que ficaram vazios.");
      const today = localDate(timezone);
      if (date < today) throw new Error("Escolha hoje ou uma data futura.");
      const currentTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date());
      const nextPlan = buildStorySchedule(
        media,
        date,
        times,
        order === "random",
        Math.random,
        date === today ? currentTime : undefined,
      );
      setPlan(nextPlan);
      setSelectedId(nextPlan[0].media.id);
      setNotice("");
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : "Não foi possível montar a sequência.");
    }
  }

  async function savePlan() {
    if (!canEdit || !account || !plan.length || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const rows: ReminderInsert[] = plan.map(({ media: item, date, time }) => {
        let stickers: StoryStickers;
        try {
          stickers = validateStoryStickers(layouts[item.id] ?? {});
        } catch (error) {
          throw new Error(
            item.file.name +
              ": " +
              (error instanceof Error ? error.message : "figurinha inválida."),
          );
        }
        const filename = item.file.name.replace(/[^A-Za-z0-9_.-]/g, "_").slice(-120) || "story";
        return {
          id: item.id,
          workspace_id: workspaceId,
          instagram_account_id: account.id,
          storage_path: [workspaceId, item.id, filename].join("/"),
          filename,
          mime_type: item.mime,
          stickers,
          audience: audiences[item.id] ?? "story",
          link_url: stickers.link?.value ?? null,
          link_title: stickers.link ? stickerText("link", stickers.link) : null,
          sticker_x: stickers.link?.x ?? stickerPositions.link.x,
          sticker_y: stickers.link?.y ?? stickerPositions.link.y,
          scheduled_at: zonedDateTimeToIso(date, time, timezone),
        };
      });
      if (
        rows.some(
          (row, i) =>
            Date.parse(row.scheduled_at) <= Date.now() ||
            (i > 0 && row.scheduled_at <= rows[i - 1].scheduled_at),
        )
      )
        throw new Error("Os horários precisam estar no futuro e em ordem crescente.");
      const { data: existing, error: existingError } = await storyClient
        .from("instagram_story_reminders")
        .select("id")
        .in(
          "id",
          rows.map((row) => row.id),
        )
        .eq("workspace_id", workspaceId);
      if (existingError) throw new Error("A agenda está indisponível. Tente de novo.");
      const existingIds = new Set((existing ?? []).map((row) => row.id));
      const unsaved = rows.filter((row) => !existingIds.has(row.id));
      for (const [index, row] of unsaved.entries()) {
        setUploadProgress("Mídia " + (index + 1) + " de " + unsaved.length);
        if (uploaded.current.has(row.storage_path)) continue;
        const item = plan.find((entry) => entry.media.id === row.id)?.media;
        if (!item) throw new Error("Selecione novamente a mídia.");
        const { error } = await storyClient.storage
          .from(mediaBucket)
          .upload(row.storage_path, item.file, { contentType: item.mime, upsert: true });
        if (error)
          throw new Error("Falha ao salvar " + row.filename + ". Você pode tentar de novo.");
        uploaded.current.add(row.storage_path);
      }
      if (unsaved.length) {
        const { error } = await storyClient
          .from("instagram_story_reminders")
          .upsert(unsaved, { onConflict: "id", ignoreDuplicates: true });
        if (error)
          throw new Error("O agendamento não foi confirmado. Tente de novo com esta prévia.");
      }
      for (const item of media) {
        URL.revokeObjectURL(item.url);
        urls.current.delete(item.url);
      }
      setMedia([]);
      setLayouts({});
      setAudiences({});
      uploaded.current.clear();
      setPlan([]);
      setSelectedId("");
      await refresh();
      setNotice(
        "Stories salvos na agenda. Use o calendário para receber lembretes com o site fechado.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível salvar a agenda.");
    } finally {
      setUploadProgress("");
      setBusy(false);
    }
  }

  async function openReminder(row: Reminder) {
    const { data, error } = await storyClient.storage
      .from(mediaBucket)
      .createSignedUrl(row.storage_path, 600);
    if (error || !data) {
      setNotice("Não foi possível abrir a mídia do Story.");
      return;
    }
    setOpened({ row, url: data.signedUrl });
  }

  async function resolveReminder(row: Reminder, state: "done" | "cancelled") {
    if (!canEdit || busy) return;
    setBusy(true);
    try {
      const { data, error } = await storyClient
        .from("instagram_story_reminders")
        .update({ state })
        .eq("id", row.id)
        .eq("workspace_id", workspaceId)
        .eq("state", "pending")
        .select("id");
      setNotice(
        error
          ? "Não foi possível atualizar o lembrete."
          : data?.length
            ? "Agenda atualizada."
            : "Este lembrete já foi atualizado.",
      );
      await refresh();
      setOpened(null);
    } catch {
      setNotice("Não foi possível confirmar a atualização. Confira a agenda.");
    } finally {
      setBusy(false);
    }
  }

  async function enableAlerts() {
    if (typeof Notification === "undefined") {
      setNotice(
        "Este navegador não oferece avisos nesta página. Use a exportação para o calendário.",
      );
      return;
    }
    try {
      const allowed = (await Notification.requestPermission()) === "granted";
      setBrowserAlerts(allowed);
      setNotice(
        allowed
          ? "Avisos ativos enquanto o 00duHot estiver aberto."
          : "O navegador não autorizou os avisos. Use a exportação para o calendário.",
      );
    } catch {
      setNotice("Use a exportação para receber lembretes no calendário.");
    }
  }

  return (
    <section className="mt-6 space-y-4" aria-label="Stories">
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Criar Stories no Instagram</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Monte até {storyBatchLimit} Stories, personalize cada um e distribua os lembretes pelos
          próximos dias.
        </p>
        <p className="mt-3 rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/5 p-3 text-sm">
          <strong className="text-fuchsia-300">Publicação assistida.</strong> Quando chegar o
          horário, abra o Instagram na conta escolhida, adicione as figurinhas e publique. Exporte
          para o seu calendário se quiser receber lembretes com o site fechado.
        </p>
        {pendingDue.length > 0 && (
          <p className="mt-3 rounded-md bg-primary/10 p-3 text-sm" role="status">
            {pendingDue.length} Story(s) pronto(s) para publicar.
          </p>
        )}
        {loadError && <p className="mt-3 text-sm text-amber-500">{loadError}</p>}
        {notice && (
          <p className="mt-3 text-sm text-primary" role="status">
            {notice}
          </p>
        )}
        {!accounts.length && (
          <p className="mt-3 text-sm text-muted-foreground">
            Conecte um perfil na aba Contas para montar a agenda.
          </p>
        )}
      </div>

      {canEdit && (
        <fieldset disabled={busy || !account || !!loadError} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1fr)]">
            <div className="space-y-4 rounded-lg border border-border bg-card p-5 lg:col-start-2 lg:row-start-1">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <ImagePlus className="size-4 text-sky-300" /> 1. Conta, fotos e vídeos
              </h3>
              <label className="block text-sm">
                Em qual conta você vai publicar?
                <select
                  className="field mt-1"
                  value={account?.id ?? ""}
                  onChange={(event) => setAccountId(event.target.value)}
                >
                  {!account && <option value="">Selecione uma conta conectada</option>}
                  {accounts.map((item) => (
                    <option key={item.id} value={item.id}>
                      @{item.username}
                    </option>
                  ))}
                </select>
              </label>
              <label
                className="block rounded-lg border border-dashed border-sky-500/40 bg-sky-500/5 p-3 text-sm"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  chooseFiles(event.dataTransfer.files);
                }}
              >
                Selecionar fotos ou vídeos
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.mp4,.mov,.webm"
                  className="field mt-1"
                  onChange={(event) => {
                    chooseFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Arraste ou selecione até {storyBatchLimit} arquivos. Clique em um deles para
                  editar na prévia.
                </span>
              </label>
              {media.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {media.length}/{storyBatchLimit} Stories. Use as setas para mudar a ordem.
                </p>
              )}
              <div className="max-h-56 space-y-2 overflow-auto">
                {media.map((item, i) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 rounded-md border p-2 ${current?.id === item.id ? "border-primary/50 bg-primary/10" : "border-border"}`}
                  >
                    <button
                      className="min-w-0 flex-1 truncate text-left text-xs"
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      aria-pressed={current?.id === item.id}
                    >
                      {i + 1}. {item.file.name}
                    </button>
                    <button
                      className={button}
                      type="button"
                      disabled={i === 0}
                      aria-label={"Subir " + item.file.name}
                      onClick={() => moveMedia(i, -1)}
                    >
                      ↑
                    </button>
                    <button
                      className={button}
                      type="button"
                      disabled={i === media.length - 1}
                      aria-label={"Descer " + item.file.name}
                      onClick={() => moveMedia(i, 1)}
                    >
                      ↓
                    </button>
                    <button className={button} type="button" onClick={() => removeMedia(item)}>
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="self-start rounded-lg border border-border bg-card p-5 lg:sticky lg:top-4 lg:col-start-1 lg:row-start-1 lg:row-end-3">
              <h3 className="mb-3 text-center text-sm font-semibold">Prévia no celular</h3>
              <StoryPreview
                source={current?.url}
                mime={current?.mime}
                stickers={currentLayout}
                onSelect={setStickerKind}
                onMove={(kind, next) => {
                  const item = currentLayout[kind];
                  if (current && item) setSticker(current.id, kind, { ...item, ...next });
                }}
              />
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Arraste cada figurinha na prévia para definir a posição.
              </p>
              {current && (
                <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    className={button}
                    disabled={previewIndex < 1}
                    onClick={() => setSelectedId(previewSequence[previewIndex - 1].id)}
                  >
                    Anterior
                  </button>
                  <span>
                    {previewIndex + 1} de {previewSequence.length}
                  </span>
                  <button
                    type="button"
                    className={button}
                    disabled={previewIndex >= previewSequence.length - 1}
                    onClick={() => setSelectedId(previewSequence[previewIndex + 1].id)}
                  >
                    Próximo
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-4 rounded-lg border border-border bg-card p-5 lg:col-start-2 lg:row-start-2">
              <div className="space-y-3 rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/5 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Link2 className="size-4 text-fuchsia-300" /> 2. Figurinhas e público
                </h3>
                <p className="text-xs text-muted-foreground">
                  Escolha uma figurinha e arraste-a no celular para marcar a posição.
                </p>
                <div
                  className="grid grid-cols-2 gap-1 rounded-lg bg-background p-1 sm:grid-cols-4"
                  role="group"
                  aria-label="Tipo de figurinha"
                >
                  {stickerKinds.map((kind) => {
                    const Icon = stickerIcons[kind];
                    return (
                      <button
                        type="button"
                        key={kind}
                        aria-pressed={kind === stickerKind}
                        disabled={!current}
                        className={
                          "flex items-center justify-center gap-1 rounded-md px-1 py-2 text-xs " +
                          (stickerKind === kind
                            ? "bg-fuchsia-500/15 font-bold text-fuchsia-200"
                            : "text-muted-foreground")
                        }
                        onClick={() => setStickerKind(kind)}
                      >
                        <Icon className="size-3.5" /> {stickerLabels[kind]}
                        {currentLayout[kind]?.value.trim() ? " •" : ""}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">{stickerHelp[stickerKind]}</p>
                <label className="block text-sm">
                  {stickerKind === "link"
                    ? "Endereço do link (URL)"
                    : stickerKind === "mention"
                      ? "Perfil para mencionar"
                      : stickerKind === "hashtag"
                        ? "Hashtag do Story"
                        : "Texto do Story"}
                  <input
                    type={stickerKind === "link" ? "url" : "text"}
                    disabled={!current}
                    className="field mt-1"
                    maxLength={
                      stickerKind === "link"
                        ? 2048
                        : stickerKind === "mention"
                          ? 31
                          : stickerKind === "hashtag"
                            ? 101
                            : 220
                    }
                    placeholder={
                      stickerKind === "link"
                        ? "https://exemplo.com.br"
                        : stickerKind === "mention"
                          ? "@perfil"
                          : stickerKind === "hashtag"
                            ? "#oferta"
                            : "Escreva aqui"
                    }
                    value={currentSticker.value}
                    onChange={(event) => {
                      if (current)
                        setSticker(current.id, stickerKind, {
                          ...currentSticker,
                          value: event.target.value,
                        });
                    }}
                  />
                </label>
                {stickerKind === "link" && (
                  <label className="block text-sm">
                    Texto que aparece na figurinha (opcional)
                    <input
                      disabled={!current}
                      className="field mt-1"
                      maxLength={60}
                      placeholder="Ex.: Saiba mais, Compre aqui"
                      value={currentSticker.title ?? ""}
                      onChange={(event) => {
                        if (current)
                          setSticker(current.id, "link", {
                            ...currentSticker,
                            title: event.target.value,
                          });
                      }}
                    />
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Exemplo: a pessoa vê “Saiba mais” e, ao tocar, vai para a URL acima.
                    </span>
                  </label>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={button}
                    disabled={!current || !currentLayout[stickerKind]}
                    onClick={() => {
                      if (current) setSticker(current.id, stickerKind);
                    }}
                  >
                    Remover figurinha
                  </button>
                  <button
                    type="button"
                    className={button}
                    disabled={!currentSticker.value.trim() || media.length < 2}
                    onClick={() => {
                      setLayouts((previous) => {
                        const updated = { ...previous };
                        for (const item of media) {
                          if (item.id === current?.id) continue;
                          const existing = updated[item.id]?.[stickerKind];
                          updated[item.id] = {
                            ...updated[item.id],
                            [stickerKind]: {
                              ...currentSticker,
                              x: existing?.x ?? currentSticker.x,
                              y: existing?.y ?? currentSticker.y,
                            },
                          };
                        }
                        return updated;
                      });
                      setNotice(
                        stickerLabels[stickerKind] + " aplicado a todos os Stories do lote.",
                      );
                    }}
                  >
                    Repetir em todos os Stories
                  </button>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Quem vai ver este Story?</h3>
                <p className="mb-2 text-xs text-muted-foreground">
                  Use a mesma opção ao publicar pelo Instagram.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["story", "close_friends"] as const).map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      disabled={!current}
                      className={
                        button +
                        " flex-col items-start gap-1 text-left " +
                        (choice === currentAudience
                          ? " border-primary bg-primary/10 text-primary"
                          : "")
                      }
                      aria-pressed={choice === currentAudience}
                      onClick={() => {
                        if (current) setAudiences((all) => ({ ...all, [current.id]: choice }));
                      }}
                    >
                      <span className="font-semibold">
                        {choice === "story" ? "Seu Story" : "Amigos Próximos"}
                      </span>
                      <span className="text-muted-foreground">
                        {choice === "story"
                          ? "Público habitual da conta"
                          : "Apenas sua lista verde"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3 rounded-xl border border-border p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="size-4 text-primary" /> 3. Dias, horários e ordem
                </h3>
                <p className="text-xs text-muted-foreground">
                  Um Story por horário. A sequência continua nos dias seguintes até completar o
                  lote.
                </p>
                <label className="block max-w-xs text-sm font-semibold">
                  Em que dia começar?
                  <input
                    className="field mt-1"
                    type="date"
                    value={date}
                    onChange={(event) => {
                      setDate(event.target.value);
                      setPlan([]);
                    }}
                  />
                </label>
                <DailyTimeSlots
                  value={times}
                  limit={storyBatchLimit}
                  onChange={(value) => {
                    setTimes(value);
                    setPlan([]);
                  }}
                />
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">Em que ordem?</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      {
                        id: "selection",
                        label: "Na ordem da lista",
                        help: "Segue a ordem das fotos e dos vídeos acima.",
                      },
                      {
                        id: "random",
                        label: "Embaralhar Stories",
                        help: "Sorteia a ordem quando você abre a revisão.",
                      },
                    ].map((choice) => (
                      <label
                        key={choice.id}
                        className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${order === choice.id ? "border-primary/50 bg-primary/10" : "border-border"}`}
                      >
                        <input
                          type="radio"
                          name="story-order"
                          value={choice.id}
                          className="mt-1"
                          checked={order === choice.id}
                          onChange={() => {
                            setOrder(choice.id);
                            setPlan([]);
                          }}
                        />
                        <span className="text-sm font-semibold">
                          {choice.label}
                          <span className="mt-1 block text-xs font-normal text-muted-foreground">
                            {choice.help}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <p className="text-xs text-muted-foreground">Fuso dos lembretes: {timezone}.</p>
                {planError && (
                  <p role="alert" className="text-sm text-amber-300">
                    {planError}
                  </p>
                )}
                <button
                  type="button"
                  className={primary}
                  onClick={generatePlan}
                  disabled={!media.length}
                >
                  Revisar programação de Stories
                </button>
              </div>
            </div>
          </div>
          {plan.length > 0 && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-5">
              <h3 className="font-semibold">4. Confira os lembretes de @{account?.username}</h3>
              <p className="text-xs text-muted-foreground">
                {plan.length} Stories · Fuso: {timezone}. Ajuste as datas e horários antes de
                salvar.
              </p>
              {plan.map((item, i) => (
                <div
                  key={item.media.id}
                  className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                >
                  <button
                    type="button"
                    className="truncate text-left text-sm"
                    onClick={() => setSelectedId(item.media.id)}
                  >
                    {i + 1}. {item.media.file.name}
                  </button>
                  <input
                    aria-label={"Data do Story " + (i + 1)}
                    className="field"
                    type="date"
                    value={item.date}
                    onChange={(event) =>
                      setPlan((rows) =>
                        rows.map((row, n) =>
                          n === i ? { ...row, date: event.target.value } : row,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label={"Horário do Story " + (i + 1)}
                    className="field"
                    type="time"
                    value={item.time}
                    onChange={(event) =>
                      setPlan((rows) =>
                        rows.map((row, n) =>
                          n === i ? { ...row, time: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </div>
              ))}
              <button type="button" className={primary} onClick={() => void savePlan()}>
                {busy ? uploadProgress || "Salvando…" : "Salvar " + plan.length + " lembretes"}
              </button>
            </div>
          )}
        </fieldset>
      )}

      <div className="space-y-3 rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Agenda de Stories</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={button}
              disabled={browserAlerts}
              onClick={() => void enableAlerts()}
            >
              {browserAlerts ? "Avisos ativos" : "Ativar avisos"}
            </button>
            <button
              type="button"
              className={button}
              disabled={
                !saved.some((row) => row.state === "pending" && Date.parse(row.scheduled_at) > now)
              }
              onClick={() => exportCalendar(saved, accounts)}
            >
              Exportar calendário
            </button>
          </div>
        </div>
        {!saved.length && <p className="text-sm text-muted-foreground">A agenda está vazia.</p>}
        {saved.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center gap-2 border-t border-border py-3"
          >
            <div className="min-w-48 flex-1 text-sm">
              <p className="break-all font-medium">{row.filename}</p>
              <p className="text-xs text-muted-foreground">
                {formatTime(row.scheduled_at)} ·{" "}
                {accounts.find((item) => item.id === row.instagram_account_id)?.username ??
                  "Conta desconectada"}
              </p>
            </div>
            <span className="text-xs">
              {row.state === "done"
                ? "Marcado como publicado"
                : row.state === "cancelled"
                  ? "Cancelado"
                  : Date.parse(row.scheduled_at) <= now
                    ? "Pronto para publicar"
                    : "Agendado"}
            </span>
            <button type="button" className={button} onClick={() => void openReminder(row)}>
              Preparar Story
            </button>
          </div>
        ))}
      </div>

      {opened && (
        <div className="grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-[250px_minmax(0,1fr)]">
          <StoryPreview source={opened.url} mime={opened.row.mime_type} stickers={savedStickers} />
          <div className="space-y-3">
            <h3 className="font-semibold">Publicação no Instagram</h3>
            <p className="text-sm font-medium">
              {accounts.find((item) => item.id === opened.row.instagram_account_id)?.username ??
                "Conta desconectada"}
            </p>
            <p className="text-sm text-muted-foreground">
              Adicione a mídia no Instagram, copie as figurinhas e posicione cada uma como na
              prévia.
            </p>
            <p className="text-sm">
              Público: {opened.row.audience === "close_friends" ? "Amigos Próximos" : "Seu Story"}
            </p>
            {stickerKinds.map((kind) => {
              const item = savedStickers[kind];
              if (!item) return null;
              return (
                <div key={kind} className="rounded-md border border-border p-2 text-sm">
                  <p className="font-medium">{stickerLabels[kind]}</p>
                  <p className="break-all">{item.value}</p>
                  {kind === "link" && item.title && (
                    <p className="text-xs text-muted-foreground">Título: {item.title}</p>
                  )}
                  <button
                    type="button"
                    className={button + " mt-1"}
                    onClick={() => copySticker(kind)}
                  >
                    Copiar {stickerLabels[kind].toLowerCase()}
                  </button>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={button}
                onClick={() =>
                  void storyClient.storage
                    .from(mediaBucket)
                    .download(opened.row.storage_path)
                    .then(({ data, error }) => {
                      if (error || !data) setNotice("Não foi possível baixar a mídia.");
                      else saveDownload(data, opened.row.filename);
                    })
                }
              >
                Baixar mídia
              </button>
              <a
                className={button}
                href="https://www.instagram.com/"
                target="_blank"
                rel="noreferrer"
              >
                Abrir Instagram
              </a>
              <button type="button" className={button} onClick={() => setOpened(null)}>
                Fechar prévia
              </button>
            </div>
            {canEdit && opened.row.state === "pending" && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={primary}
                  disabled={busy}
                  onClick={() => void resolveReminder(opened.row, "done")}
                >
                  Marcar como publicado
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => void resolveReminder(opened.row, "cancelled")}
                >
                  Cancelar lembrete
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
