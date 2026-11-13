import assert from "node:assert/strict";
import { test } from "node:test";
import { csvCell, parseMetricsFile } from "../src/lib/instagram-intelligence-report.ts";
import { selectModelFrames } from "../src/lib/instagram-intelligence-local.ts";

const snapshot = {
  capturedAt: "2026-11-13T12:00:00Z",
  reels: [
    {
      url: "https://www.instagram.com/reel/valid_01/",
      publishedAt: "2026-11-12T12:00:00Z",
      views: 0,
      likes: null,
    },
  ],
};
test("the metrics adapter preserves null, absent and measured zero", () => {
  const [item] = parseMetricsFile(JSON.stringify([{ username: "perfil", snapshot }]));
  assert.equal(item.snapshot.reels[0].views, 0);
  assert.equal(item.snapshot.reels[0].likes, null);
  assert.equal(item.snapshot.reels[0].comments, undefined);
});
test("the metrics adapter rejects duplicate profiles, duplicate Reels and external media URLs", () => {
  assert.throws(
    () =>
      parseMetricsFile(
        JSON.stringify([
          { username: "perfil", snapshot },
          { username: "perfil", snapshot },
        ]),
      ),
    /repetido/,
  );
  const [reel] = snapshot.reels;
  const withReels = (reels) =>
    JSON.stringify([{ username: "perfil", snapshot: { ...snapshot, reels } }]);
  assert.throws(
    () => parseMetricsFile(withReels([reel, { ...reel, url: reel.url.replace("/reel/", "/p/") }])),
    /repetido/,
  );
  assert.throws(() =>
    parseMetricsFile(withReels([{ ...reel, url: "https://instagram.com.example/reel/valid_01/" }])),
  );
  assert.throws(
    () => parseMetricsFile(withReels([{ ...reel, publishedAt: "2026-11-14T00:00:00Z" }])),
    /Data inválida/,
  );
});
test("ranking protects cells from spreadsheet formulas and preserves legitimate numbers", () => {
  assert.equal(
    csvCell(' \t=HYPERLINK("https://example.com")'),
    '"\' \t=HYPERLINK(""https://example.com"")"',
  );
  assert.equal(csvCell(-10), '"-10"');
  assert.equal(csvCell(null), '""');
});
test("local visual analysis retains the timestamps of initial, middle and final frames", () => {
  const frames = [0, 0.5, 1, 2, 3, 5, 8, 10].map((time) => ({ time, src: "fixture" }));
  assert.deepEqual(
    selectModelFrames(frames).map((frame) => frame.time),
    [0, 3, 10],
  );
  assert.deepEqual(selectModelFrames(frames.slice(0, 2)), frames.slice(0, 2));
});
