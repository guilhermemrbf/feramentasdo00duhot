import { SALES_PERIODS, type SalesPeriod } from "./sales-events.ts";

export type MouseHotDashboardPeriod = Exclude<SalesPeriod, "all">;

type PeriodOption = Exclude<(typeof SALES_PERIODS)[number], { key: "all" }>;

export const MOUSEHOT_DASHBOARD_PERIODS = SALES_PERIODS.filter(
  (option): option is PeriodOption => option.key !== "all",
);

export function readMouseHotSettings(metadata?: Record<string, unknown>) {
  const displayName = metadata?.mousehot_display_name;
  const period = MOUSEHOT_DASHBOARD_PERIODS.find(
    ({ key }) => key === metadata?.mousehot_dashboard_period,
  )?.key;
  return {
    displayName: typeof displayName === "string" ? displayName.trim().slice(0, 120) : "",
    period: period ?? null,
    showToolShortcuts: metadata?.mousehot_show_tool_shortcuts !== false,
  };
}
