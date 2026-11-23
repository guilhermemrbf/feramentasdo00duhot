import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Settings2, Target } from "lucide-react";
import { useState, type FormEvent } from "react";
import { saveSalesGoal } from "@/lib/api/sales.functions";
import { salesMoney } from "@/lib/sales-events";

export function SalesGoal({ current, target }: { current: number; target: number | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const save = useServerFn(saveSalesGoal);
  const query = useQueryClient();
  const mutation = useMutation({
    mutationFn: save,
    onSuccess: async () => {
      await query.invalidateQueries({ queryKey: ["sales-overview"] });
      setEditing(false);
    },
  });
  const progress = target ? Math.min(100, Math.floor((current * 100) / target)) : 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = value.trim().replace(",", ".");
    if (!/^\d{1,11}(?:\.\d{1,2})?$/.test(normalized) || Number(normalized) > 10_000_000_000) {
      setError("Informe um valor em reais com até duas casas decimais.");
      return;
    }
    setError("");
    mutation.mutate({ data: { cents: Math.round(Number(normalized) * 100) } });
  }

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Target className="size-5 text-primary" aria-hidden /> Metas
        </h2>
        <button
          type="button"
          className="sales-button sales-button-outline"
          aria-expanded={editing}
          onClick={() => {
            setValue(target ? String(target / 100).replace(".", ",") : "");
            setError("");
            mutation.reset();
            setEditing(!editing);
          }}
        >
          <Settings2 className="size-4" aria-hidden /> {editing ? "Fechar" : "Definir metas"}
        </button>
      </div>
      <div className="sales-panel p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="font-display font-semibold">Meta Mensal</h3>
          {Boolean(target) && (
            <span className="rounded-full bg-muted px-2 py-1 text-xs">{progress}%</span>
          )}
        </div>
        <p className="font-display text-2xl font-bold tabular-nums">{salesMoney(current)}</p>
        <p className="mb-3 text-xs text-muted-foreground">
          {target ? "de " + salesMoney(target) : "Nenhuma meta mensal definida"}
        </p>
        {Boolean(target) && (
          <progress
            className="h-2 w-full accent-primary"
            aria-label="Progresso da meta mensal"
            value={progress}
            max={100}
          />
        )}
        {editing && (
          <form
            onSubmit={submit}
            className="mt-4 flex max-w-sm flex-wrap items-end gap-3 border-t border-border pt-4"
          >
            <label className="grid min-w-32 flex-1 gap-1 text-sm">
              Meta mensal (R$)
              <input
                className="field"
                inputMode="decimal"
                required
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </label>
            <button type="submit" className="sales-button" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando…" : "Salvar meta"}
            </button>
            {(error || mutation.error) && (
              <p className="w-full text-sm text-destructive" role="alert">
                {error || mutation.error?.message}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
