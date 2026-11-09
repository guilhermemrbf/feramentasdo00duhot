import { Plus, X } from "lucide-react";

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
