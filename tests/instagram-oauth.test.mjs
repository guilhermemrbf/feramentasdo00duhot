import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createInstagramOAuthState,
  decryptInstagramToken,
  encryptInstagramToken,
  instagramOAuthCookieName,
  verifyInstagramOAuthState,
} from "../src/lib/instagram-oauth.server.ts";

const originalStateSecret = process.env.INSTAGRAM_OAUTH_STATE_SECRET;
const originalEncryptionKey = process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY;

process.env.INSTAGRAM_OAUTH_STATE_SECRET = "a-test-only-secret-with-sufficient-entropy";
process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

test("Instagram OAuth state is signed and carries the authorized workspace and user", async () => {
  const state = await createInstagramOAuthState({ workspaceId: "workspace-1", userId: "user-1" });
  assert.deepEqual(await verifyInstagramOAuthState(state), {
    workspaceId: "workspace-1",
    userId: "user-1",
  });
  await assert.rejects(verifyInstagramOAuthState(`${state}tampered`), /invalid oauth state/i);
});

test("Instagram tokens are encrypted with unique AES-GCM nonces", async () => {
  const first = await encryptInstagramToken("sensitive-token");
  const second = await encryptInstagramToken("sensitive-token");
  assert.match(first, /^v1\./);
  assert.notEqual(first, second);
  assert.ok(!first.includes("sensitive-token"));
  assert.equal(await decryptInstagramToken(first), "sensitive-token");
  // Alter a significant encoded byte, not a potentially unchanged final
  // character or unused Base64 padding bits.
  const position = first.lastIndexOf(".") + 1;
  const tampered =
    first.slice(0, position) + (first[position] === "A" ? "B" : "A") + first.slice(position + 1);
  await assert.rejects(decryptInstagramToken(tampered));
});

test("production OAuth cookie uses the host-only secure prefix", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  assert.equal(instagramOAuthCookieName(), "__Host-instagram-oauth");
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

process.on("exit", () => {
  if (originalStateSecret === undefined) delete process.env.INSTAGRAM_OAUTH_STATE_SECRET;
  else process.env.INSTAGRAM_OAUTH_STATE_SECRET = originalStateSecret;
  if (originalEncryptionKey === undefined) delete process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY;
  else process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY = originalEncryptionKey;
});
