import test from "node:test";
import assert from "node:assert/strict";
import { canConnect, edgeHandles } from "../src/lib/funnel-connections.ts";
import { findFreeNodePosition } from "../src/lib/funnel-layout.ts";
import {
  createNewFunnel,
  createStarterFunnels,
  normalizeFunnels,
} from "../src/lib/funnel-model.ts";

test("new blocks stay at a free requested position and avoid existing blocks when occupied", () => {
  const funnel = createNewFunnel("Editor", "editor");
  const empty = { x: 120, y: 600 };
  assert.deepEqual(findFreeNodePosition(funnel.nodes, empty, 320, 240), empty);
  const placed = findFreeNodePosition(funnel.nodes, { x: 120, y: 280 }, 320, 240);
  assert.ok(placed.x >= 0 && placed.y >= 0);
  assert.ok(
    funnel.nodes.every(
      (node) =>
        placed.x + 320 + 24 <= node.x ||
        node.x + node.width + 24 <= placed.x ||
        placed.y + 240 + 24 <= node.y ||
        node.y + node.height + 24 <= placed.y,
    ),
  );
  assert.deepEqual(findFreeNodePosition([], { x: -10, y: -20 }, 320, 240), { x: 0, y: 0 });
});

test("direct connections accept new routes and reject duplicates, missing nodes and self-links", () => {
  const funnel = createNewFunnel("Editor", "editor");
  const [from, to] = funnel.nodes;
  assert.equal(canConnect(funnel, from.id, to.id), false);
  assert.equal(canConnect(funnel, to.id, from.id), true);
  assert.equal(canConnect(funnel, from.id, from.id), false);
  assert.equal(canConnect(funnel, "missing", to.id), false);
  assert.equal(canConnect(funnel, from.id, "missing"), false);
  assert.equal(canConnect({ ...funnel, edges: [] }, from.id, to.id), true);
});

test("existing reference connections retain vertical and side-to-side routes", () => {
  const [funnel] = createStarterFunnels();
  const organic = funnel.edges.find((edge) => edge.from === "bio-site" && edge.to === "privacy");
  assert.deepEqual(edgeHandles(funnel, organic), { sourceHandle: "bottom", targetHandle: "top" });
  const side = funnel.edges.find(
    (edge) => edge.from === "telegram-privacy-after" && edge.to === "organic-ltv",
  );
  assert.deepEqual(edgeHandles(funnel, side), { sourceHandle: "right", targetHandle: "left" });
  assert.deepEqual(edgeHandles(funnel, { ...side, from: side.to, to: side.from }), {
    sourceHandle: "left",
    targetHandle: "right",
  });
});

test("chosen ports override inferred routes and survive storage alongside rich block content", () => {
  const funnel = createNewFunnel("Editor", "editor");
  funnel.edges[0] = {
    ...funnel.edges[0],
    sourceHandle: "top",
    targetHandle: "right",
    label: "Próximo",
  };
  funnel.nodes[0] = {
    ...funnel.nodes[0],
    background: "#2563eb",
    textColor: "#ffffff",
    imageKey: "local-cover",
    imageFit: "contain",
    description: "Descrição",
    body: "Anotações",
  };
  const [saved] = normalizeFunnels(JSON.parse(JSON.stringify([funnel])));
  assert.deepEqual(saved, funnel);
  assert.deepEqual(edgeHandles(saved, saved.edges[0]), {
    sourceHandle: "top",
    targetHandle: "right",
  });
});
