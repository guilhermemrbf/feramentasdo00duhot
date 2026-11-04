import assert from "node:assert/strict";
import { test } from "node:test";
import { validatePostkitVideo } from "../src/lib/postkit-media.ts";

test("video preflight accepts MP4 and MOV headers, even with absent MIME", async () => {
  for (const [name, mime] of [
    ["clip.MP4", "video/mp4"],
    ["clip.mov", "video/quicktime"],
  ]) {
    const file = new File([new Uint8Array([0, 0, 0, 24]), "ftypisom0000"], name);
    assert.equal(await validatePostkitVideo(file), mime);
  }
});

test("video preflight rejects empty, disguised and unsupported files", async () => {
  await assert.rejects(validatePostkitVideo(new File([], "empty.mp4")), /conteúdo/);
  await assert.rejects(
    validatePostkitVideo(new File(["not a movie at all"], "fake.mp4")),
    /contêiner/,
  );
  await assert.rejects(validatePostkitVideo(new File(["not a movie"], "clip.webm")), /MP4 ou MOV/);
  await assert.rejects(validatePostkitVideo({ size: 501 * 1024 * 1024 }), /500 MB/);
});
