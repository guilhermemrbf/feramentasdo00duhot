import { zonedDateTimeToIso } from "./scheduling.ts";

export const maxReelsPerBatch = 1000;
export const maxDailyReels = 24;
export type ReelOrder = "selection" | "numeric" | "random";

export function orderReelVideos<T extends { name: string; importPosition: number | null }>(
  videos: readonly T[],
  order: ReelOrder,
  fromFolder: boolean,
  random = Math.random,
) {
  const ordered = [...videos];
  if (order === "numeric") {
    const compare = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
    ordered.sort((left, right) => compare.compare(left.name, right.name));
  } else if (order === "random") {
    for (let index = ordered.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [ordered[index], ordered[other]] = [ordered[other], ordered[index]];
    }
  } else if (fromFolder) {
    ordered.sort((left, right) => (left.importPosition ?? 0) - (right.importPosition ?? 0));
  }
  return ordered;
}

export function captionWithHashtags(description: string, hashtags: string) {
  return [description.trim(), reelHashtags(hashtags).join(" ")].filter(Boolean).join("\n\n");
}

export function reelHashtags(value: string) {
  return value
    .split(/[\s,#]+/)
    .filter(Boolean)
    .map((word) => `#${word}`);
}

export function dailyReelTimes(count: number) {
  if (count === 1) return "18:00";
  const start = Math.max(0, Math.min(480, 1320 - 120 * (count - 1)));
  const minutes = Math.floor((1320 - start) / (count - 1));
  return Array.from({ length: count }, (_, index) => {
    const time = start + minutes * index;
    return `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`;
  }).join(", ");
}

export function buildReelSchedule<T>(
  videos: readonly T[],
  total: number,
  startDate: string,
  times: readonly string[],
  timezone: string,
) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  if (
    !videos.length ||
    !times.length ||
    !Number.isFinite(start) ||
    new Date(start).toISOString().slice(0, 10) !== startDate
  ) {
    throw new Error("Invalid Reel schedule");
  }
  const format = new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, dateStyle: "short" });
  return Array.from({ length: total }, (_, index) => {
    const day = new Date(start + 86_400_000 * Math.floor(index / times.length))
      .toISOString()
      .slice(0, 10);
    const time = times[index % times.length];
    const scheduledAt = zonedDateTimeToIso(day, time, timezone);
    return {
      video: videos[index % videos.length],
      scheduledAt,
      time,
      date: format.format(new Date(scheduledAt)),
    };
  });
}
