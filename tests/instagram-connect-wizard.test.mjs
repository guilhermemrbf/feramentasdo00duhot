import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const wizard = readFileSync("src/components/postkit/InstagramConnectWizard.tsx", "utf8");
const route = readFileSync("src/routes/automacao-instagram.tsx", "utf8");

test("connection wizard guides through Meta roles, tester invite and the official login", () => {
  assert.match(
    wizard,
    /https:\/\/developers\.facebook\.com\/apps\/2201393490722211\/roles\/roles\/\?business_id=1498873732174939/,
  );
  assert.match(wizard, /https:\/\/www\.instagram\.com\/accounts\/manage_access\//);
  for (const label of [
    "Abrir configuração da Meta",
    "Abrir convites do Instagram",
    "Convite aceito · continuar conexão",
  ]) {
    assert.ok(wizard.includes(label), label);
  }
  assert.ok(!/OAuth|redirect_uri|access token|App ID|callback/i.test(wizard.replace(/\/\/.*$/gm, "")));
});

test("connect tab keeps the existing unified login button inside the wizard", () => {
  const block = route.slice(route.indexOf("<InstagramConnectWizard"), route.indexOf("</InstagramConnectWizard>"));
  assert.ok(block.includes('connectInstagram("instagram_unified_login")'));
  assert.ok(route.includes("resetInstagramConnectWizard(workspace.id)"));
  assert.ok(route.includes("App not active"));
});
