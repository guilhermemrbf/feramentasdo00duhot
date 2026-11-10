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
            Escolha quantas vezes por dia
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha um ritmo sugerido ou edite os horários. Cada horário vale um Reel por conta.
          </p>
        </div>
        <span
          className="rounded-full bg-sky-400/15 px-3 py-1 text-xs font-semibold text-sky-200"
          aria-live="polite"
        >
          {slots.length === 1 ? "1 Reel por dia" : `${slots.length} Reels por dia`}
        </span>
      </div>

      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6"
        role="group"
        aria-label="Ritmos sugeridos"
      >
        {[1, 2, 3, 4, 5, 6].map((count) => {
          const suggested = dailyReelTimes(count);
          const selected = slots.join(", ") === suggested && !hasEmpty && !hasDuplicate;
          return (
            <button
              key={count}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(suggested)}
              className="rounded-lg border border-sky-400/20 bg-card px-2 py-2.5 text-sm font-semibold hover:bg-sky-400/10 aria-pressed:border-sky-400/60 aria-pressed:bg-sky-400/20 aria-pressed:text-sky-100"
            >
              {count} por dia
            </button>
          );
        })}
      </div>

      <DailyTimeSlots value={value} onChange={onChange} limit={maxDailyReels} />
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
