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
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Indicadores do Dashboard">
      {metrics.map(({ label, value, hint, title, iconColor, valueColor, icon: Icon }) => (
        <li
          key={label}
          className="min-w-0 rounded-lg border border-border bg-card p-3 sm:p-4"
        >
          <div
            className="flex min-h-8 items-start gap-2 text-xs leading-4 font-medium text-muted-foreground sm:min-h-5"
            title={title}
          >
            <Icon
              className={cn("size-4 shrink-0", iconColor ?? "text-muted-foreground")}
              strokeWidth={1.65}
              aria-hidden
            />
            <span>{label}</span>
          </div>
          <p
            className={cn(
              "mt-1 font-display text-[1.375rem] leading-tight font-semibold break-words tabular-nums sm:text-[1.625rem]",
              valueColor,
            )}
          >
            {value === "—" && <span className="sr-only">Indisponível</span>}
            {value}
          </p>
          {hint && <p className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</p>}
        </li>
      ))}
    </ul>
  );
}
