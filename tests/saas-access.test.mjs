import assert from "node:assert/strict";
import test from "node:test";
import { accessForRoute, secondsRemaining, inviteFromHash } from "../src/lib/platform-access.ts";

test("signed-in users can explore the workspace while execution remains server-gated", () => {
  assert.equal(accessForRoute("/automacao-instagram", "pending"), true);
  assert.equal(accessForRoute("/limpar-metadados", "expired"), true);
  assert.equal(accessForRoute("/painel", "trial"), true);
  assert.equal(accessForRoute("/ferramentas", "trial"), true);
  assert.equal(accessForRoute("/ferramentas", "pending"), true);
  assert.equal(accessForRoute("/limpar-metadados", "trial"), true);
  assert.equal(accessForRoute("/automacao-instagram", "trial"), true);
  assert.equal(accessForRoute("/criar-pagina", "trial"), true);
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
