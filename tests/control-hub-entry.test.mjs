import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findTool, searchTools, cleanPreferences } from "../src/lib/tool-catalog.ts";
import { downloads } from "../src/lib/downloads.ts";

test("Fazenda de Celulares is reachable through the shared catalog and iPhone search", () => {
  const tool = findTool("/fazenda-de-celulares");
  assert.equal(tool.id, "controlHub");
  assert.equal(tool.name, "Fazenda de Celulares");
  assert.equal(tool.category, "Ambientes");
  assert.deepEqual(
    searchTools("iPhone USB").map((item) => item.id),
    ["controlHub"],
  );
  assert.deepEqual(cleanPreferences({ favorites: ["controlHub"], recent: ["controlHub"] }), {
    favorites: ["controlHub"],
    recent: ["controlHub"],
  });
});

test("Fazenda de Celulares pins a single Windows installer", () => {
  assert.equal(downloads.fazendaDeCelulares.version, "0.6.0");
  assert.equal(
    downloads.fazendaDeCelulares.url,
    "https://github.com/guilhermemrbf/feramentasdo00duhot/releases/download/fazenda-de-celulares-v0.6.0/Fazenda-de-Celulares-0.6.0-Setup-Windows-x64.exe",
  );
});

test("web entry describes local execution without exposing a local API credential", () => {
  const page = readFileSync(new URL("../src/routes/fazenda-de-celulares.tsx", import.meta.url), "utf8");
  assert.ok(page.includes("downloads.fazendaDeCelulares"));
  assert.equal((page.match(/<a href=/g) ?? []).length, 1);
  const legacy = readFileSync(new URL("../src/routes/control-hub.tsx", import.meta.url), "utf8");
  assert.match(legacy, /redirect\(\{ to: "\/fazenda-de-celulares", statusCode: 308 \}\)/);
  assert.doesNotMatch(page, /127\.0\.0\.1|api-token|\/api\/events|Bearer/);
});
