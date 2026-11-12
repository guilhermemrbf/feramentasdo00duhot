import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("o catálogo expõe a extensão como ferramenta única na rota correta", async () => {
  const { TOOL_CATALOG, findTool, searchTools } = await import("../src/lib/tool-catalog.ts");
  const matching = TOOL_CATALOG.filter((tool) => tool.id === "socialDownload");
  assert.equal(matching.length, 1);
  assert.equal(matching[0].path, "/baixar-midias");
  assert.equal(findTool("/baixar-midias")?.id, "socialDownload");
  assert.equal(searchTools("tiktok").some((tool) => tool.id === "socialDownload"), true);
});

test("download da extensão usa o ZIP público versionado", async () => {
  const { downloads } = await import("../src/lib/downloads.ts");
  assert.equal(downloads.socialMediaExtension.url, "/downloads/00-do-hot-media-downloader-v0.1.0.zip");
  const route = readFileSync(new URL("../src/routes/baixar-midias.tsx", import.meta.url), "utf8");
  assert.match(route, /extension\.url/);
  assert.match(route, /Carregar sem compactação/);
});
