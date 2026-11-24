import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { scaleHotDateRange, SCALEHOT_PERIODS } from "@/lib/scalehot-period";
import { salesMoney, type SalesPeriod } from "@/lib/sales-events";
import { SalesPageHeader } from "./SalesLayout";

const configurations = [
  { kind: "meta_tax", title: "Imposto Meta", action: "Registrar imposto Meta" },
  { kind: "fee", title: "Taxas", action: "Adicionar taxa" },
  { kind: "tax", title: "Impostos", action: "Adicionar imposto" },
  { kind: "product", title: "Custos de produto", action: "Registrar custo" },
] as const;
type CostKind = "expense" | (typeof configurations)[number]["kind"];
type Cost = { id: string; kind: CostKind; label: string; occurred_on: string; cents: number };
type Draft = Omit<Cost, "cents" | "id"> & { value: string; id?: string };
type Period = Exclude<SalesPeriod, "all">;
const costs = () => (supabase as unknown as SupabaseClient).from("scalehot_costs");

export function ScaleHotCosts({ expenses = false }: { expenses?: boolean }) {
  const { user, offsetMs } = usePlatformAccess();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>("month");
  const [term, setTerm] = useState("");
  const [draft, setDraft] = useState<Draft>();
  const [confirming, setConfirming] = useState<string>();
  const [formError, setFormError] = useState("");
  const range = scaleHotDateRange(period, new Date(Date.now() + offsetMs));
  const query = useQuery({
    queryKey: ["scalehot-costs", user?.id, expenses, range],
    enabled: Boolean(user),
    retry: false,
    queryFn: async () => {
      const table = costs()
        .select("id,kind,label,occurred_on,cents")
        .gte("occurred_on", range.since)
        .lte("occurred_on", range.until)
        .order("occurred_on", { ascending: false })
        .order("id");
      const { data, error } = await (expenses
        ? table.eq("kind", "expense")
        : table.neq("kind", "expense"));
      if (error) throw new Error("O registro de custos está indisponível neste ambiente.");
      return data as Cost[];
    },
  });
  const refresh = async () => {
    setDraft(undefined);
    setConfirming(undefined);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["scalehot-costs", user?.id] }),
      queryClient.invalidateQueries({ queryKey: ["scalehot-operation", user?.id] }),
      queryClient.invalidateQueries({ queryKey: ["scalehot-operation-comparison", user?.id] }),
    ]);
  };
  const save = useMutation({
    mutationFn: async ({ id, row }: { id?: string; row: Omit<Cost, "id"> }) => {
      const result = id
        ? await costs().update(row).eq("id", id).select("id").single()
        : await costs().insert(row).select("id").single();
      if (result.error) throw new Error("Não foi possível salvar o lançamento.");
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const result = await costs().delete().eq("id", id).select("id").single();
      if (result.error) throw new Error("Não foi possível excluir o lançamento.");
    },
    onSuccess: refresh,
  });
  const edit = (kind: CostKind, row?: Cost) => {
    save.reset();
    remove.reset();
    setFormError("");
    setDraft({
      kind,
      id: row?.id,
      label: row?.label ?? "",
      occurred_on:
        row?.occurred_on ?? scaleHotDateRange("today", new Date(Date.now() + offsetMs)).until,
      value: row ? (row.cents / 100).toFixed(2).replace(".", ",") : "",
    });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    if (!/^\d{1,10}([,.]\d{1,2})?$/.test(draft.value.trim()) || !draft.label.trim()) {
      setFormError("Informe uma descrição e um valor válido em reais.");
      return;
    }
    const cents = Math.round(Number(draft.value.trim().replace(",", ".")) * 100);
    if (cents <= 0) {
      setFormError("O valor precisa ser maior que zero.");
      return;
    }
    save.mutate({
      id: draft.id,
      row: { label: draft.label.trim(), occurred_on: draft.occurred_on, kind: draft.kind, cents },
    });
  };
  const list =
    query.data?.filter(({ label }) =>
      label.toLocaleLowerCase("pt-BR").includes(term.trim().toLocaleLowerCase("pt-BR")),
    ) ?? [];
  const sections = expenses
    ? [{ kind: "expense" as const, title: "Lançamentos", action: "Adicionar gasto" }]
    : configurations;
  return (
    <div className="scalehot-dashboard">
      <SalesPageHeader
        title={expenses ? "Despesas" : "Taxas"}
        subtitle={
          expenses
            ? "Registre e acompanhe os gastos da operação."
            : "Lance taxas, impostos e custos de produto para o período."
        }
      />
      <div className="scalehot-filters">
        {expenses && (
          <label>
            Descrição
            <input
              className="field"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            />
          </label>
        )}
        <label>
          Período
          <select
            className="field"
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period)}
          >
            {SCALEHOT_PERIODS.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isError && (
        <p className="scalehot-notice" role="alert">
          {query.error.message}
        </p>
      )}
      {query.isPending && (
        <p className="scalehot-notice" role="status">
          Carregando lançamentos…
        </p>
      )}
      {sections.map(({ kind, title, action }) => {
        const rows = list.filter((row) => row.kind === kind);
        return (
          <section className="sales-panel p-5" key={kind}>
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {query.isSuccess
                    ? salesMoney(rows.reduce((sum, row) => sum + row.cents, 0))
                    : "—"}
                </p>
              </div>
              <Button type="button" disabled={!query.isSuccess} onClick={() => edit(kind)}>
                <Plus size={16} />
                {action}
              </Button>
            </header>
            {query.isSuccess &&
              (!rows.length ? (
                <p className="scalehot-empty">Nenhum lançamento neste período</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="scalehot-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Descrição</th>
                        <th>Valor</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <td className="whitespace-nowrap">
                            {row.occurred_on.split("-").reverse().join("/")}
                          </td>
                          <td>{row.label}</td>
                          <td className="whitespace-nowrap tabular-nums">
                            {salesMoney(row.cents)}
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                aria-label={"Editar " + row.label}
                                onClick={() => edit(kind, row)}
                              >
                                <Pencil />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                aria-label={"Excluir " + row.label}
                                onClick={() => {
                                  remove.reset();
                                  setConfirming(row.id);
                                }}
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </section>
        );
      })}
      <Dialog
        open={Boolean(draft)}
        onOpenChange={(open) => {
          if (!open && !save.isPending) setDraft(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <form className="grid gap-4" onSubmit={submit}>
              <label className="grid gap-2 text-sm">
                Descrição
                <input
                  className="field"
                  value={draft.label}
                  required
                  maxLength={120}
                  onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                />
              </label>
              <label className="grid gap-2 text-sm">
                Data
                <input
                  className="field"
                  type="date"
                  value={draft.occurred_on}
                  required
                  onChange={(event) => setDraft({ ...draft, occurred_on: event.target.value })}
                />
              </label>
              <label className="grid gap-2 text-sm">
                Valor em reais
                <input
                  className="field"
                  inputMode="decimal"
                  value={draft.value}
                  required
                  onChange={(event) => setDraft({ ...draft, value: event.target.value })}
                />
              </label>
              {(formError || save.error) && (
                <p role="alert" className="text-sm text-destructive">
                  {formError || save.error?.message}
                </p>
              )}
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Salvando…" : "Salvar lançamento"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(confirming)}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setConfirming(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir lançamento?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O valor será retirado do resultado do período.
          </p>
          {remove.error && (
            <p role="alert" className="text-sm text-destructive">
              {remove.error.message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={remove.isPending}
              onClick={() => setConfirming(undefined)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (confirming) remove.mutate(confirming);
              }}
            >
              Excluir lançamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
