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
    "Abrir Instagram para entrar",
    "Já entrei no perfil certo · continuar",
    "Abrir configuração da Meta",
    "Abrir convites do Instagram",
    "Convite aceito · continuar conexão",
  ]) {
    assert.ok(wizard.includes(label), label);
  }
  assert.ok(
    !/OAuth|redirect_uri|access token|App ID|callback/i.test(wizard.replace(/\/\/.*$/gm, "")),
  );
});

test("new profiles confirm Instagram sign-in before Meta setup, invite and connection", () => {
  assert.match(wizard, /https:\/\/www\.instagram\.com\/accounts\/login\//);
  const first = wizard.indexOf("{step === 1 &&");
  const second = wizard.indexOf("{step === 2 &&");
  const third = wizard.indexOf("{step === 3 &&");
  const fourth = wizard.indexOf("{step === 4 &&");
  assert.ok(first >= 0 && first < second && second < third && third < fourth);
  assert.match(wizard.slice(first, second), /INSTAGRAM_SIGN_IN_URL[\s\S]*setStep\(2\)/);
  assert.match(wizard.slice(second, third), /META_APP_ROLES_URL[\s\S]*setStep\(3\)/);
  assert.match(wizard.slice(third, fourth), /INSTAGRAM_TESTER_INVITES_URL[\s\S]*setStep\(4\)/);
  assert.match(wizard.slice(fourth), /\{children\}/);
});

test("connect tab keeps the existing unified login and offers beta setup only for the platform app", () => {
  const block = route.slice(
    route.indexOf("<InstagramConnectWizard"),
    route.indexOf("</InstagramConnectWizard>"),
  );
  assert.ok(block.includes('connectInstagram("instagram_unified_login")'));
  assert.ok(block.includes('usePlatformApp={app.mode !== "own"}'));
  assert.ok(wizard.includes("if (!usePlatformApp) return"));
  assert.ok(route.includes("resetInstagramConnectWizard(workspace.id, 1)"));
  assert.match(route, /if \(added\) \{\s*resetInstagramConnectWizard\(workspace.id\)/);
});
