import { SALES_PERIODS } from "./sales-events.ts";
import type { SalesPeriod } from "./sales-events.ts";

export const SCALEHOT_PERIODS = SALES_PERIODS.filter(({ key }) => key !== "all");

export function scaleHotDateRange(period: Exclude<SalesPeriod, "all">, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const [year, month, day] = ["year", "month", "day"].map((key) =>
    Number(parts.find(({ type }) => type === key)?.value),
  );
  const localDate = (date: number, monthOffset = 0) =>
    new Date(Date.UTC(year, month - 1 + monthOffset, date)).toISOString().slice(0, 10);
  const start = {
    today: localDate(day),
    yesterday: localDate(day - 1),
    "7d": localDate(day - 6),
    "30d": localDate(day - 29),
    month: localDate(1),
    "2m": localDate(1, -1),
  }[period];
  return { since: start, until: localDate(period === "yesterday" ? day - 1 : day) };
}

export function previousScaleHotRange({ since, until }: { since: string; until: string }) {
  const day = 86_400_000;
  const first = Date.parse(since);
  const span = Date.parse(until) - first + day;
  return {
    since: new Date(first - span).toISOString().slice(0, 10),
    until: new Date(first - day).toISOString().slice(0, 10),
  };
}
