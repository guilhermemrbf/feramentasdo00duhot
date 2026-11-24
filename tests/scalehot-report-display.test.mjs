import assert from "node:assert/strict";
import test from "node:test";
import { metricChange, scaleHotComparisonSeries } from "../src/lib/scalehot-report-display.ts";

test("ScaleHot distinguishes an absent baseline from a real zero", () => {
  assert.equal(metricChange(0, 0), 0);
  assert.equal(metricChange(4, 0), null);
  assert.equal(metricChange(0, undefined), null);
  assert.equal(metricChange(undefined, 0), null);
  assert.equal(metricChange(-5, -10), 0.5);
});

test("chart data distinguishes unavailable observations from zero and preserves negative values", () => {
  assert.deepEqual(
    scaleHotComparisonSeries(["profit", "ctr"], { profit: -50, ctr: 0 }, { profit: 100 }),
    [
      { period: "Anterior", profit: 100, ctr: null },
      { period: "Selecionado", profit: -50, ctr: 0 },
    ],
  );
});
