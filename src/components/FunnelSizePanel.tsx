import { useState } from "react";
import { RotateCcw } from "lucide-react";
import type { FlowNode } from "@/lib/funnel-model";
import type { SizeAdjustment } from "@/lib/funnel-sizing";

export function FunnelSizePanel({
  nodes,
  onResize,
  onUndo,
  canUndo,
}: {
  nodes: FlowNode[];
  onResize: (adjustment: SizeAdjustment) => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  const [spacing, setSpacing] = useState(true);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const multiple = nodes.length > 1;
  const common = (key: "width" | "height") =>
    nodes.every((node) => node[key] === nodes[0][key]) ? String(nodes[0][key]) : "Variados";
  const inputClass =
    "mt-1.5 w-full rounded-lg border border-slate-600 bg-[#0d1119] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-400";
  return (
    <section
      aria-label="Ajustar tamanho"
      className="space-y-4 rounded-xl border border-slate-700 bg-[#0d1119]/60 p-3"
    >
      <h3 className="text-sm font-semibold text-white">
        {multiple ? "Tamanho dos selecionados" : "Tamanho do elemento"}
      </h3>
      <p className="text-xs leading-5 text-slate-400">
        Ajuste o tamanho real {multiple ? "de todos juntos" : "do bloco"}. As conexões acompanham os
        elementos.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onResize({ scale: 0.9, spacing: multiple && spacing })}
          className="rounded-lg border border-slate-600 px-2 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
        >
          Diminuir 10%
        </button>
        <button
          onClick={() => onResize({ scale: 1.1, spacing: multiple && spacing })}
          className="rounded-lg border border-blue-400/40 bg-blue-500/15 px-2 py-3 text-sm font-semibold text-blue-200 hover:bg-blue-500/25"
        >
          Aumentar 10%
        </button>
      </div>
      {multiple && (
        <label className="flex items-start gap-2 text-xs leading-5 text-slate-300">
          <input
            type="checkbox"
            checked={spacing}
            onChange={(event) => setSpacing(event.target.checked)}
            className="mt-1 accent-blue-400"
          />
          Ajustar espaçamento junto para manter a proporção do grupo
        </label>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onResize({
            ...(width ? { width: Number(width) } : {}),
            ...(height ? { height: Number(height) } : {}),
          });
          setWidth("");
          setHeight("");
        }}
        className="space-y-3 border-t border-slate-700 pt-3"
      >
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-300">
            Largura (px)
            <input
              aria-label="Largura em pixels"
              type="number"
              min={32}
              max={1600}
              step={1}
              placeholder={common("width")}
              value={width}
              onChange={(event) => setWidth(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-xs text-slate-300">
            Altura (px)
            <input
              aria-label="Altura em pixels"
              type="number"
              min={32}
              max={1200}
              step={1}
              placeholder={common("height")}
              value={height}
              onChange={(event) => setHeight(event.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <button
          disabled={!width && !height}
          className="w-full rounded-lg bg-blue-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-400 disabled:opacity-40"
        >
          {multiple ? "Aplicar aos selecionados" : "Aplicar medidas"}
        </button>
        <p className="text-[11px] leading-4 text-slate-400">
          Deixe um campo vazio para manter essa medida. Largura: 32–1600 px; altura: 32–1200 px.
        </p>
      </form>
      {canUndo && (
        <button
          onClick={onUndo}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600 px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
        >
          <RotateCcw className="size-4" />
          Desfazer último ajuste de tamanho
        </button>
      )}
    </section>
  );
}
