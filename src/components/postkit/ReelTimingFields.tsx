import { Clock3 } from "lucide-react";
import { dailyReelTimes, maxDailyReels } from "@/lib/postkit-reel-batch";
import { DailyTimeSlots } from "./DailyTimeSlots";

export function ReelTimingFields({
  value,
  slots,
  onChange,
  intervalMinutes,
  onIntervalChange,
}: {
  value: string;
  slots: string[];
  onChange: (value: string) => void;
  intervalMinutes: number;
  onIntervalChange: (value: number) => void;
}) {
  const entries = value.split(",").map((slot) => slot.trim());
  const hasEmpty = entries.includes("");
  const hasDuplicate = new Set(entries.filter(Boolean)).size < entries.filter(Boolean).length;
  const minutes = slots.map((slot) => {
    const [hours, minutes] = slot.split(":").map(Number);
    return hours * 60 + minutes;
  });
  const firstConflict = minutes.findIndex(
    (minute, index) => index > 0 && minute - minutes[index - 1] < intervalMinutes,
  );

  return (
    <div className="space-y-4 rounded-xl border border-sky-400/20 bg-sky-400/5 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <Clock3 className="size-4 text-sky-300" aria-hidden />
            Quantos Reels por dia?
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha de 1 a {maxDailyReels} Reels por conta. Defina um horário para cada Reel abaixo.
          </p>
        </div>
        <span
          className="rounded-full bg-sky-400/15 px-3 py-1 text-xs font-semibold text-sky-200"
          aria-live="polite"
        >
          {slots.length === entries.length
            ? slots.length === 1
              ? "1 Reel por dia"
              : `${slots.length} Reels por dia`
            : `${slots.length} de ${entries.length} horários prontos`}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="block w-full max-w-48 text-xs font-semibold text-muted-foreground">
          Reels por dia
          <select
            className="field mt-1"
            value={entries.length}
            onChange={(event) => {
              const count = Number(event.target.value);
              const next = Array.from({ length: count }, (_, index) => entries[index] ?? "");
              onChange(next.join(", "));
            }}
          >
            {Array.from({ length: maxDailyReels }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded-lg border border-sky-400/25 bg-card px-3 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-400/15"
          onClick={() => onChange(dailyReelTimes(entries.length))}
        >
          Preencher horários sugeridos
        </button>
      </div>

      <DailyTimeSlots value={value} onChange={onChange} limit={maxDailyReels} reelLabels />
      {slots.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Ordem em cada dia{" "}
          <span className="font-medium tabular-nums text-sky-200">{slots.join(" · ")}</span>
        </p>
      )}
      {hasEmpty && (
        <p className="text-sm text-amber-200">Preencha os horários em branco para continuar.</p>
      )}
      {hasDuplicate && (
        <p className="text-sm text-amber-200">
          Há horários repetidos. Escolha um horário diferente para cada Reel.
        </p>
      )}
      {firstConflict >= 0 && (
        <p className="rounded-lg bg-amber-400/10 p-3 text-sm text-amber-200">
          {slots[firstConflict - 1]} e {slots[firstConflict]} ficam a menos de {intervalMinutes}{" "}
          minutos de distância. Separe os horários ou ajuste o intervalo abaixo.
        </p>
      )}

      <details className="rounded-lg border border-sky-400/15 bg-card/70 p-3">
        <summary className="cursor-pointer text-sm font-semibold">
          Intervalo mínimo entre Reels
        </summary>
        <label className="mt-3 block max-w-56 text-sm font-medium">
          Minutos entre publicações
          <input
            className="field mt-1"
            type="number"
            min={1}
            value={intervalMinutes}
            onChange={(event) => onIntervalChange(Number(event.target.value))}
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          Com 120 minutos, por exemplo, um Reel às 09:00 pode ser seguido por outro a partir das
          11:00.
        </p>
      </details>
    </div>
  );
}
