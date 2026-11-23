import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function IntegrationCopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-wrap items-end gap-2">
      <label className="grid min-w-0 flex-1 basis-44 gap-1.5 text-sm font-medium">
        {label}
        <Input
          readOnly
          value={value}
          className="h-11 font-mono text-xs"
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      <Button
        variant="outline"
        type="button"
        className="min-h-11"
        aria-label={"Copiar " + label}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast.success(label + " copiado.");
          } catch {
            toast.error("Selecione o valor no campo e copie manualmente.");
          }
        }}
      >
        <Copy aria-hidden="true" /> Copiar
      </Button>
    </div>
  );
}
