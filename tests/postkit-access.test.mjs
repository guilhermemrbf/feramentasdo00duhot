import assert from "node:assert/strict";
import { test } from "node:test";
import { webcrypto } from "node:crypto";
import {
  createPostkitInvitation,
  getPostkitSession,
  hashPostkitInvitation,
} from "../src/lib/postkit-access.ts";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

test("Google login session is restored without creating an anonymous account", async () => {
  const session = { user: { id: "google-user-1" } };
  const auth = {
    getSession: async () => ({ data: { session }, error: null }),
  };
  assert.equal(await getPostkitSession(auth), session);
});

test("a missing session stays signed out; no anonymous session is created", async () => {
  let calls = 0;
  const auth = {
    getSession: async () => {
      calls += 1;
      return { data: { session: null }, error: null };
    },
  };
  assert.equal(await getPostkitSession(auth), null);
  assert.equal(calls, 1);
});

test("concurrent session checks share one read", async () => {
  let calls = 0;
  const session = { user: { id: "google-user-1" } };
  const auth = {
    getSession: async () => {
      calls += 1;
      return { data: { session }, error: null };
    },
  };
  const [first, second] = await Promise.all([getPostkitSession(auth), getPostkitSession(auth)]);
  assert.equal(first, session);
  assert.equal(second, session);
  assert.equal(calls, 1);
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
