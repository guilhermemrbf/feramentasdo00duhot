import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { ptBR } from "react-day-picker/locale";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "@/lib/utils";

function parseDay(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

function dayValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function WorkspaceDate({
  label,
  value,
  onValueChange,
  min,
  max,
  disabled,
  className,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDay(value);
  const first = parseDay(min);
  const last = parseDay(max);
  const display = selected ? selected.toLocaleDateString("pt-BR") : "Escolher data";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${display}`}
          disabled={disabled}
          className={cn(
            "field flex items-center gap-2 tabular-nums data-[state=open]:border-primary",
            className,
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="flex-1">{display}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        aria-label={label}
        align="start"
        sideOffset={6}
        className="z-[70] w-fit max-w-[calc(100vw-24px)] overflow-auto border-input p-1 shadow-xl shadow-black/50"
      >
        <Calendar
          autoFocus
          mode="single"
          required
          locale={ptBR}
          selected={selected}
          defaultMonth={selected ?? first ?? last}
          startMonth={first}
          endMonth={last}
          disabled={(date) => (!!first && date < first) || (!!last && date > last)}
          onSelect={(date) => {
            onValueChange(dayValue(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
