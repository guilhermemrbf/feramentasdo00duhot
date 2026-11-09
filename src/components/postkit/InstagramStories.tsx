import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { zonedDateTimeToIso } from "@/lib/scheduling";

type Account = { id: string; username: string };
type MediaType = "image/jpeg" | "image/png" | "video/mp4" | "video/quicktime" | "video/webm";
type Media = { id: string; file: File; url: string; mime: MediaType };
type Position = { x: number; y: number };
type Planned = { media: Media; date: string; time: string };
type State = "pending" | "done" | "cancelled";
type Reminder = {
  id: string;
  workspace_id: string;
  instagram_account_id: string;
  storage_path: string;
  filename: string;
  mime_type: MediaType;
  link_url: string;
  link_title: string;
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
const defaultPosition: Position = { x: 50, y: 75 };

function dateAtOffset(date: string, days: number) {
  const utc = new Date(date + "T12:00:00Z");
  if (!Number.isFinite(utc.getTime())) throw new Error("Escolha uma data válida.");
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

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
  title,
  position,
  onMove,
}: {
  source?: string;
  mime?: string;
  title: string;
  position: Position;
  onMove?: (next: Position) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const bounds = frame.current?.getBoundingClientRect();
    if (!bounds || !onMove) return;
    const x = Math.round(((event.clientX - bounds.left) * 100) / bounds.width);
    const y = Math.round(((event.clientY - bounds.top) * 100) / bounds.height);
    onMove({ x: Math.min(85, Math.max(15, x)), y: Math.min(90, Math.max(10, y)) });
  };
  const style = {
    left: position.x + "%",
    top: position.y + "%",
    maxWidth: Math.min(45, 2 * Math.min(position.x, 100 - position.x)) + "%",
  };
  const sticker =
    "absolute max-w-[45%] -translate-x-1/2 -translate-y-1/2 truncate rounded-full bg-white px-3 py-2 text-xs font-semibold text-black shadow";
  return (
    <div
      ref={frame}
      className="relative mx-auto flex aspect-[9/16] w-full max-w-[250px] items-center justify-center overflow-hidden rounded-2xl bg-black"
    >
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
          Selecione uma mídia para ver a prévia.
        </span>
      )}
      {title &&
        (onMove && source ? (
          <button
            type="button"
            style={style}
            className={sticker + " touch-none cursor-grab"}
            aria-label="Posição do adesivo. Use as setas para mover."
            onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event);
            }}
            onKeyDown={(event) => {
              const dx = event.key === "ArrowLeft" ? -2 : event.key === "ArrowRight" ? 2 : 0;
              const dy = event.key === "ArrowUp" ? -2 : event.key === "ArrowDown" ? 2 : 0;
              if (!dx && !dy) return;
              event.preventDefault();
              onMove({
                x: Math.min(85, Math.max(15, position.x + dx)),
                y: Math.min(90, Math.max(10, position.y + dy)),
              });
            }}
          >
            🔗 {title}
          </button>
        ) : (
          <span className={sticker} style={style}>
            🔗 {title}
          </span>
        ))}
    </div>
  );
}

