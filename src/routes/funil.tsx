import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CirclePlus,
  GitBranch,
  GripVertical,
  Layers3,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/funil")({
  head: () => ({
    meta: [
      { title: "Funil — 00duHot" },
      { name: "description", content: "Organize e acompanhe cada etapa dos seus funis." },
    ],
  }),
  component: FunilPage,
});

type FunnelCard = { id: string; title: string; description: string };
type Funnel = { id: string; name: string; steps: string[]; cards: Record<string, FunnelCard[]> };

const STORAGE_KEY = "00duhot:funnel-workspace:v1";
const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function createFunnel(name: string): Funnel {
  const steps = ["Ideias", "Em andamento", "Revisão", "Concluído"];
  return { id: makeId(), name, steps, cards: Object.fromEntries(steps.map((step) => [step, []])) };
}

function starterFunnels(): Funnel[] {
  const funnel = createFunnel("Lançamento de produto");
  funnel.cards = {
    [funnel.steps[0]]: [
      { id: makeId(), title: "Definir oferta principal", description: "Organizar a promessa, o público e os diferenciais." },
      { id: makeId(), title: "Mapear objeções", description: "Listar as dúvidas mais comuns antes da compra." },
    ],
    [funnel.steps[1]]: [{ id: makeId(), title: "Criar página de captura", description: "Estruturar a página e o formulário de entrada." }],
    [funnel.steps[2]]: [],
    [funnel.steps[3]]: [],
  };
  return [funnel, createFunnel("Novo funil")];
}

function readFunnels(): Funnel[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return starterFunnels();
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length === 0) return starterFunnels();
    return parsed.filter((item): item is Funnel =>
      item && typeof item.id === "string" && typeof item.name === "string" &&
      Array.isArray(item.steps) && item.cards && typeof item.cards === "object",
    );
  } catch {
    return starterFunnels();
  }
}

