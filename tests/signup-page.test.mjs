import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { signupPage } from "../tools/hot-profiles/signup-page.mjs";

// Only the origin/path boundary is tested without a DOM; form behavior is tested in Chrome.
test("signup waits for initial blank-page navigation without touching any fields", () => {
  const result = runInNewContext(`(${signupPage.toString()})({})`, {
    location: { origin: "null", href: "about:blank" },
  });
  assert.equal(result.status, "waiting");
});
test("signup refuses non-Instagram origins before inspecting the DOM", () => {
  for (const origin of [
    "https://www.instagram.com.evil.example",
    "http://www.instagram.com",
    "https://example.com",
  ]) {
    const result = runInNewContext(`(${signupPage.toString()})({})`, {
      location: { origin, href: origin + "/accounts/emailsignup/" },
    });
    assert.equal(result.status, "manual");
  }
});
