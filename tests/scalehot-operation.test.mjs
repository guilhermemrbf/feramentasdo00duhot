import test from "node:test";
import assert from "node:assert/strict";
import { previousScaleHotRange, scaleHotDateRange } from "../src/lib/scalehot-period.ts";

test("periods follow the São Paulo calendar and include the selected day", () => {
  const now = new Date("2026-12-01T01:30:00Z");
  assert.deepEqual(scaleHotDateRange("today", now), { since: "2026-11-30", until: "2026-11-30" });
  assert.deepEqual(scaleHotDateRange("yesterday", now), {
    since: "2026-11-29",
    until: "2026-11-29",
  });
  assert.deepEqual(scaleHotDateRange("7d", now), { since: "2026-11-24", until: "2026-11-30" });
  assert.deepEqual(scaleHotDateRange("2m", now), { since: "2026-10-01", until: "2026-11-30" });
});

test("the previous range has the same duration and does not overlap the report", () => {
  assert.deepEqual(previousScaleHotRange({ since: "2026-03-01", until: "2026-03-07" }), {
    since: "2026-02-22",
    until: "2026-02-28",
  });
});
