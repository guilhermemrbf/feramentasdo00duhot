import assert from "node:assert/strict";
import { test } from "node:test";
import { platformInstagramAppRevision } from "../src/lib/instagram-workspace-app.server.ts";
import {
  createInstagramOAuthState,
  decryptInstagramToken,
  encryptInstagramToken,
  INSTAGRAM_LOGIN_SCOPES,
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
    mode: "instagram_login",
  });
  await assert.rejects(verifyInstagramOAuthState(`${state}tampered`), /invalid oauth state/i);
});

test("Facebook OAuth state preserves the selected authentication mode", async () => {
  const state = await createInstagramOAuthState({
    workspaceId: "workspace-1",
    userId: "user-1",
    mode: "facebook_login",
  });
  assert.equal((await verifyInstagramOAuthState(state)).mode, "facebook_login");
});

test("expired OAuth state is rejected even with an intact signature", async (t) => {
  const originalNow = Date.now();
  t.mock.method(Date, "now", () => originalNow);
  const state = await createInstagramOAuthState({
    workspaceId: "workspace-1",
    userId: "user-1",
    mode: "instagram_unified_login",
  });
  t.mock.method(Date, "now", () => originalNow + 601000);
  await assert.rejects(verifyInstagramOAuthState(state), /expired/i);
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

test("workspace app credentials and authorization are bound to the selected operation", async () => {
  const origin = "instagram-workspace-app:workspace-1:1234:5678";
  const ciphertext = await encryptInstagramToken("app-secret-fixture", origin);
  assert.equal(await decryptInstagramToken(ciphertext, origin), "app-secret-fixture");
  await assert.rejects(
    decryptInstagramToken(ciphertext, origin.replace("workspace-1", "workspace-2")),
  );
  await assert.rejects(decryptInstagramToken(ciphertext));
  const state = await createInstagramOAuthState({
    workspaceId: "workspace-1",
    userId: "user-1",
    mode: "instagram_unified_login",
    appRevision: "revision-1",
  });
  assert.equal((await verifyInstagramOAuthState(state)).appRevision, "revision-1");
});


test("platform OAuth revision is bound to the current Meta app and login configuration", () => {
  assert.equal(
    platformInstagramAppRevision("2201393490722211", "2579077412515904"),
    "platform:2201393490722211:2579077412515904",
  );
});

test("Instagram Login requests only official Meta permission names", () => {
  assert.deepEqual([...INSTAGRAM_LOGIN_SCOPES], [
    "instagram_business_basic",
    "instagram_business_content_publish",
  ]);
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
