import test from "node:test";
import assert from "node:assert/strict";
import {
  createStarterFunnels,
  migrateLegacyFunnels,
  normalizeFunnels,
  createNewFunnel,
  loadFunnelWorkspace,
  FUNNEL_STORAGE_KEY,
  HOT_PRESET_KEY,
} from "../src/lib/funnel-model.ts";

function reachable(funnel, source) {
  const pending = [source];
  const visited = new Set();
  while (pending.length) {
    const current = pending.pop();
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...funnel.edges.filter((edge) => edge.from === current).map((edge) => edge.to));
  }
  return visited;
}

test("Fluxo Hot matches the reference's accounts, campaign groups and separate journeys", () => {
  const funnels = createStarterFunnels();
  assert.equal(funnels.length, 1);
  const [funnel] = funnels;
  assert.equal(funnel.name, "Fluxo Hot");
  assert.equal(funnel.direction, "vertical");
  assert.equal(funnel.theme, "light");
  const ids = new Set(funnel.nodes.map((node) => node.id));
  assert.equal(ids.size, funnel.nodes.length);
  for (const edge of funnel.edges) {
    assert.ok(ids.has(edge.from) && ids.has(edge.to), `Missing endpoint in ${edge.id}`);
  }
  const organic = funnel.nodes.filter((node) => /^(tiktok|instagram|twitter)-\d{2}$/.test(node.id));
  const paid = funnel.nodes.filter((node) => /^(models|leaks)-\d{2}$/.test(node.id));
  assert.equal(organic.length, 30);
  assert.equal(paid.length, 20);
  for (const source of organic) {
    const visited = reachable(funnel, source.id);
    assert.ok(visited.has("organic-offer"), source.id);
    assert.ok(!visited.has("paid-offer") && !visited.has("group-delivery"));
  }
  for (const source of paid) {
    const visited = reachable(funnel, source.id);
    assert.ok(visited.has("paid-offer"), source.id);
    assert.ok(!visited.has("organic-offer") && !visited.has("group-delivery"));
  }
  assert.ok(reachable(funnel, "group-unlocked").has("group-delivery"));
  assert.ok(!reachable(funnel, "organic-offer").has("group-unlocked"));
  assert.ok(reachable(funnel, "privacy").has("privacy-up-01"));
  assert.ok(reachable(funnel, "telegram-organic-entry").has("organic-up-02"));
});

test("the authorized replacement removes all previous funnels and only runs once", () => {
  const values = new Map([
    [
      FUNNEL_STORAGE_KEY,
      JSON.stringify([createNewFunnel("Antigo 1"), createNewFunnel("Antigo 2")]),
    ],
    ["00duhot:funnel-workspace:v1", "old legacy funnels"],
    ["another-tool", "unrelated data"],
  ]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const first = loadFunnelWorkspace(storage);
  assert.equal(first.replaced, true);
  assert.deepEqual(
    first.funnels.map((funnel) => funnel.name),
    ["Fluxo Hot"],
  );
  assert.equal(storage.getItem(HOT_PRESET_KEY), "installed");
  assert.equal(storage.getItem("00duhot:funnel-workspace:v1"), null);
  assert.equal(storage.getItem("another-tool"), "unrelated data");
  first.funnels[0].nodes[0].title = "Título editado pelo usuário";
  first.funnels.push(createNewFunnel("Projeto criado depois da troca"));
  storage.setItem(FUNNEL_STORAGE_KEY, JSON.stringify(first.funnels));
  const second = loadFunnelWorkspace(storage);
  assert.equal(second.replaced, false);
  assert.equal(second.funnels[0].nodes[0].title, "Título editado pelo usuário");
  assert.equal(second.funnels[1].name, "Projeto criado depois da troca");
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
  assert.equal(normalizeFunnels({ broken: true })[0].name, "Fluxo Hot");
  assert.equal(migrateLegacyFunnels([{ id: "broken", steps: null }]), null);
});
