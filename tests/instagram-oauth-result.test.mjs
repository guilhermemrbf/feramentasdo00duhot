import test from "node:test";
import assert from "node:assert/strict";
import { instagramOAuthResult } from "../src/lib/instagram-oauth-result.ts";

test("OAuth result notifies the original tab through a nonce-bound script without an app session", async () => {
  const result = instagramOAuthResult("connected");
  const html = await result.text();
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("location"), null);
  assert.match(html, /conectada/);
  assert.match(html, /aba original/);
  assert.doesNotMatch(html, /Google/);
  const nonce = html.match(/<script nonce="([\da-f-]+)">/)[1];
  assert.match(result.headers.get("content-security-policy"), /default-src 'none'/);
  assert.ok(
    result.headers.get("content-security-policy").includes("script-src 'nonce-" + nonce + "'"),
  );
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.match(html, /BroadcastChannel/);
  assert.match(html, /type: 'oauth-result', id, success: true/);
  assert.match(html, /data\.id === id/);
  assert.match(html, /window.close\(\)/);
  assert.ok(!(await instagramOAuthResult("connected").text()).includes('nonce="' + nonce + '"'));
});

test("OAuth failure and missing insights explain recovery without reflecting provider inputs", async () => {
  const result = await instagramOAuthResult("connection_failed", "state_validation").text();
  assert.match(result, /expirou/);
  assert.match(result, /Conectar Instagram/);
  assert.match(result, /success: false/);
  const warning = await instagramOAuthResult("insights_not_granted").text();
  assert.match(warning, /conectada/);
  assert.match(warning, /m.tricas/);
  const malicious = await instagramOAuthResult(
    "</script><script>alert(1)",
    "<img onerror=evil()>",
  ).text();
  assert.doesNotMatch(malicious, /alert\(1\)|onerror|evil\(\)/);
  assert.equal((malicious.match(/<script /g) ?? []).length, 1);
  const scoped = await instagramOAuthResult("connected", undefined, {
    workspaceId: "00000000-0000-4000-8000-000000000001",
    instagramAccountIds: ["123", "</script><script>alert(1)</script>"],
  }).text();
  assert.match(scoped, /instagramAccountIds.*123/);
  assert.doesNotMatch(scoped, /alert\(1\)/);
});
