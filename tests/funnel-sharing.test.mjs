import test from "node:test";
import assert from "node:assert/strict";
import {
  createStarterFunnels,
  saveFunnelWorkspace,
  FUNNEL_STORAGE_KEY,
} from "../src/lib/funnel-model.ts";
import {
  createFunnelCode,
  parseFunnelCode,
  flowFilename,
  flowExportLayout,
  MAX_FLOW_CODE_BYTES,
} from "../src/lib/funnel-sharing.ts";

const example = () => createStarterFunnels()[0];
const envelope = (funnel) => JSON.stringify({ format: "00duhot-funnel", version: 1, funnel });
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFkcAAAAASUVORK5CYII=";

test("explicit save writes all projects, dimensions, positions and connections to the same workspace", () => {
  const funnels = [example(), { ...example(), id: "second", name: "Outro fluxo" }];
  funnels[0].nodes[0].x = -150;
  funnels[0].nodes[0].width = 320;
  let savedKey;
  let savedValue;
  saveFunnelWorkspace(
    {
      setItem(key, value) {
        savedKey = key;
        savedValue = value;
      },
    },
    funnels,
  );
  assert.equal(savedKey, FUNNEL_STORAGE_KEY);
  assert.deepEqual(JSON.parse(savedValue), funnels);
});

test("save failures are surfaced so the UI can report that changes were not persisted", () => {
  assert.throws(
    () =>
      saveFunnelWorkspace(
        {
          setItem() {
            throw new Error("quota");
          },
        },
        [example()],
      ),
    /quota/,
  );
});

test("portable code round-trips the full reference without changing any source data", async () => {
  const funnel = example();
  const before = structuredClone(funnel);
  const code = await createFunnelCode(funnel, async () => undefined);
  assert.deepEqual(parseFunnelCode(code), funnel);
  assert.deepEqual(funnel, before);
  assert.equal(parseFunnelCode(code).nodes.length, 88);
  assert.equal(parseFunnelCode(code).edges.length, 79);
});

test("uploaded images are embedded and browser-only media keys are removed", async () => {
  const funnel = example();
  funnel.nodes[0].imageKey = "local-image";
  const blob = new Blob([Buffer.from(png, "base64")], { type: "image/png" });
  const parsed = parseFunnelCode(
    await createFunnelCode(funnel, async (key) => (key === "local-image" ? blob : undefined)),
  );
  assert.equal(parsed.nodes[0].imageKey, undefined);
  assert.equal(parsed.nodes[0].imageUrl, `data:image/png;base64,${png}`);
  assert.equal(funnel.nodes[0].imageKey, "local-image");
});

test("missing uploaded media is reported instead of silently dropping it", async () => {
  const funnel = example();
  funnel.nodes[0].imageKey = "missing";
  await assert.rejects(
    createFunnelCode(funnel, async () => undefined),
    /imagem.*não está disponível/i,
  );
});

test("untrusted code cannot refer to existing media or inject unsupported fields", () => {
  const funnel = example();
  funnel.nodes[0].imageKey = "existing-user-file";
  funnel.nodes[0].onClick = "alert(1)";
  const parsed = parseFunnelCode(envelope(funnel));
  assert.equal(parsed.nodes[0].imageKey, undefined);
  assert.equal(parsed.nodes[0].onClick, undefined);
});

test("invalid JSON, versions, duplicate IDs, dangling connections and invalid geometry are rejected", () => {
  assert.throws(() => parseFunnelCode("not-json"), /JSON válido/);
  assert.throws(
    () =>
      parseFunnelCode(JSON.stringify({ format: "00duhot-funnel", version: 2, funnel: example() })),
    /versão/,
  );
  const duplicate = example();
  duplicate.nodes.push({ ...duplicate.nodes[0] });
  assert.throws(() => parseFunnelCode(envelope(duplicate)), /repetidos/);
  const dangling = example();
  dangling.edges[0].from = "missing";
  assert.throws(() => parseFunnelCode(envelope(dangling)), /não existe/);
  for (const invalid of [NaN, Infinity, -5, 0]) {
    const funnel = example();
    funnel.nodes[0].width = invalid;
    assert.throws(() => parseFunnelCode(envelope(funnel)), /inválido/);
  }
});

test("image URLs and colors are restricted to supported display values", () => {
  for (const url of [
    "javascript:alert(1)",
    "file:///private.png",
    "data:text/html;base64,PGgxPiE=",
  ]) {
    const funnel = example();
    funnel.nodes[0].imageUrl = url;
    assert.throws(() => parseFunnelCode(envelope(funnel)), /inválido/);
  }
  const funnel = example();
  funnel.nodes[0].background = "url(https://example.com/tracker)";
  assert.throws(() => parseFunnelCode(envelope(funnel)), /inválido/);
  funnel.nodes[0].background = "#aabbcc";
  funnel.nodes[0].imageUrl = "https://example.com/image.png";
  assert.equal(
    parseFunnelCode(envelope(funnel)).nodes[0].imageUrl,
    "https://example.com/image.png",
  );
});

test("oversized code is rejected before parsing and empty flows remain shareable as code", async () => {
  assert.throws(() => parseFunnelCode(" ".repeat(MAX_FLOW_CODE_BYTES + 1)), /24 MB/);
  const funnel = example();
  funnel.nodes = [];
  funnel.edges = [];
  assert.deepEqual(parseFunnelCode(await createFunnelCode(funnel, async () => undefined)), funnel);
  assert.throws(() => flowExportLayout([]), /pelo menos um elemento/);
});

test("export bounds include offscreen and negative-position blocks while keeping image memory bounded", () => {
  const funnel = example();
  funnel.nodes[0].x = -5000;
  funnel.nodes[0].y = -2000;
  const layout = flowExportLayout(funnel.nodes);
  assert.ok(layout.width > 0 && layout.height > 0);
  assert.ok(layout.width * layout.height * layout.pixelRatio ** 2 <= 24_000_001);
  for (const node of funnel.nodes) {
    assert.ok(node.x * layout.scale + layout.x >= 95);
    assert.ok(node.y * layout.scale + layout.y >= 205);
    assert.ok((node.x + node.width) * layout.scale + layout.x <= layout.width - 95);
    assert.ok((node.y + node.height) * layout.scale + layout.y <= layout.height - 95);
  }
});

test("download names remove paths, punctuation and accents", () => {
  assert.equal(flowFilename("Fluxo Hót / versão 01"), "Fluxo-Hot-versao-01");
  assert.equal(flowFilename("../../"), "fluxo");
  assert.ok(flowFilename("a".repeat(500)).length <= 100);
});