export function InstagramStories({
  workspaceId,
  timezone,
  accounts,
}: {
  workspaceId: string;
  timezone: string;
  accounts: Account[];
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
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("Ver oferta");
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [date, setDate] = useState(() => localDate(timezone));
  const [times, setTimes] = useState("18:00");
  const [order, setOrder] = useState("selection");
  const [plan, setPlan] = useState<Planned[]>([]);
  const [saved, setSaved] = useState<Reminder[]>([]);
  const [opened, setOpened] = useState<{ row: Reminder; url: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [browserAlerts, setBrowserAlerts] = useState(false);
  const urls = useRef(new Set<string>());
  const notified = useRef(new Set<string>());
  const pendingDue = saved.filter(
    (row) => row.state === "pending" && Date.parse(row.scheduled_at) <= now,
  );
  const current = media.find((item) => item.id === selectedId) ?? media[0];
  const position = (current && positions[current.id]) || defaultPosition;
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
        media.length + additions.length >= 30
      ) {
        skipped += 1;
        continue;
      }
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      additions.push({ id: crypto.randomUUID(), file, url, mime });
    }
    setMedia((previous) => [...previous, ...additions]);
    setPlan([]);
    setNotice(
      skipped
        ? "Alguns arquivos foram ignorados. Use JPG, PNG, MP4, MOV ou WebM de até 50 MB, com até 30 itens por lote."
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
    try {
      if (!account || !media.length) throw new Error("Escolha a conta e pelo menos uma mídia.");
      const slots = [...new Set(times.split(",").map((time) => time.trim()))].sort();
      if (slots.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)))
        throw new Error("Informe horários no formato 09:00, 18:00.");
      const sequence = [...media];
      if (order === "random") {
        for (let i = sequence.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [sequence[i], sequence[j]] = [sequence[j], sequence[i]];
        }
      }
      setPlan(
        sequence.map((item, index) => ({
          media: item,
          date: dateAtOffset(date, Math.floor(index / slots.length)),
          time: slots[index % slots.length],
        })),
      );
      setSelectedId(sequence[0].id);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível montar a sequência.");
    }
  }

  async function savePlan() {
    if (!canEdit || !account || !plan.length || busy) return;
    setBusy(true);
    setNotice("");
    try {
      let productUrl: URL;
      try {
        productUrl = new URL(link.trim());
      } catch {
        throw new Error("Informe um link HTTPS completo.");
      }
      if (
        productUrl.protocol !== "https:" ||
        productUrl.username ||
        productUrl.password ||
        productUrl.href.length > 2048 ||
        !title.trim()
      )
        throw new Error("Informe um link HTTPS válido e um título para o adesivo.");
      const rows: ReminderInsert[] = plan.map(({ media: item, date, time }) => {
        const filename = item.file.name.replace(/[^A-Za-z0-9_.-]/g, "_").slice(-120) || "story";
        return {
          id: item.id,
          workspace_id: workspaceId,
          instagram_account_id: account.id,
          storage_path: [workspaceId, item.id, filename].join("/"),
          filename,
          mime_type: item.mime,
          link_url: productUrl.href,
          link_title: title.trim(),
          sticker_x: (positions[item.id] ?? defaultPosition).x,
          sticker_y: (positions[item.id] ?? defaultPosition).y,
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
      for (const row of unsaved) {
        const item = plan.find((entry) => entry.media.id === row.id)?.media;
        if (!item) throw new Error("Selecione novamente a mídia.");
        const { error } = await storyClient.storage
          .from(mediaBucket)
          .upload(row.storage_path, item.file, { contentType: item.mime, upsert: true });
        if (error)
          throw new Error("Falha ao salvar " + row.filename + ". Você pode tentar de novo.");
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
      setPositions({});
      setPlan([]);
      setSelectedId("");
      await refresh();
      setNotice(
        "Stories salvos na agenda. Use o calendário para receber lembretes com o site fechado.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível salvar a agenda.");
    } finally {
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
        <h2 className="font-display text-lg font-semibold">Stories com link</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Organize a sequência aqui. No horário, abra o Instagram na conta indicada, adicione o
          adesivo de link e publique.
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
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-4 rounded-lg border border-border bg-card p-5">
              <label className="block text-sm">
                Conta
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
                className="block rounded-md border border-dashed border-border p-3 text-sm"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  chooseFiles(event.dataTransfer.files);
                }}
              >
                Fotos e vídeos
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
                  Arraste os arquivos aqui ou use o seletor.
                </span>
              </label>
              <div className="space-y-2">
                {media.map((item, i) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-md border border-border p-2"
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
              <label className="block text-sm">
                Link da campanha para todos os Stories
                <input
                  type="url"
                  className="field mt-1"
                  maxLength={2048}
                  placeholder="https://…"
                  value={link}
                  onChange={(event) => setLink(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                Título do adesivo
                <input
                  className="field mt-1"
                  value={title}
                  maxLength={60}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm">
                  Primeiro dia
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
                <label className="block text-sm">
                  Horários por dia
                  <input
                    className="field mt-1"
                    placeholder="09:00, 18:00"
                    value={times}
                    onChange={(event) => {
                      setTimes(event.target.value);
                      setPlan([]);
                    }}
                  />
                </label>
                <label className="block text-sm">
                  Ordem
                  <select
                    className="field mt-1"
                    value={order}
                    onChange={(event) => {
                      setOrder(event.target.value);
                      setPlan([]);
                    }}
                  >
                    <option value="selection">Ordem escolhida</option>
                    <option value="random">Aleatória</option>
                  </select>
                </label>
              </div>
              <button type="button" className={primary} onClick={generatePlan}>
                Gerar prévia da agenda
              </button>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <StoryPreview
                source={current?.url}
                mime={current?.mime}
                title={title}
                position={position}
                onMove={(next) => {
                  if (current) setPositions((all) => ({ ...all, [current.id]: next }));
                }}
              />
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Arraste o adesivo para escolher onde ele deve ficar. A posição serve de referência
                na hora de publicar.
              </p>
            </div>
          </div>
          {plan.length > 0 && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-5">
              <h3 className="font-semibold">Conferir sequência · @{account?.username}</h3>
              <p className="text-xs text-muted-foreground">
                Fuso: {timezone}. Ajuste as datas e horários antes de salvar.
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
                {busy ? "Salvando…" : "Salvar lembretes"}
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
          <StoryPreview
            source={opened.url}
            mime={opened.row.mime_type}
            title={opened.row.link_title}
            position={{ x: opened.row.sticker_x, y: opened.row.sticker_y }}
          />
          <div className="space-y-3">
            <h3 className="font-semibold">Publicação no Instagram</h3>
            <p className="text-sm font-medium">
              {accounts.find((item) => item.id === opened.row.instagram_account_id)?.username ??
                "Conta desconectada"}
            </p>
            <p className="text-sm text-muted-foreground">
              Entre na conta indicada, adicione esta mídia e coloque o link no adesivo na posição da
              prévia.
            </p>
            <p className="break-all text-sm">{opened.row.link_url}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={button}
                onClick={() =>
                  void navigator.clipboard
                    .writeText(opened.row.link_url)
                    .then(() => setNotice("Link copiado."))
                    .catch(() => setNotice("Selecione e copie o link acima."))
                }
              >
                Copiar link
              </button>
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
