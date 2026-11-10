import { Plus, X } from "lucide-react";
import { calendarDateInZone } from "@/lib/scheduling";

export function ScheduleDate({
  value,
  timezone,
  onChange,
}: {
  value: string;
  timezone: string;
  onChange: (value: string) => void;
}) {
  const now = new Date();
  const today = calendarDateInZone(timezone, 0, now);
  const tomorrow = calendarDateInZone(timezone, 1, now);
  return (
    <div className="space-y-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
      <label className="block text-sm font-semibold">
        Quando começa?
        <input
          className="field mt-1"
          type="date"
          min={today}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <div className="flex gap-2">
        {[
          ["Hoje", today],
          ["Amanhã", tomorrow],
        ].map(([label, date]) => (
          <button
            key={label}
            type="button"
            aria-pressed={value === date}
            onClick={() => onChange(date)}
            className="rounded-md border border-emerald-400/20 px-3 py-1.5 text-sm hover:bg-emerald-400/10 aria-pressed:border-emerald-400/50 aria-pressed:bg-emerald-400/15 aria-pressed:text-emerald-100"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DailyTimeSlots({
  value,
  onChange,
  limit,
}: {
  value: string;
  onChange: (value: string) => void;
  limit: number;
}) {
  const slots = value.split(",").map((slot) => slot.trim());

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold">Horários de cada dia</legend>
      <div className="mt-2 grid gap-2 min-[440px]:grid-cols-2 xl:grid-cols-3">
        {slots.map((slot, index) => (
          <div
            key={index}
            className="flex items-end gap-2 rounded-lg border border-border bg-card p-2.5"
          >
            <label className="min-w-0 flex-1 text-xs font-semibold text-muted-foreground">
              Horário {index + 1}
              <input
                type="time"
                value={slot}
                className="field mt-1 min-w-0 text-base tabular-nums"
                onChange={(event) =>
                  onChange(
                    slots.map((item, i) => (i === index ? event.target.value : item)).join(","),
                  )
                }
              />
            </label>
            {slots.length > 1 && (
              <button
                type="button"
                aria-label={`Remover horário ${index + 1}`}
                className="mb-0.5 shrink-0 rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() => onChange(slots.filter((_, i) => i !== index).join(","))}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      {slots.length < limit && !slots.includes("") && (
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
          onClick={() => onChange(value + ",")}
        >
          <Plus className="size-3.5" /> Adicionar horário
        </button>
      )}
    </fieldset>
  );
}
