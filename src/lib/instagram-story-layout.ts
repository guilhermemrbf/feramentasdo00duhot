export const storyBatchLimit = 45;
export const stickerKinds = ["link", "mention", "hashtag", "text"] as const;
export type StickerKind = (typeof stickerKinds)[number];
export type Position = { x: number; y: number };
export type StorySticker = Position & { value: string; title?: string };
export type StoryStickers = Partial<Record<StickerKind, StorySticker>>;
export type StoryAudience = "story" | "close_friends";

export const stickerLabels: Record<StickerKind, string> = {
  link: "Link",
  mention: "Menção",
  hashtag: "Hashtag",
  text: "Texto",
};

export const stickerPositions: Record<StickerKind, Position> = {
  link: { x: 50, y: 75 },
  mention: { x: 50, y: 63 },
  hashtag: { x: 50, y: 86 },
  text: { x: 50, y: 25 },
};

export function clampSticker({ x, y }: Position): Position {
  return {
    x: Math.min(85, Math.max(15, Math.round(x))),
    y: Math.min(90, Math.max(10, Math.round(y))),
  };
}

export function stickerText(kind: StickerKind, sticker: StorySticker) {
  if (kind === "link") return sticker.title?.trim() || "Saiba mais";
  const value = sticker.value.trim();
  if (kind === "mention") return "@" + value.replace(/^@/, "");
  if (kind === "hashtag") return "#" + value.replace(/^#/, "");
  return value;
}

export function validateStoryStickers(stickers: StoryStickers): StoryStickers {
  const validated: StoryStickers = {};
  for (const kind of stickerKinds) {
    const draft = stickers[kind];
    const value = draft?.value.trim();
    if (!draft || !value) continue;
    if (kind === "link") {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        throw new Error("Informe um link HTTPS completo.");
      }
      if (url.protocol !== "https:" || url.username || url.password || url.href.length > 2048)
        throw new Error("Informe um link HTTPS válido.");
      validated.link = {
        ...clampSticker(draft),
        value: url.href,
        title: draft.title?.trim().slice(0, 60),
      };
      continue;
    }
    if (kind === "mention" && !/^@?[A-Za-z0-9._]{1,30}$/.test(value))
      throw new Error("Informe uma menção como @perfil.");
    if (kind === "hashtag" && !/^#?[\p{L}\p{N}_]{1,100}$/u.test(value))
      throw new Error("Informe uma hashtag sem espaços.");
    if (kind === "text" && value.length > 220) throw new Error("Use até 220 caracteres no texto.");
    validated[kind] = { ...clampSticker(draft), value: stickerText(kind, draft) };
  }
  return validated;
}

export function readStoryStickers(
  stored: unknown,
  legacy: {
    link_url: string | null;
    link_title: string | null;
    sticker_x: number;
    sticker_y: number;
  },
): StoryStickers {
  if (!stored || typeof stored !== "object") {
    return legacy.link_url
      ? {
          link: {
            value: legacy.link_url,
            title: legacy.link_title ?? undefined,
            x: legacy.sticker_x,
            y: legacy.sticker_y,
          },
        }
      : {};
  }
  const stickers: StoryStickers = {};
  for (const kind of stickerKinds) {
    const entry = (stored as Record<string, unknown>)[kind];
    if (!entry || typeof entry !== "object") continue;
    const { value, x, y, title } = entry as Partial<StorySticker>;
    if (
      typeof value !== "string" ||
      typeof x !== "number" ||
      typeof y !== "number" ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    )
      continue;
    stickers[kind] = {
      ...clampSticker({ x, y }),
      value,
      title: typeof title === "string" ? title : undefined,
    };
  }
  return stickers;
}

export function buildStorySchedule<T>(
  items: readonly T[],
  firstDay: string,
  times: string,
  randomize: boolean,
  random = Math.random,
  firstDayAfter?: string,
): Array<{ media: T; date: string; time: string }> {
  if (!items.length || items.length > storyBatchLimit)
    throw new Error("Escolha entre 1 e 45 Stories.");
  const first = new Date(firstDay + "T12:00:00Z");
  if (!Number.isFinite(first.getTime()) || first.toISOString().slice(0, 10) !== firstDay)
    throw new Error("Escolha uma data válida.");
  const slots = [...new Set(times.split(",").map((time) => time.trim()))].sort();
  if (slots.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)))
    throw new Error("Informe horários no formato 09:00, 18:00.");
  const sequence = [...items];
  if (randomize) {
    for (let i = sequence.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [sequence[i], sequence[j]] = [sequence[j], sequence[i]];
    }
  }
  const firstDaySlots = firstDayAfter ? slots.filter((time) => time > firstDayAfter) : slots;
  return sequence.map((media, index) => {
    if (index < firstDaySlots.length) return { media, date: firstDay, time: firstDaySlots[index] };
    const remaining = index - firstDaySlots.length;
    const date = new Date(first);
    date.setUTCDate(date.getUTCDate() + 1 + Math.floor(remaining / slots.length));
    return { media, date: date.toISOString().slice(0, 10), time: slots[remaining % slots.length] };
  });
}
