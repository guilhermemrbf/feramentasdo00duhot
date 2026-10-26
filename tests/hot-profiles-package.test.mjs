import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

test("distributed connector contains exact source bytes and all its local imports, without user data", async () => {
  const zip = await readFile(new URL("../public/hot-profiles-connector.zip", import.meta.url));
  const expected = [
    "bridge.mjs",
    "storage.mjs",
    "policy.mjs",
    "frame-cache.mjs",
    "proxy.mjs",
    "browser.mjs",
    "android.mjs",
    "android-runtime.mjs",
    "android-discovery.mjs",
    "verify-android.mjs",
    "Iniciar Hot Profiles.cmd",
    "LEIA-ME.md",
  ];
  const entries = new Map();
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(zip.readUInt16LE(offset + 8), 8);
    const compressedSize = zip.readUInt32LE(offset + 18);
    const size = zip.readUInt32LE(offset + 22);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const name = zip.subarray(offset + 30, offset + 30 + nameLength).toString();
    const start = offset + 30 + nameLength + extraLength;
    const content = inflateRawSync(zip.subarray(start, start + compressedSize));
    assert.equal(content.length, size);
    assert.equal(entries.has(name), false, "duplicate entry");
    entries.set(name, content);
    offset = start + compressedSize;
  }
  assert.deepEqual(
    [...entries.keys()].sort(),
    expected.map((name) => `Hot Profiles/${name}`).sort(),
  );
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  assert.equal(zip.readUInt16LE(zip.length - 12), expected.length);
  for (const name of expected) {
    const packaged = entries.get(`Hot Profiles/${name}`);
    assert.deepEqual(
      packaged,
      await readFile(new URL(`../tools/hot-profiles/${name}`, import.meta.url)),
      name,
    );
    for (const [, dependency] of packaged.toString().matchAll(/from\s+["']\.\/([^"']+)["']/g))
      assert.ok(entries.has(`Hot Profiles/${dependency}`), `${name}: missing ${dependency}`);
  }
});
