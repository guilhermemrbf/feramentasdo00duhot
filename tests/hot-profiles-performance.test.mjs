import test from "node:test";
import assert from "node:assert/strict";
import { androidSettings, updateRuntimeConfig } from "../tools/hot-profiles/android-settings.mjs";
import { runtimeArguments } from "../tools/hot-profiles/android-runtime.mjs";
import { AnnexBFrames } from "../src/lib/h264.ts";

test("performance input rejects command injection, invalid resource limits and unknown options", () => {
  for (const field of [
    { ramMb: 0 },
    { ramMb: 9000 },
    { ramMb: NaN },
    { cpuCores: 0 },
    { cpuCores: 9 },
    { resolution: "540x960\nimage.sysdir.1=outside" },
    { graphics: "host -qemu" },
    { fps: 144 },
    { memoryMode: "fast" },
    { imageId: "../../private" },
  ])
    assert.throws(() => androidSettings(field));
  assert.equal("secret" in androidSettings({ secret: "must not persist" }), false);
  const settings = androidSettings({
    ramMb: 4096,
    cpuCores: 4,
    resolution: "360x640",
    memoryMode: "low",
    fps: 15,
  });
  const args = runtimeArguments("fixture", 5600, settings, { minRamMb: 1536 });
  assert.equal(args[args.indexOf("-cores") + 1], "4");
  assert.equal(args[args.indexOf("-memory") + 1], "4096");
  assert.ok(args.includes("-lowram"));
});
test("editing performance preserves image paths, disk sizes and unknown engine-owned config", () => {
  const before =
    "image.sysdir.1=C:/original/image/\ndisk.dataPartition.size=6442450944\nengine.unknown=preserve\nhw.ramSize = 1536\nhw.cpu.ncore=2\n";
  const after = updateRuntimeConfig(before, androidSettings({ ramMb: 2048, cpuCores: 4 }), {
    minRamMb: 4096,
  });
  assert.match(after, /hw.ramSize=4096/);
  assert.match(after, /hw.cpu.ncore=4/);
  assert.match(after, /disk.dataPartition.size=6442450944/);
  assert.match(after, /engine.unknown=preserve/);
  assert.match(after, /image.sysdir.1=C:\/original\/image\//);
});
const nal = (type, ...bytes) => Buffer.from([0, 0, 0, 1, type, ...bytes]);
test("H264 split start codes and multi-slice pictures preserve boundaries and SPS/PPS on IDR", () => {
  const output = [];
  const parser = new AnnexBFrames((frame) => output.push(frame));
  const stream = Buffer.concat([
    nal(0x67, 0x42, 0xc0, 0x1e),
    nal(0x68, 0xce, 0x38),
    nal(0x65, 0x80, 0x44),
    nal(0x65, 0x40, 0x55),
    nal(0x41, 0x80, 0x66),
    nal(0x41, 0x80, 0x77),
  ]);
  for (let at = 0; at < stream.length; at += 2) parser.push(stream.subarray(at, at + 2));
  parser.finish();
  assert.equal(output.length, 3);
  assert.equal(output[0].key, true);
  assert.equal(output[1].key, false);
  assert.equal(output[0].codec, "avc1.42c01e");
  assert.ok(Buffer.from(output[0].data).includes(Buffer.from([0x65, 0x40, 0x55])));
});
test("H264 streams without parameter sets are not decoded and oversized pending NALs are bounded", () => {
  let frames = 0;
  const parser = new AnnexBFrames(() => frames++);
  parser.push(nal(0x41, 0x80));
  parser.finish();
  assert.equal(frames, 0);
  assert.throws(() => parser.push(new Uint8Array(8 * 1024 * 1024 + 1)), /limite/);
});
