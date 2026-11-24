import assert from "node:assert/strict";
import test from "node:test";
import {
  adsAuthorizationUrl,
  exchangeMetaAdsGrant,
  listMetaAdAccounts,
  MetaAdsProviderError,
  readMetaAdSpend,
  sealMetaAdsToken,
  openMetaAdsToken,
} from "../src/lib/tracking/meta-ads.ts";

const config = {
  appId: "123",
  secret: "test-only-secret",
  version: "v27.0",
  redirect: "https://loja.example/api/vendas/ads/meta/callback",
};

test("starts a separate session requesting read-only Marketing API access", () => {
  const result = adsAuthorizationUrl(config, "nonce");
  assert.equal(result.origin, "https://www.facebook.com");
  assert.equal(result.searchParams.get("scope"), "ads_read");
  assert.equal(result.searchParams.get("redirect_uri"), config.redirect);
  assert.equal(result.searchParams.get("state"), "nonce");
});

test("exchanges the code and verifies that the token belongs to the app and has ads_read", async () => {
  const calls = [];
  const provider = async (url, init) => {
    calls.push([url, new Headers(init?.headers)]);
    assert.equal(url.origin, "https://graph.facebook.com");
    if (url.searchParams.has("code")) return Response.json({ access_token: "short" });
    if (url.searchParams.has("fb_exchange_token")) return Response.json({ access_token: "long" });
    return Response.json({
      data: { app_id: "123", is_valid: true, expires_at: 2000000000, scopes: ["ads_read"] },
    });
  };
  assert.deepEqual(await exchangeMetaAdsGrant(config, "code", provider, 1000), {
    token: "long",
    expiresAt: "2033-05-18T03:33:20.000Z",
  });
  assert.equal(calls[1][0].searchParams.get("fb_exchange_token"), "short");
  assert.equal(calls[2][1].get("authorization"), "Bearer 123|test-only-secret");
  await assert.rejects(
    exchangeMetaAdsGrant(
      config,
      "code",
      async (url) =>
        url.pathname.endsWith("debug_token")
          ? Response.json({
              data: { app_id: "123", is_valid: true, scopes: [], expires_at: 2000000000 },
            })
          : Response.json({ access_token: "token" }),
      1000,
    ),
    { message: "permission" },
  );
});

test("paginates accounts by cursor without following an untrusted next URL", async () => {
  const provider = async (url, init) => {
    assert.equal(url.origin, "https://graph.facebook.com");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer token");
    assert.equal(url.searchParams.has("access_token"), false);
    const account = (n) => ({
      id: "act_" + n,
      name: "Conta " + n,
      currency: "BRL",
      timezone_name: "America/Sao_Paulo",
      account_status: 1,
    });
    return Response.json(
      url.searchParams.has("after")
        ? { data: [account(2)] }
        : {
            data: [account(1)],
            paging: { next: "https://another.example/", cursors: { after: "cursor" } },
          },
    );
  };
  assert.deepEqual(
    (await listMetaAdAccounts(config, "token", provider)).map((item) => item.id),
    ["act_1", "act_2"],
  );
});

test("retains only operation and numeric Meta error metadata for OAuth diagnosis", async () => {
  await assert.rejects(
    exchangeMetaAdsGrant(config, "private-grant", async () =>
      Response.json(
        { error: { code: 100, error_subcode: 36008, message: "private provider details" } },
        { status: 400 },
      ),
    ),
    (error) => {
      assert.ok(error instanceof MetaAdsProviderError);
      assert.equal(error.message, "unavailable");
      assert.equal(error.operation, "exchange_code");
      assert.equal(error.httpStatus, 400);
      assert.equal(error.providerCode, 100);
      assert.equal(error.providerSubcode, 36008);
      assert.doesNotMatch(JSON.stringify(error), /private|test-only-secret/);
      return true;
    },
  );
});

test("uses the earliest valid Meta expiry even when the absolute token expiry is absent", async () => {
  const now = 1000;
  const grant = (data, lifetime) =>
    exchangeMetaAdsGrant(
      config,
      "code",
      async (url) =>
        url.pathname.endsWith("debug_token")
          ? Response.json({ data: { ...data, app_id: "123", is_valid: true, scopes: ["ads_read"] } })
          : Response.json({ access_token: "token", expires_in: lifetime }),
      now,
    );
  assert.equal((await grant({ expires_at: 0, data_access_expires_at: 100 }, 200)).expiresAt,
    new Date(100_000).toISOString());
  assert.equal((await grant({}, 200)).expiresAt, new Date(201_000).toISOString());
  assert.equal((await grant({})).expiresAt, new Date(now + 3_600_000).toISOString());
  await assert.rejects(grant({ data_access_expires_at: 1 }, 200), { message: "expired" });
});

test("converts spend and distinguishes missing insights from an error", async () => {
  const period = { since: "2026-11-17", until: "2026-11-23" };
  const provider = async (url) => {
    assert.equal(url.pathname, "/v27.0/act_1/insights");
    assert.deepEqual(JSON.parse(url.searchParams.get("time_range")), period);
    return Response.json({ data: [{ spend: "12.30", impressions: "500", clicks: "40" }] });
  };
  assert.deepEqual(await readMetaAdSpend(config, "token", "act_1", period, provider), {
    spend: 12.3,
    impressions: 500,
    clicks: 40,
  });
  assert.equal(
    await readMetaAdSpend(config, "token", "act_1", period, async () =>
      Response.json({ data: [] }),
    ),
    null,
  );
  await assert.rejects(
    readMetaAdSpend(config, "token", "act_1", period, async () =>
      Response.json({ error: { code: 190, message: "never show" } }, { status: 400 }),
    ),
    { message: "expired" },
  );
  await assert.rejects(
    readMetaAdSpend(config, "token", "act_1", period, async () =>
      Response.json({ data: [{ spend: "bad", impressions: "0", clicks: "0" }] }),
    ),
    { message: "unavailable" },
  );
});

test("seals credentials so they cannot be transferred between owners", () => {
  const key = Buffer.alloc(32, 4);
  const value = sealMetaAdsToken("raw-token", key, "owner-1:123");
  assert.notEqual(value, "raw-token");
  assert.equal(openMetaAdsToken(value, key, "owner-1:123"), "raw-token");
  assert.throws(() => openMetaAdsToken(value, key, "owner-2:123"));
});
