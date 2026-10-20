import type { FlowNode, Funnel } from "./funnel-model.ts";

function bounds(nodes: FlowNode[]) {
  return {
    left: Math.min(...nodes.map((node) => node.x)),
    top: Math.min(...nodes.map((node) => node.y)),
    right: Math.max(...nodes.map((node) => node.x + node.width)),
    bottom: Math.max(...nodes.map((node) => node.y + node.height)),
  };
}

/** Pack separate journeys without changing their internal geometry or connections. */
export function arrangeFunnelForReading(funnel: Funnel, width: number, height: number): FlowNode[] {
  if (funnel.nodes.length < 2) return funnel.nodes;
  const neighbors = new Map(funnel.nodes.map((node) => [node.id, new Set<string>()]));
  for (const edge of funnel.edges) {
    if (!neighbors.has(edge.from) || !neighbors.has(edge.to)) continue;
    neighbors.get(edge.from)!.add(edge.to);
    neighbors.get(edge.to)!.add(edge.from);
  }
  const visited = new Set<string>();
  const groups: FlowNode[][] = [];
  for (const node of funnel.nodes) {
    if (visited.has(node.id)) continue;
    const queue = [node.id];
    visited.add(node.id);
    for (let index = 0; index < queue.length; index++) {
      for (const neighbor of neighbors.get(queue[index]) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    const ids = new Set(queue);
    groups.push(funnel.nodes.filter((item) => ids.has(item.id)));
  }

  const journeys = groups.filter((group) => group.length > 1);
  const standalone = groups.filter((group) => group.length === 1);
  // Section headings travel with the closest connected journey.
  for (const group of standalone) {
    const node = group[0];
    if (node.appearance !== "label" || !journeys.length) {
      journeys.push(group);
      continue;
    }
    let nearest = journeys[0];
    let distance = Infinity;
    for (const journey of journeys) {
      const area = bounds(journey);
      const dx = Math.max(area.left - (node.x + node.width), node.x - area.right, 0);
      const dy = Math.max(area.top - (node.y + node.height), node.y - area.bottom, 0);
      const next = dx * dx + dy * dy;
      if (next < distance) {
        nearest = journey;
        distance = next;
      }
    }
    nearest.push(node);
  }
  const blocks = journeys
    .map((nodes) => ({ nodes, area: bounds(nodes) }))
    .sort((a, b) => a.area.top - b.area.top || a.area.left - b.area.left);
  let bestScore = -Infinity;
  let best = funnel.nodes;
  for (let columns = 1; columns <= blocks.length; columns++) {
    const positions = new Map<string, { x: number; y: number }>();
    let x = 80;
    let y = 80;
    let rowHeight = 0;
    for (let index = 0; index < blocks.length; index++) {
      if (index > 0 && index % columns === 0) {
        x = 80;
        y += rowHeight + 120;
        rowHeight = 0;
      }
      const block = blocks[index];
      for (const node of block.nodes)
        positions.set(node.id, {
          x: x + node.x - block.area.left,
          y: y + node.y - block.area.top,
        });
      x += block.area.right - block.area.left + 120;
      rowHeight = Math.max(rowHeight, block.area.bottom - block.area.top);
    }
    const nodes = funnel.nodes.map((node) => ({ ...node, ...positions.get(node.id) }));
    const area = bounds(nodes);
    const score = Math.min(
      Math.max(1, width - 64) / (area.right - area.left),
      Math.max(1, height - 112) / (area.bottom - area.top),
    );
    if (score > bestScore) {
      bestScore = score;
      best = nodes;
    }
  }
  return best;
}
