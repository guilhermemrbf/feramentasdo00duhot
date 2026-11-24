export const REPORT_HOURS = [8, 12, 18, 23] as const;
type ReportHour = (typeof REPORT_HOURS)[number];

export type MouseHotNoticePreferences = {
  pendingSales: boolean;
  salesAmount: "net" | "gross" | "hidden";
  showProduct: boolean;
  showCampaign: boolean;
  reportHours: ReportHour[];
  reportStyle: "profit" | "detailed" | "creative";
  metaSuspended: boolean;
  metaUnsettled: boolean;
  metaBilling: boolean;
  metaCurrency: "BRL" | "USD" | "EUR";
  metaThreshold: number;
};

export function mouseHotDashboardName(metadata?: Record<string, unknown>) {
  const name = metadata?.mousehot_dashboard_name;
  return (typeof name === "string" && name.trim().slice(0, 80)) || "MouseHot";
}

export function readMouseHotNoticePreferences(
  metadata?: Record<string, unknown>,
): MouseHotNoticePreferences {
  const saved = metadata?.mousehot_notice_preferences;
  const values = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
  const hours = Array.isArray(values.reportHours) ? values.reportHours : [];
  const threshold = values.metaThreshold;
  return {
    pendingSales: values.pendingSales === true,
    salesAmount:
      values.salesAmount === "gross" || values.salesAmount === "hidden"
        ? values.salesAmount
        : "net",
    showProduct: values.showProduct === true,
    showCampaign: values.showCampaign === true,
    reportHours: REPORT_HOURS.filter((hour) => hours.includes(hour)),
    reportStyle:
      values.reportStyle === "detailed" || values.reportStyle === "creative"
        ? values.reportStyle
        : "profit",
    metaSuspended: values.metaSuspended === true,
    metaUnsettled: values.metaUnsettled === true,
    metaBilling: values.metaBilling === true,
    metaCurrency:
      values.metaCurrency === "USD" || values.metaCurrency === "EUR" ? values.metaCurrency : "BRL",
    metaThreshold:
      typeof threshold === "number" &&
      Number.isFinite(threshold) &&
      threshold > 0 &&
      threshold <= 1_000_000
        ? Math.round(threshold * 100) / 100
        : 10,
  };
}
