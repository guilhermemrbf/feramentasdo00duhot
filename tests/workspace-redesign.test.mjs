import test from "node:test";
import assert from "node:assert/strict";
import { TOOL_CATALOG, searchTools, findTool, cleanPreferences } from "../src/lib/tool-catalog.ts";
import { outputName, queueCandidates, validPublicUrl } from "../src/lib/media/files.ts";
import { selectMediaFiles, formatMediaLink } from "../src/lib/media/selection.ts";
import { manualSchedule } from "../src/lib/manual-schedule.ts";
test("catalog keeps every tool reachable, searchable and documented", () => {
  assert.equal(TOOL_CATALOG.length, 9);
  assert.equal(new Set(TOOL_CATALOG.map((t) => t.path)).size, 9);
  for (const tool of TOOL_CATALOG) {
    assert.equal(tool.steps.length, 3);
    assert.ok(tool.input && tool.output && tool.requirement);
    assert.ok(searchTools(tool.name).some((t) => t.id === tool.id));
  }
  assert.ok(searchTools("PREPARACAO").length >= 3);
  assert.equal(findTool("/automacao-instagram").id, "social");
  assert.equal(searchTools("video", "Preparação").length, 3);
});
test("preferences discard stale routes and untrusted values", () => {
  assert.deepEqual(
    cleanPreferences({
      favorites: ["telegram", "invalid", "telegram", null],
      recent: ["profiles", 5, "images"],
    }),
    { favorites: ["telegram"], recent: ["profiles", "images"] },
  );
  assert.deepEqual(cleanPreferences(null), { favorites: [], recent: [] });
});
test("file selection rejects empty, unsupported and duplicate inputs without dropping valid ones", () => {
  const file = { name: "foto.png", type: "image/png", size: 10, lastModified: 1 };
  const other = { ...file, name: "outra.png" };
  assert.deepEqual(
    selectMediaFiles(
      [
        file,
        file,
        other,
        { ...file, name: "vazia", size: 0 },
        { ...file, name: "exec", type: "application/octet-stream" },
      ],
      [],
      ["image/png"],
    ),
    { accepted: [file, other], rejected: 3 },
  );
  assert.equal(selectMediaFiles([file], [file], ["image/png"]).accepted.length, 0);
});
test("completed outputs are never processed again by retrying a queue", () => {
  assert.deepEqual(
    queueCandidates([
      { status: "done" },
      { status: "error" },
      { status: "waiting" },
      { status: "processing" },
    ]),
    [{ status: "error" }, { status: "waiting" }],
  );
});
test("download extension follows the actual encoded format, even when browser falls back from AVIF", () => {
  assert.equal(outputName("foto.avif", "limpo-", "image/png"), "limpo-foto.png");
  assert.equal(outputName("a/b:c.mp4", "preview-", "video/webm"), "preview-a-b-c.webm");
});
test("generated HTML and Markdown escape filenames instead of injecting markup", () => {
  const item = {
    url: "https://cdn.example/a(b).png",
    fileName: '" /><script>evil()</script>[x]',
    type: "image",
  };
  const html = formatMediaLink(item, "html");
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&quot;"));
  assert.ok(formatMediaLink(item, "markdown").includes("%28b%29"));
  assert.ok(formatMediaLink(item, "markdown").includes("\\[x\\]"));
});
test("profile reference URLs require HTTPS without credentials", () => {
  assert.equal(validPublicUrl("https://cdn.example/a.png"), true);
  for (const value of [
    "javascript:alert(1)",
    "http://example.com",
    "https://user:secret@example.com",
  ])
    assert.equal(validPublicUrl(value), false);
});
test("manual schedule sorts slots and respects day capacity", () => {
  const slots = manualSchedule(
    {
      startDate: "2030-02-01",
      times: "18:00, 09:00, 13:00",
      quantity: 4,
      dailyLimit: 2,
      intervalMinutes: 120,
    },
    0,
  );
  assert.deepEqual(
    slots.map((s) => s.time),
    ["09:00", "13:00", "09:00", "13:00"],
  );
  assert.notEqual(slots[1].date, slots[2].date);
});
test("manual schedule rejects malformed, duplicate, past and too-close times", () => {
  const base = {
    startDate: "2030-02-01",
    times: "09:00,13:00",
    quantity: 4,
    dailyLimit: 2,
    intervalMinutes: 120,
  };
  for (const patch of [
    { startDate: "2030-02-30" },
    { times: "09:00,bad" },
    { times: "09:00,09:00" },
    { times: "09:00,10:00" },
    { times: "00:15,23:30", intervalMinutes: 120 },
    { quantity: 0 },
  ])
    assert.throws(() => manualSchedule({ ...base, ...patch }, 0));
  assert.throws(() => manualSchedule(base, new Date("2031-01-01").getTime()));
});

import { profileReport } from "../src/lib/profile-report.ts";
test("profile reports never export provider credentials or session URLs", () => {
  const report = profileReport([
    {
      id: "1",
      name: "Projeto",
      kind: "browser",
      password: "SECRET",
      providerToken: "TOKEN",
      session_url: "https://private.example",
    },
  ]);
  assert.deepEqual(report, {
    version: 1,
    profiles: [{ id: "1", name: "Projeto", kind: "browser" }],
  });
  assert.ok(!JSON.stringify(report).includes("SECRET"));
});

test("media IDs remain valid in local HTTP previews without randomUUID", async () => {
  const { mediaItemId } = await import("../src/lib/media/files.ts");
  const saved = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
  Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
  try {
    const ids = Array.from({ length: 100 }, () => mediaItemId());
    assert.equal(new Set(ids).size, 100);
    for (const id of ids)
      assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  } finally {
    if (saved) Object.defineProperty(crypto, "randomUUID", saved);
    else delete crypto.randomUUID;
  }
});
