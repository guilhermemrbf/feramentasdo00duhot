import assert from "node:assert/strict";
import test from "node:test";
import { accessForRoute, secondsRemaining, inviteFromHash } from "../src/lib/platform-access.ts";

test("only approved users and live trial sessions open protected routes", () => {
  assert.equal(accessForRoute("/automacao-instagram", "pending"), false);
  assert.equal(accessForRoute("/limpar-metadados", "expired"), false);
  assert.equal(accessForRoute("/painel", "trial"), true);
  assert.equal(accessForRoute("/ferramentas", "trial"), true);
  assert.equal(accessForRoute("/ferramentas", "pending"), false);
  assert.equal(accessForRoute("/limpar-metadados", "trial"), true);
  assert.equal(accessForRoute("/automacao-instagram", "trial"), false);
  assert.equal(accessForRoute("/criar-pagina", "trial"), false);
  assert.equal(accessForRoute("/aprovacoes", "approved"), false);
  assert.equal(accessForRoute("/aprovacoes", "admin"), true);
  assert.equal(accessForRoute("/automacao-instagram", "approved"), true);
});

test("trial timing and invitation parsing reject invalid values", () => {
  assert.equal(secondsRemaining("2026-11-21T10:15:00Z", Date.parse("2026-11-21T10:00:00Z")), 900);
  assert.equal(secondsRemaining("2026-11-21T10:15:00Z", Date.parse("2026-11-21T10:15:00Z")), 0);
  assert.equal(secondsRemaining("invalid", Date.now()), 0);
  assert.equal(inviteFromHash("#" + "a".repeat(64)), "a".repeat(64));
  assert.equal(inviteFromHash("#access_token=do-not-import"), null);
});
