import test from "node:test";
import assert from "node:assert/strict";
import {
  storyLibraryPrefix,
  storyLibraryItem,
  validateStoryLibraryFile,
} from "../src/lib/story-library.ts";
const w = "00000000-0000-4000-8000-000000000001",
  a = "00000000-0000-4000-8000-000000000002",
  b = "00000000-0000-4000-8000-000000000003";
test("Story storage is scoped to workspace and account, separate from Reel assets", () => {
  assert.notEqual(storyLibraryPrefix(w, a), storyLibraryPrefix(w, b));
  assert.throws(() => storyLibraryPrefix(w, "../other"));
  const prefix = storyLibraryPrefix(w, a),
    name = a + "--video.mp4";
  assert.deepEqual(storyLibraryItem(prefix, name, { size: 100 }), {
    path: prefix + "/" + name,
    filename: "video.mp4",
    mime: "video/mp4",
    size: 100,
  });
  for (const [candidate, metadata] of [
    ["../video.mp4", { size: 100 }],
    [a + "--file.exe", { size: 100 }],
    [name, { size: 0 }],
    [name, { size: 52428801 }],
    [name, null],
  ])
    assert.equal(storyLibraryItem(prefix, candidate, metadata), null);
});
test("Story uploads verify media signatures and reject empty, disguised and oversized files", async () => {
  const file = (name, bytes) => Object.assign(new Blob([Uint8Array.from(bytes)]), { name });
  assert.equal(
    await validateStoryLibraryFile(file("image.png", [137, 80, 78, 71, 13, 10, 26, 10])),
    "image/png",
  );
  assert.equal(
    await validateStoryLibraryFile(
      file("video.mp4", [0, 0, 0, 16, 102, 116, 121, 112, 0, 0, 0, 0]),
    ),
    "video/mp4",
  );
  for (const item of [
    file("x.mp4", []),
    file("x.mp4", [137, 80, 78, 71, 13, 10, 26, 10]),
    file("x.jpg", [60, 115, 99, 114, 105, 112, 116, 62]),
    { name: "x.mp4", size: 52428801 },
  ])
    await assert.rejects(validateStoryLibraryFile(item));
});
