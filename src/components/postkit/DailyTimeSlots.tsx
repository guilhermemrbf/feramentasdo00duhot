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
    <div className="space-y-2">
      <label className="block text-sm font-semibold">
        Primeiro dia de publicação
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
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary aria-pressed:border-primary/50 aria-pressed:bg-primary/10 aria-pressed:text-primary"
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
      <p className="mb-2 text-xs text-muted-foreground">
        Adicione um horário para cada publicação que deseja fazer no mesmo dia.
      </p>
      <div className="flex flex-wrap gap-2">
        {slots.map((slot, index) => (
          <div key={index} className="flex items-end gap-1 rounded-md border border-border p-2">
            <label className="text-xs text-muted-foreground">
              Horário {index + 1}
              <input
                type="time"
                value={slot}
                className="field mt-1"
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
                className="mb-0.5 rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
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
