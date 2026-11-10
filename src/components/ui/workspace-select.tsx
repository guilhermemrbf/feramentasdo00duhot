import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

const emptyOption = "__workspace_empty__";

export function WorkspaceSelect({
  label,
  options,
  value,
  onValueChange,
  disabled,
  className,
  placeholder = "Selecione uma opção",
}: {
  label: string;
  options: readonly { value: string; label: string; disabled?: boolean }[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const selected = options.find((option) => option.value === value);
  return (
    <Select
      value={selected ? selected.value || emptyOption : ""}
      onValueChange={(next) => onValueChange(next === emptyOption ? "" : next)}
      disabled={disabled}
    >
      <SelectTrigger aria-label={label} className={cn("field flex h-auto", className)}>
        <SelectValue placeholder={placeholder}>{selected?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent className="w-(--radix-select-trigger-width)" align="start" sideOffset={5}>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value || emptyOption}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
