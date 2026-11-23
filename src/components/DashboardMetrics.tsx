import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardMetric = {
  label: string;
  value: string;
  hint: string;
  title?: string;
  iconColor?: string;
  valueColor?: string;
  icon: LucideIcon;
};

export function DashboardMetrics({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4" aria-label="Indicadores do Dashboard">
      {metrics.map(({ label, value, hint, title, iconColor, valueColor, icon: Icon }) => (
        <li
          key={label}
          className="min-w-0 rounded-xl border border-border bg-card px-3 py-2.5 sm:px-3.5"
        >
          <div
            className="flex items-start gap-2 text-xs font-semibold text-muted-foreground"
            title={title}
          >
            <Icon className={cn("size-4 shrink-0", iconColor ?? "text-brand-red")} aria-hidden />
            <span>{label}</span>
          </div>
          <p
            className={cn(
              "mt-1.5 font-display text-lg font-bold break-words tabular-nums sm:text-xl",
              valueColor,
            )}
          >
            {value === "—" && <span className="sr-only">Indisponível</span>}
            {value}
          </p>
          {hint && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p>}
        </li>
      ))}
    </ul>
  );
}
