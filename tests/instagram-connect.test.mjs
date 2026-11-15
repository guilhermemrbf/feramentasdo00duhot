import test from "node:test";
import assert from "node:assert/strict";
import { openInstagramAuthorization } from "../src/lib/instagram-connect.ts";

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
