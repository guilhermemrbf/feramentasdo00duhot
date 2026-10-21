import test from "node:test";
import assert from "node:assert/strict";
import { resizeFlowNodes } from "../src/lib/funnel-sizing.ts";
import { createStarterFunnels } from "../src/lib/funnel-model.ts";

const fixtures = () => {
  const source = createStarterFunnels()[0].nodes[0];
  return [
    { ...source, id: "a", width: 200, height: 100, x: 50, y: 60 },
    { ...source, id: "b", width: 400, height: 200, x: 350, y: 260 },
    { ...source, id: "c", width: 200, height: 100, x: 900, y: 600 },
  ];
};

test("batch scaling changes only selected nodes and preserves input, content and proportions", () => {
  const nodes = fixtures();
  const copy = structuredClone(nodes);
  const result = resizeFlowNodes(nodes, ["a", "b"], { scale: 1.5, spacing: false });
  assert.deepEqual(
    result.map(({ width, height, x, y }) => ({ width, height, x, y })),
    [
      { width: 300, height: 150, x: 50, y: 60 },
      { width: 600, height: 300, x: 350, y: 260 },
      { width: 200, height: 100, x: 900, y: 600 },
    ],
  );
  assert.deepEqual(nodes, copy);
  assert.equal(result[2], nodes[2]);
  assert.equal(result[0].title, nodes[0].title);
});

test("group scaling can preserve spacing around its top-left anchor", () => {
  const result = resizeFlowNodes(fixtures(), ["a", "b"], { scale: 2, spacing: true });
  assert.equal(result[0].x, 50);
  assert.equal(result[0].y, 60);
  assert.equal(result[1].x, 650);
  assert.equal(result[1].y, 460);
});

test("a shared factor respects minimum and maximum dimensions for the whole selection", () => {
  const large = resizeFlowNodes(fixtures(), ["a", "b"], { scale: 100, spacing: false });
  assert.deepEqual(
    large.slice(0, 2).map(({ width, height }) => [width, height]),
    [
      [800, 400],
      [1600, 800],
    ],
  );
  const small = resizeFlowNodes(fixtures(), ["a", "b"], { scale: 0.001, spacing: false });
  assert.deepEqual(
    small.slice(0, 2).map(({ width, height }) => [width, height]),
    [
      [64, 32],
      [128, 64],
    ],
  );
});

test("exact width or height applies to selection while blank dimensions and positions stay unchanged", () => {
  const nodes = fixtures();
  const widthOnly = resizeFlowNodes(nodes, ["a", "b"], { width: 320 });
  assert.equal(widthOnly[0].width, 320);
  assert.equal(widthOnly[1].width, 320);
  assert.equal(widthOnly[0].height, 100);
  assert.equal(widthOnly[1].height, 200);
  assert.equal(widthOnly[1].x, 350);
  const exact = resizeFlowNodes(nodes, ["a", "b"], { width: 10000, height: 2 });
  assert.equal(exact[0].width, 1600);
  assert.equal(exact[1].height, 32);
});

test("invalid sizes, empty selections and missing nodes cannot corrupt the graph", () => {
  const nodes = fixtures();
  for (const scale of [NaN, Infinity, 0, -1]) {
    assert.equal(resizeFlowNodes(nodes, ["a"], { scale, spacing: true }), nodes);
  }
  assert.deepEqual(resizeFlowNodes(nodes, ["a"], { width: NaN, height: -1 }), nodes);
  assert.equal(resizeFlowNodes(nodes, [], { width: 320 }), nodes);
  assert.equal(resizeFlowNodes(nodes, ["missing"], { width: 320 }), nodes);
});
