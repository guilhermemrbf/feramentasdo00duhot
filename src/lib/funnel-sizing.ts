import type { FlowNode } from "./funnel-model";

export type SizeAdjustment =
  { scale: number; spacing: boolean } | { width?: number; height?: number };

/** Resize only the selection, keeping a shared scale even when a node reaches a limit. */
export function resizeFlowNodes(
  nodes: FlowNode[],
  ids: string[],
  adjustment: SizeAdjustment,
): FlowNode[] {
  const selected = new Set(ids);
  const targets = nodes.filter((node) => selected.has(node.id));
  if (!targets.length) return nodes;
  if ("scale" in adjustment) {
    if (!Number.isFinite(adjustment.scale) || adjustment.scale <= 0) return nodes;
    const min = Math.max(...targets.flatMap((node) => [32 / node.width, 32 / node.height]));
    const max = Math.min(...targets.flatMap((node) => [1600 / node.width, 1200 / node.height]));
    const scale = Math.min(max, Math.max(min, adjustment.scale));
    const left = Math.min(...targets.map((node) => node.x));
    const top = Math.min(...targets.map((node) => node.y));
    return nodes.map((node) =>
      selected.has(node.id)
        ? {
            ...node,
            width: Math.round(node.width * scale),
            height: Math.round(node.height * scale),
            ...(adjustment.spacing
              ? {
                  x: left + (node.x - left) * scale,
                  y: top + (node.y - top) * scale,
                }
              : {}),
          }
        : node,
    );
  }
  const bounded = (value: number | undefined, max: number) =>
    value !== undefined && Number.isFinite(value) && value > 0
      ? Math.round(Math.min(max, Math.max(32, value)))
      : undefined;
  const width = bounded(adjustment.width, 1600);
  const height = bounded(adjustment.height, 1200);
  return nodes.map((node) =>
    selected.has(node.id)
      ? {
          ...node,
          ...(width === undefined ? {} : { width }),
          ...(height === undefined ? {} : { height }),
        }
      : node,
  );
}
