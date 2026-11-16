import test from "node:test";
import assert from "node:assert/strict";
import {
  findUpdatedInstagramAccount,
  openInstagramAuthorization,
} from "../src/lib/instagram-connect.ts";

test("Instagram window is opened synchronously before authorization, without the local connector", async () => {
  const calls = [];
  const popup = {
    opener: {},
    closed: false,
    location: { href: "about:blank" },
    close() {
      calls.push("close");
    },
  };
  const action = openInstagramAuthorization(
    () => {
      calls.push("open");
      return popup;
    },
    async () => {
      calls.push("authorize");
      await Promise.resolve();
      return { authorizationUrl: "https://www.facebook.com/dialog/oauth?state=test" };
    },
  );
  assert.deepEqual(calls, ["open", "authorize"]);
  assert.equal(popup.opener, null);
  await action;
  assert.match(popup.location.href, /facebook.com/);
});
test("connection results require a new or refreshed connected record from the backend", () => {
  const before = [
    {
      id: "old",
      connection_status: "connected",
      last_verified_at: "2026-11-15T00:00:00Z",
      instagram_user_id: "123",
    },
  ];
  assert.equal(findUpdatedInstagramAccount(before, before), undefined);
  assert.equal(
    findUpdatedInstagramAccount([{ ...before[0], connection_status: "error" }], before),
    undefined,
  );
  assert.equal(
    findUpdatedInstagramAccount([{ id: "new", connection_status: "pending" }], before),
    undefined,
  );
  const added = {
    id: "new",
    connection_status: "connected",
    last_verified_at: "2026-11-16T00:00:00Z",
  };
  assert.equal(findUpdatedInstagramAccount([...before, added], before), added);
  const refreshed = { ...before[0], last_verified_at: "2026-11-16T00:00:00Z" };
  assert.equal(findUpdatedInstagramAccount([refreshed], before), undefined);
  assert.equal(findUpdatedInstagramAccount([refreshed], before, ["123"]), refreshed);
  assert.equal(findUpdatedInstagramAccount([refreshed], before, ["999"]), undefined);
  assert.equal(
    findUpdatedInstagramAccount([{ ...before[0], last_verified_at: null }], before),
    undefined,
  );
  assert.equal(
    findUpdatedInstagramAccount(before, [{ ...before[0], connection_status: "expired" }]),
    before[0],
  );
  assert.equal(before[0].last_verified_at, "2026-11-15T00:00:00Z");
});

test("blocked popups, denied server access and untrusted redirects fail visibly and clean up", async () => {
  let called = false;
  await assert.rejects(
    openInstagramAuthorization(
      () => null,
      async () => {
        called = true;
      },
    ),
    /pop-ups/,
  );
  assert.equal(called, false);
  for (const authorize of [
    async () => {
      throw new Error("Workspace access denied.");
    },
    async () => ({ authorizationUrl: "https://evil.test/login" }),
  ]) {
    let closed = false;
    const popup = {
      opener: {},
      closed: false,
      location: { href: "about:blank" },
      close() {
        closed = true;
      },
    };
    await assert.rejects(openInstagramAuthorization(() => popup, authorize));
    assert.equal(closed, true);
    assert.equal(popup.location.href, "about:blank");
  }
});
