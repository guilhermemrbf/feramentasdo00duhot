import type { ReactNode } from "react";
import { dailyReelTimes, maxDailyReels } from "@/lib/postkit-reel-batch";
import { DailyTimeSlots } from "./DailyTimeSlots";
import { WorkspaceSelect } from "@/components/ui/workspace-select";

const dailyCounts = Array.from({ length: maxDailyReels }, (_, index) => ({
  value: String(index + 1),
  label: index === 0 ? "1 Reel por dia" : `${index + 1} Reels por dia`,
}));

export function ReelTimingFields({
  value,
  slots,
  onChange,
  intervalMinutes,
  onIntervalChange,
  children,
}: {
  value: string;
  slots: string[];
  onChange: (value: string) => void;
  intervalMinutes: number;
  onIntervalChange: (value: number) => void;
  children?: ReactNode;
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
      <div className="space-y-1.5">
        <label className="block w-full max-w-60 text-sm font-semibold text-sky-200">
          Quantos Reels por dia?
          <WorkspaceSelect
            label="Quantos Reels por dia?"
            className="mt-1"
            value={String(entries.length)}
            options={dailyCounts}
            onValueChange={(value) => onChange(dailyReelTimes(Number(value)))}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Ao mudar a quantidade por conta, sugerimos novos horários. Você pode editar cada um.
        </p>
      </div>

      <DailyTimeSlots value={value} onChange={onChange} limit={maxDailyReels} reelLabels />
      {hasEmpty && (
        <p className="text-sm text-amber-200">Preencha os horários em branco para continuar.</p>
      )}
      {!hasEmpty && hasDuplicate && (
        <p className="text-sm text-amber-200">
          Há horários repetidos. Escolha um horário diferente para cada Reel.
        </p>
      )}
      {!hasEmpty && !hasDuplicate && firstConflict >= 0 && (
        <p className="rounded-lg bg-amber-400/10 p-3 text-sm text-amber-200">
          {slots[firstConflict - 1]} e {slots[firstConflict]} ficam a menos de {intervalMinutes}{" "}
          minutos de distância. Separe os horários ou ajuste o intervalo em Mais opções.
        </p>
      )}

      <details className="rounded-lg border border-sky-400/15 bg-card/70 p-3">
        <summary className="cursor-pointer text-sm font-semibold">Mais opções</summary>
        {children && <div className="mt-3 space-y-3">{children}</div>}
        <label className="mt-3 block max-w-56 text-sm font-medium">
          Intervalo mínimo (minutos)
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
