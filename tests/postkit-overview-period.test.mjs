import assert from "node:assert/strict";
import test from "node:test";
import { postkitOverviewPeriod } from "../src/lib/postkit-overview-period.ts";

test("the dashboard Instagram filter follows local calendar boundaries", () => {
  const now = new Date("2026-11-01T01:00:00Z");
  const zone = "America/Sao_Paulo";
  for (const [period, start, end] of [
    ["today", "2026-10-31T03:00:00.000Z", "2026-11-01T03:00:00.000Z"],
    ["yesterday", "2026-10-30T03:00:00.000Z", "2026-10-31T03:00:00.000Z"],
    ["7d", "2026-10-25T03:00:00.000Z", "2026-11-01T03:00:00.000Z"],
    ["30d", "2026-10-02T03:00:00.000Z", "2026-11-01T03:00:00.000Z"],
    ["month", "2026-10-01T03:00:00.000Z", "2026-11-01T03:00:00.000Z"],
    ["2m", "2026-09-01T03:00:00.000Z", "2026-11-01T03:00:00.000Z"],
    ["all", null, null],
  ]) {
    assert.deepEqual(postkitOverviewPeriod(zone, period, now), { start, end });
  }
});
