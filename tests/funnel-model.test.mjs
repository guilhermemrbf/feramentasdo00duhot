import test from "node:test";
import assert from "node:assert/strict";
import {
  createStarterFunnels,
  migrateLegacyFunnels,
  normalizeFunnels,
} from "../src/lib/funnel-model.ts";

test("the example funnel connects every acquisition source to delivery", () => {
  const [funnel] = createStarterFunnels();
  assert.equal(funnel.name, "Funil 01");
  const ids = new Set(funnel.nodes.map((node) => node.id));
  assert.equal(ids.size, funnel.nodes.length);
  for (const edge of funnel.edges) {
    assert.ok(ids.has(edge.from) && ids.has(edge.to), `Missing endpoint in ${edge.id}`);
  }
  for (const source of funnel.nodes.filter((node) => node.kind === "source")) {
    const pending = [source.id];
    const visited = new Set();
    while (pending.length) {
      const current = pending.pop();
      if (visited.has(current)) continue;
      visited.add(current);
      pending.push(...funnel.edges.filter((edge) => edge.from === current).map((edge) => edge.to));
    }
    assert.ok(visited.has("delivery"), `${source.title} does not reach delivery`);
  }
});

test("legacy migration keeps every funnel, step, card title and description", () => {
  const old = [
    {
      id: "a",
      name: "Campanha A",
      steps: ["Entrada", "Final"],
      cards: {
        Entrada: [
          { id: "c1", title: "Cartão próprio", description: "Notas que precisam ser preservadas" },
        ],
        Final: [{ id: "c2", title: "Entrega", description: "Detalhes finais" }],
      },
    },
    { id: "b", name: "Campanha B", steps: ["Primeiro"], cards: { Primeiro: [] } },
  ];
  const migrated = migrateLegacyFunnels(old);
  assert.equal(migrated.length, 2);
  assert.deepEqual(
    migrated.map((funnel) => funnel.name),
    ["Campanha A", "Campanha B"],
  );
  assert.ok(
    migrated[0].nodes.some(
      (node) =>
        node.title === "Cartão próprio" &&
        node.description === "Notas que precisam ser preservadas",
    ),
  );
  assert.ok(
    migrated[0].nodes.some(
      (node) => node.title === "Entrega" && node.description === "Detalhes finais",
    ),
  );
  assert.equal(migrated[0].nodes.filter((node) => node.kind === "page").length, 2);
  assert.equal(migrated[1].nodes[0].title, "Primeiro");
});

test("an intentionally empty saved workspace stays empty", () => {
  assert.deepEqual(normalizeFunnels([]), []);
});

test("invalid storage falls back to a usable example without crashing", () => {
  assert.equal(normalizeFunnels({ broken: true })[0].name, "Funil 01");
  assert.equal(migrateLegacyFunnels([{ id: "broken", steps: null }]), null);
});
