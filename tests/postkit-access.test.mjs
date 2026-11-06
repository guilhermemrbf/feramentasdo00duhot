import assert from "node:assert/strict";
import { test } from "node:test";
import { webcrypto } from "node:crypto";
import {
  createPostkitInvitation,
  ensurePostkitSession,
  hashPostkitInvitation,
} from "../src/lib/postkit-access.ts";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

test("device access restores an existing identity without creating another", async () => {
  let created = 0;
  const session = { user: { id: "device-1" } };
  const auth = {
    getSession: async () => ({ data: { session }, error: null }),
    signInAnonymously: async () => {
      created++;
      return { data: { session }, error: null };
    },
  };
  assert.equal(await ensurePostkitSession(auth), session);
  assert.equal(created, 0);
});

test("device access creates only one anonymous session during concurrent startup", async () => {
  let created = 0;
  const session = { user: { id: "device-1" } };
  const auth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    signInAnonymously: async () => {
      created++;
      return { data: { session }, error: null };
    },
  };
  const [first, second] = await Promise.all([
    ensurePostkitSession(auth),
    ensurePostkitSession(auth),
  ]);
  assert.equal(first, session);
  assert.equal(second, session);
  assert.equal(created, 1);
});

test("team invitations use 256-bit tokens and only their hashes are stored", async () => {
  const first = await createPostkitInvitation();
  const second = await createPostkitInvitation();
  assert.match(first.token, /^[a-f0-9]{64}$/);
  assert.notEqual(first.token, second.token);
  assert.equal(first.hash, await hashPostkitInvitation(first.token));
  assert.notEqual(first.hash, first.token);
  await assert.rejects(hashPostkitInvitation("bad"), /convite inválido/i);
});
