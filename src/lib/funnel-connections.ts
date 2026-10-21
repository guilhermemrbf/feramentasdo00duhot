import type { FlowEdge, Funnel } from "./funnel-model.ts";

export function canConnect(funnel: Funnel, from: string, to: string) {
  return (
    from !== to &&
    funnel.nodes.some((node) => node.id === from) &&
    funnel.nodes.some((node) => node.id === to) &&
    !funnel.edges.some((edge) => edge.from === from && edge.to === to)
  );
}

export function edgeHandles(funnel: Funnel, edge: FlowEdge) {
  const from = funnel.nodes.find((node) => node.id === edge.from);
  const to = funnel.nodes.find((node) => node.id === edge.to);
  if (!from || !to) return { sourceHandle: "right", targetHandle: "left" };
  const dx = to.x + to.width / 2 - from.x - from.width / 2;
  const dy = to.y + to.height / 2 - from.y - from.height / 2;
  const vertical =
    funnel.direction === "vertical" && Math.abs(dy) > Math.max(from.height, to.height) * 0.65;
  return {
    sourceHandle:
      edge.sourceHandle ?? (vertical ? (dy >= 0 ? "bottom" : "top") : dx >= 0 ? "right" : "left"),
    targetHandle:
      edge.targetHandle ?? (vertical ? (dy >= 0 ? "top" : "bottom") : dx >= 0 ? "left" : "right"),
  };
}
