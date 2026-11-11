import assert from "node:assert/strict";
import { test } from "node:test";
import {
  instagramUnifiedAuthorizationUrl,
  readInstagramUnifiedGrant,
} from "../src/lib/instagram-unified-login.server.ts";
import { getMetaGraphBaseUrl } from "../src/lib/social-publishing.server.ts";

const config = {
  appId: "2201393490722211",
  appSecret: "test-only",
  callbackUrl: "https://example.com/api/instagram/oauth/callback",
  facebookGraphBaseUrl: "https://graph.facebook.com/v25.0",
};
const scopes = ["instagram_basic", "instagram_content_publish"];

test("Instagram connects using the configured Unified Login dialog", (t) => {
  const previous = process.env.META_INSTAGRAM_LOGIN_CONFIG_ID;
  delete process.env.META_INSTAGRAM_LOGIN_CONFIG_ID;
  t.after(() => {
    if (previous !== undefined) process.env.META_INSTAGRAM_LOGIN_CONFIG_ID = previous;
  });

  const url = new URL(instagramUnifiedAuthorizationUrl("signed-state", config));
  assert.equal(url.origin + url.pathname, "https://www.facebook.com/dialog/oauth");
  assert.equal(url.searchParams.get("client_id"), config.appId);
  assert.match(url.searchParams.get("config_id"), /^\d+$/);
  assert.equal(url.searchParams.get("redirect_uri"), config.callbackUrl);
  assert.equal(url.searchParams.get("state"), "signed-state");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.has("scope"), false);
  assert.equal(url.searchParams.has("client_secret"), false);
  assert.throws(
    () => instagramUnifiedAuthorizationUrl("signed-state", { ...config, appId: "999" }),
    /not configured/,
  );
});

test("Unified Login imports the assigned Instagram profiles across pages", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url.origin, "https://graph.facebook.com");
    if (url.pathname.endsWith("/oauth/access_token")) {
      assert.equal(url.searchParams.get("code"), "test-code");
      assert.equal(url.searchParams.get("redirect_uri"), config.callbackUrl);
      return Response.json({ access_token: "test-grant" });
    }
    if (url.pathname.endsWith("/debug_token")) {
      return Response.json({
        data: { app_id: config.appId, is_valid: true, expires_at: 0, scopes },
      });
    }
    assert.match(url.pathname, /\/me\/assigned_instagram_accounts$/);
    assert.equal(options.headers.Authorization, "Bearer test-grant");
    if (url.searchParams.get("after") === "cursor-1") {
      return Response.json({ data: [{ id: "222", username: "second" }] });
    }
    return Response.json({
      data: [{ id: "111", username: "first" }],
      paging: { next: "https://example.com/not-followed", cursors: { after: "cursor-1" } },
    });
  });

  const grant = await readInstagramUnifiedGrant("test-code", config);
  assert.deepEqual(
    grant.accounts.map((account) => account.username),
    ["first", "second"],
  );
  assert.equal(grant.expiry, null);
  const version = process.env.META_GRAPH_API_VERSION;
  process.env.META_GRAPH_API_VERSION = "v25.0";
  t.after(() => {
    if (version === undefined) delete process.env.META_GRAPH_API_VERSION;
    else process.env.META_GRAPH_API_VERSION = version;
  });
  assert.equal(getMetaGraphBaseUrl("instagram_unified_login"), config.facebookGraphBaseUrl);
});

test("Unified Login rejects consent without the publishing permission", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url.pathname.endsWith("/oauth/access_token"))
      return Response.json({ access_token: "test-grant" });
    assert.match(url.pathname, /\/debug_token$/);
    return Response.json({
      data: { app_id: config.appId, is_valid: true, expires_at: 0, scopes: [scopes[0]] },
    });
  });
  await assert.rejects(
    readInstagramUnifiedGrant("test-code", config),
    /permissions were not granted/,
  );
});