function FunilPage() {
  const [funnels, setFunnels] = useState<Funnel[]>(() => starterFunnels());
  const [hydrated, setHydrated] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [renamingFunnel, setRenamingFunnel] = useState(false);
  const [renamingStep, setRenamingStep] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const saved = readFunnels();
    setFunnels(saved);
    setActiveId(saved[0]?.id ?? "");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(funnels));
  }, [funnels, hydrated]);

  const active = funnels.find((funnel) => funnel.id === activeId) ?? funnels[0];
  const selectedCard = useMemo(() => {
    if (!active || !selectedCardId) return null;
    for (const step of active.steps) {
      const card = (active.cards[step] ?? []).find((item) => item.id === selectedCardId);
      if (card) return { card, step };
    }
    return null;
  }, [active, selectedCardId]);
  const totalCards = active?.steps.reduce((count, step) => count + (active.cards[step]?.length ?? 0), 0) ?? 0;

  const updateActive = (updater: (funnel: Funnel) => Funnel) => {
    setFunnels((current) => current.map((funnel) => funnel.id === active?.id ? updater(funnel) : funnel));
  };

  const addFunnel = () => {
    const funnel = createFunnel(`Funil ${funnels.length + 1}`);
    setFunnels((current) => [...current, funnel]);
    setActiveId(funnel.id);
    setSelectedCardId(null);
    setNotice("Novo funil criado.");
  };

  const closeFunnel = (id: string) => {
    if (funnels.length === 1) {
      setNotice("Mantenha pelo menos um funil aberto.");
      return;
    }
    const index = funnels.findIndex((funnel) => funnel.id === id);
    const next = funnels.filter((funnel) => funnel.id !== id);
    setFunnels(next);
    if (activeId === id) setActiveId(next[Math.max(0, index - 1)]?.id ?? next[0].id);
    setSelectedCardId(null);
    setNotice("Aba fechada. Os outros funis continuam salvos.");
  };

  const addStep = () => {
    if (!active) return;
    const name = `Etapa ${active.steps.length + 1}`;
    updateActive((funnel) => ({ ...funnel, steps: [...funnel.steps, name], cards: { ...funnel.cards, [name]: [] } }));
    setNotice("Etapa adicionada ao final do fluxo.");
  };

  const renameStep = (oldName: string, nextName: string) => {
    const name = nextName.trim();
    if (!name || !active || active.steps.some((step) => step.toLowerCase() === name.toLowerCase() && step !== oldName)) {
      setRenamingStep(null);
      return;
    }
    updateActive((funnel) => {
      const cards = { ...funnel.cards, [name]: funnel.cards[oldName] ?? [] };
      if (name !== oldName) delete cards[oldName];
      return { ...funnel, steps: funnel.steps.map((step) => step === oldName ? name : step), cards };
    });
    setRenamingStep(null);
  };

  const removeStep = (step: string) => {
    if (!active) return;
    if ((active.cards[step] ?? []).length) {
      setNotice("Mova ou remova os cartões desta etapa antes de excluí-la.");
      return;
    }
    if (active.steps.length <= 1) {
      setNotice("O funil precisa ter pelo menos uma etapa.");
      return;
    }
    updateActive((funnel) => {
      const cards = { ...funnel.cards };
      delete cards[step];
      return { ...funnel, steps: funnel.steps.filter((item) => item !== step), cards };
    });
    setNotice("Etapa removida.");
  };

  const addCard = (step: string) => {
    const card = { id: makeId(), title: "Novo cartão", description: "Adicione contexto e próximos passos." };
    updateActive((funnel) => ({ ...funnel, cards: { ...funnel.cards, [step]: [...(funnel.cards[step] ?? []), card] } }));
    setSelectedCardId(card.id);
  };

  const updateCard = (id: string, patch: Partial<FunnelCard>) => {
    updateActive((funnel) => ({
      ...funnel,
      cards: Object.fromEntries(funnel.steps.map((step) => [step, (funnel.cards[step] ?? []).map((card) => card.id === id ? { ...card, ...patch } : card)])),
    }));
  };

  const deleteCard = (id: string) => {
    updateActive((funnel) => ({
      ...funnel,
      cards: Object.fromEntries(funnel.steps.map((step) => [step, (funnel.cards[step] ?? []).filter((card) => card.id !== id)])),
    }));
    setSelectedCardId(null);
    setNotice("Cartão removido.");
  };

  const moveCard = (cardId: string, destination: string) => {
    if (!active) return;
    let moving: FunnelCard | undefined;
    const cards = Object.fromEntries(active.steps.map((step) => {
      const remaining = (active.cards[step] ?? []).filter((card) => {
        if (card.id === cardId) moving = card;
        return card.id !== cardId;
      });
      return [step, remaining];
    }));
    if (!moving) return;
    cards[destination] = [...(cards[destination] ?? []), moving];
    updateActive((funnel) => ({ ...funnel, cards }));
  };

  return (
    <AppShell>
      <main className="min-h-screen bg-[radial-gradient(ellipse_at_70%_-20%,rgba(72,132,255,0.11),transparent_48%)]">
        <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><GitBranch className="size-5" /></span>
              <div>
                <p className="text-[10px] font-bold tracking-[0.16em] text-primary">ESPAÇO DE TRABALHO</p>
                <h1 className="font-display text-2xl font-bold tracking-tight">Funil</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-2 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-emerald-400" /> Salvo automaticamente neste navegador
            </div>
          </div>

          <div className="mt-6 flex min-h-12 items-end gap-1 overflow-x-auto border-b border-border/80" role="tablist" aria-label="Funis abertos">
            {funnels.map((funnel) => (
              <div key={funnel.id} className={`group flex h-11 max-w-[240px] min-w-[145px] items-center rounded-t-xl border border-b-0 px-2 ${active?.id === funnel.id ? "border-border bg-card text-foreground" : "border-transparent text-muted-foreground hover:bg-card/50"}`}>
                <button role="tab" aria-selected={active?.id === funnel.id} onClick={() => { setActiveId(funnel.id); setSelectedCardId(null); }} className="min-w-0 flex-1 truncate px-2 text-left text-xs font-semibold">{funnel.name}</button>
                <button aria-label={`Fechar ${funnel.name}`} onClick={() => closeFunnel(funnel.id)} className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-secondary hover:text-foreground"><X className="size-3.5" /></button>
              </div>
            ))}
            <button onClick={addFunnel} className="mb-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Criar funil"><Plus className="size-4" /></button>
          </div>

          {active && <>
            <section className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 py-5">
              <div className="flex min-w-0 items-center gap-3">
                <Layers3 className="size-4 shrink-0 text-primary" />
                {renamingFunnel ? <input autoFocus defaultValue={active.name} aria-label="Nome do funil" onBlur={(event) => { const name = event.currentTarget.value.trim(); if (name) updateActive((funnel) => ({ ...funnel, name })); setRenamingFunnel(false); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setRenamingFunnel(false); }} className="w-full max-w-sm rounded-lg border border-input bg-background px-3 py-2 text-lg font-bold outline-none focus:ring-2 focus:ring-ring" /> : <button onClick={() => setRenamingFunnel(true)} className="group flex min-w-0 items-center gap-2 text-left" title="Renomear funil"><h2 className="truncate font-display text-lg font-bold">{active.name}</h2><Pencil className="size-3.5 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" /></button>}
                <span className="rounded-full border border-border bg-secondary/70 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">{totalCards} {totalCards === 1 ? "cartão" : "cartões"}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={addStep} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold transition hover:border-primary/30 hover:bg-secondary"><CirclePlus className="size-4 text-primary" /> Adicionar etapa</button>
                <button onClick={addFunnel} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"><Plus className="size-4" /> Novo funil</button>
              </div>
            </section>

            {notice && <div role="status" className="mt-3 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dispensar aviso"><X className="size-3.5" /></button></div>}

            <section className="flex-1 overflow-x-auto py-5" aria-label="Etapas do funil">
              <div className="flex h-full min-h-[430px] min-w-max items-stretch gap-3 pr-3">
                {active.steps.map((step, index) => {
                  const cards = active.cards[step] ?? [];
                  return <div key={step} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const cardId = event.dataTransfer.getData("text/plain"); if (cardId) moveCard(cardId, step); }} className="flex w-[285px] flex-col rounded-2xl border border-border/80 bg-card/55 shadow-[0_10px_30px_rgba(0,0,0,0.08)] sm:w-[310px]">
                    <div className="flex items-center gap-2 border-b border-border/80 px-3 py-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">{String(index + 1).padStart(2, "0")}</span>
                      {renamingStep === step ? <input autoFocus defaultValue={step} aria-label="Nome da etapa" onBlur={(event) => renameStep(step, event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setRenamingStep(null); }} className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs font-semibold outline-none focus:ring-2 focus:ring-ring" /> : <button onClick={() => setRenamingStep(step)} title="Renomear etapa" className="min-w-0 flex-1 truncate text-left text-xs font-bold">{step}</button>}
                      <span className="rounded-md bg-secondary px-2 py-1 text-[10px] font-semibold text-muted-foreground">{cards.length}</span>
                      <button onClick={() => setRenamingStep(step)} aria-label={`Renomear ${step}`} className="flex size-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-secondary hover:text-foreground"><MoreHorizontal className="size-4" /></button>
                      <button onClick={() => removeStep(step)} aria-label={`Excluir etapa ${step}`} className="flex size-7 items-center justify-center rounded-md text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-3.5" /></button>
                    </div>
                    <div className="flex flex-1 flex-col gap-2.5 p-2.5">
                      {cards.map((card) => <article key={card.id} draggable onDragStart={(event) => { event.dataTransfer.setData("text/plain", card.id); event.dataTransfer.effectAllowed = "move"; }} className={`group rounded-xl border bg-background/75 p-3 transition hover:border-primary/30 hover:shadow-md ${selectedCardId === card.id ? "border-primary/40 ring-1 ring-primary/20" : "border-border/80"}`}>
                        <div className="flex items-start gap-2"><GripVertical className="mt-0.5 size-4 shrink-0 cursor-grab text-muted-foreground/35 opacity-0 group-hover:opacity-100" /><button onClick={() => setSelectedCardId(card.id)} className="min-w-0 flex-1 text-left"><h3 className="text-xs font-bold leading-5">{card.title || "Cartão sem título"}</h3><p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{card.description || "Sem descrição"}</p></button><button onClick={() => setSelectedCardId(card.id)} aria-label="Editar cartão" className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/40 opacity-0 hover:bg-secondary hover:text-foreground group-hover:opacity-100"><Pencil className="size-3.5" /></button></div>
                        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5"><span className="text-[10px] text-muted-foreground/60">Etapa {index + 1}</span><div className="flex gap-1"><button onClick={() => index > 0 && moveCard(card.id, active.steps[index - 1])} disabled={index === 0} aria-label="Mover para etapa anterior" className="flex size-6 items-center justify-center rounded text-muted-foreground/50 hover:bg-secondary disabled:opacity-25"><ArrowLeft className="size-3.5" /></button><button onClick={() => index < active.steps.length - 1 && moveCard(card.id, active.steps[index + 1])} disabled={index === active.steps.length - 1} aria-label="Mover para próxima etapa" className="flex size-6 items-center justify-center rounded text-muted-foreground/50 hover:bg-secondary disabled:opacity-25"><ArrowRight className="size-3.5" /></button></div></div>
                      </article>)}
                      {cards.length === 0 && <div className="flex min-h-24 flex-1 items-center justify-center rounded-xl border border-dashed border-border/80 text-center text-[11px] text-muted-foreground/55">Arraste cartões até aqui<br />ou adicione um novo</div>}
                      <button onClick={() => addCard(step)} className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/35 hover:bg-primary/5 hover:text-foreground"><Plus className="size-3.5" /> Adicionar cartão</button>
                    </div>
                  </div>;
                })}
                <button onClick={addStep} className="flex w-[150px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/25 text-xs font-semibold text-muted-foreground transition hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"><CirclePlus className="size-5 text-primary" /> Nova etapa</button>
              </div>
            </section>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 py-3 text-[10px] text-muted-foreground/65"><span>Arraste cartões entre etapas ou use as setas para avançar o fluxo.</span><span>{funnels.length} {funnels.length === 1 ? "funil aberto" : "funis abertos"}</span></footer>
          </>}
        </div>

        {active && selectedCard && <div className="fixed inset-0 z-[70] flex justify-end bg-black/45 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedCardId(null); }}>
          <aside aria-label="Editar cartão" className="flex h-full w-full max-w-md flex-col border-l border-border bg-card p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold tracking-[0.15em] text-primary">DETALHES DO CARTÃO</p><p className="mt-1 text-xs text-muted-foreground">Na etapa <span className="font-semibold text-foreground">{selectedCard.step}</span></p></div><button onClick={() => setSelectedCardId(null)} aria-label="Fechar detalhes" className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="size-4" /></button></div>
            <label className="mt-8 text-xs font-semibold">Título<input autoFocus value={selectedCard.card.title} onChange={(event) => updateCard(selectedCard.card.id, { title: event.target.value })} className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-ring/30" placeholder="Nome do cartão" /></label>
            <label className="mt-5 text-xs font-semibold">Descrição<textarea value={selectedCard.card.description} onChange={(event) => updateCard(selectedCard.card.id, { description: event.target.value })} rows={7} className="mt-2 w-full resize-y rounded-xl border border-input bg-background px-3 py-3 text-sm leading-6 outline-none focus:border-primary/50 focus:ring-2 focus:ring-ring/30" placeholder="Contexto, notas e próximos passos" /></label>
            <div className="mt-5 rounded-xl border border-border bg-background/50 p-3 text-[11px] leading-5 text-muted-foreground">As alterações ficam salvas automaticamente e cada funil mantém seus próprios cartões e etapas.</div>
            <div className="mt-auto flex items-center justify-between border-t border-border pt-4"><button onClick={() => deleteCard(selectedCard.card.id)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/10"><Trash2 className="size-3.5" /> Excluir cartão</button><button onClick={() => setSelectedCardId(null)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><Check className="size-3.5" /> Concluir</button></div>
          </aside>
        </div>}
      </main>
    </AppShell>
  );
}
