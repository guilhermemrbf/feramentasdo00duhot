import { calendarDateInZone, zonedDateTimeToIso } from "./scheduling.ts";
import type { SalesPeriod } from "./sales-events.ts";

export function postkitOverviewPeriod(timezone: string, period: SalesPeriod, now = new Date()) {
  if (period === "all") return { start: null, end: null };
  const day = (offset: number) => calendarDateInZone(timezone, offset, now);
  const today = day(0);
  const month = today.slice(0, 7) + "-01";
  const previous = new Date(month + "T00:00:00Z");
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  const first = {
    today,
    yesterday: day(-1),
    "7d": day(-6),
    "30d": day(-29),
    month,
    "2m": previous.toISOString().slice(0, 10),
  }[period];

  return {
    start: zonedDateTimeToIso(first, "00:00", timezone),
    end: zonedDateTimeToIso(period === "yesterday" ? today : day(1), "00:00", timezone),
  };
}
