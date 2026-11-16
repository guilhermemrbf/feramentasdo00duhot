import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { instagramOAuthResult } from "../src/lib/instagram-oauth-result.ts";
const require = createRequire(
  resolve(process.env.INTELLIGENCE_PG_TEST_DEPS || ".", "package.json"),
);
const { chromium } = require("playwright-core");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const user = {
  id: id(99),
  email: "fixture@example.test",
  role: "authenticated",
  is_anonymous: false,
  app_metadata: { provider: "google" },
  user_metadata: {},
};
const now = Math.floor(Date.now() / 1000),
  enc = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
const token =
  enc({ alg: "HS256" }) +
  "." +
  enc({ sub: user.id, role: "authenticated", iat: now, exp: now + 3600 }) +
  ".fixture";
const web = "http://127.0.0.1:4384",
  apiUrl = "http://127.0.0.1:4385";
const saved = [];
const calls = [];
let stories = 0;
let workerActive = false;
let accountVerifiedAt = "2026-11-15T00:00:00Z";
let firstAccountRead = true;
let releaseInitialAccounts;
const initialAccountsGate = new Promise((resolve) => {
  releaseInitialAccounts = resolve;
});
const library = new Map();
const copies = [];
const storyRows = [];
const api = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", web);
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization,apikey,content-type,x-client-info,accept-profile,content-profile,prefer,range",
  );
  res.setHeader("Access-Control-Expose-Headers", "Content-Range");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  const url = new URL(req.url, apiUrl),
    name = url.pathname.split("/").at(-1);
  calls.push(name);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  let input = {};
  try {
    input = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
  } catch {}
  let body = [];
  if (url.pathname.includes("/storage/v1/object/list/"))
    body = [...library.entries()]
      .filter(([key]) => key.startsWith(input.prefix + "/"))
      .slice(input.offset || 0, (input.offset || 0) + (input.limit || 100))
      .map(([key, value]) => ({
        name: key.slice(input.prefix.length + 1),
        id: key,
        metadata: { size: value.length, mimetype: "image/png" },
      }));
  else if (url.pathname === "/storage/v1/object/copy") {
    copies.push(input);
    body = { Key: input.destinationKey };
  } else if (url.pathname.includes("/storage/v1/object/sign/"))
    body = { signedURL: "/object/sign/postkit-media/fixture.png?token=fixture" };
  else if (url.pathname.startsWith("/storage/v1/object/postkit-media/") && req.method === "POST") {
    const key = decodeURIComponent(url.pathname.slice("/storage/v1/object/postkit-media/".length));
    library.set(key, Buffer.concat(chunks));
    body = { Key: key };
  }

  if (name === "user") body = user;
  if (name === "ensure_postkit_workspace")
    body = [{ id: id(1), name: "Operação de teste", timezone: "America/Sao_Paulo", role: "owner" }];
  if (name === "has_workspace_role") body = true;
  if (name === "instagram_worker_is_active") body = workerActive;
  if (name === "enable_instagram_worker") {
    workerActive = true;
    body = true;
  }
  if (name === "instagram_accounts" && firstAccountRead) {
    firstAccountRead = false;
    await initialAccountsGate;
  }
  if (name === "instagram_accounts")
    body = [
      {
        id: id(2),
        username: "conta_fixture_a",
        instagram_user_id: "122",
        connection_status: "connected",
        last_verified_at: accountVerifiedAt,
        account_type: "BUSINESS",
      },
      {
        id: id(3),
        username: "conta_fixture_b",
        instagram_user_id: "133",
        connection_status: "connected",
        last_verified_at: "2026-11-15T00:00:00Z",
        account_type: "BUSINESS",
      },
    ];
  if (name === "media_assets")
    body = [2, 3].flatMap((a) =>
      Array.from({ length: 20 }, (_, i) => ({
        id: id(a * 100 + i),
        original_filename: `conta-${a}-video-${i + 1}.mp4`,
        size_bytes: 1000,
        mime_type: "video/mp4",
        storage_path: "fixture",
        status: "uploaded",
        reel_account_id: id(a),
        import_position: i,
        import_folder: "Teste",
        import_batch_id: id(a * 10),
      })),
    );
  if (name === "instagram_story_reminders") {
    if (req.method === "POST") {
      storyRows.push(...input);
      body = input;
    } else body = storyRows;
    res.setHeader("Content-Range", `0-0/${storyRows.length}`);
  }
  if (name === "schedule_reviewed_instagram_reels") {
    saved.push(input);
    body = input.p_posts.length;
  }
  if (name === "get_instagram_dashboard") body = {};
  res.end(JSON.stringify(body));
});
await new Promise((r) => api.listen(4385, "127.0.0.1", r));
const env = {
  ...process.env,
  VITE_SUPABASE_URL: apiUrl,
  VITE_SUPABASE_PUBLISHABLE_KEY: "fixture-anon",
  SUPABASE_URL: apiUrl,
  SUPABASE_PUBLISHABLE_KEY: "fixture-anon",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
  APP_BASE_URL: web,
  META_APP_ID: "fixture-id",
  META_APP_SECRET: "fixture-secret",
  META_GRAPH_API_VERSION: "v24.0",
  META_INSTAGRAM_LOGIN_CONFIG_ID: "123456",
  INSTAGRAM_OAUTH_STATE_SECRET: "fixture-only-state-secret-at-least-32-characters",
};
const vite = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4384", "--strictPort"],
  { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
);
let output = "";
vite.stdout.on("data", (x) => (output += x));
vite.stderr.on("data", (x) => (output += x));
let browser;
try {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(web, { signal: AbortSignal.timeout(3000) })).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    ({ token, user, now }) =>
      localStorage.setItem(
        "sb-127-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "fixture",
          token_type: "bearer",
          expires_at: now + 3600,
          user,
        }),
      ),
    { token, user, now },
  );
  await page.goto(web + "/automacao-instagram?tab=nova-conta");
  await page.getByRole("region", { name: "Passo a passo por conta" }).waitFor({ timeout: 60000 });
  assert.equal(
    await page.getByRole("button", { name: "Carregando suas contas…", exact: true }).isDisabled(),
    true,
  );
  releaseInitialAccounts();
  await page.getByRole("button", { name: "Conectar Instagram", exact: true }).waitFor();
  await page.getByText("Opções de navegador", { exact: true }).click();
  await page.getByRole("checkbox", { name: /Usar uma sess/ }).check();
  await page.getByRole("button", { name: "Conectar Instagram", exact: true }).first().click();
  await page.getByRole("region", { name: "Conectar navegador local" }).waitFor();
  await page.getByRole("button", { name: "Cancelar", exact: true }).first().click();
  await page.getByRole("checkbox", { name: /Usar uma sess/ }).uncheck();
  await page.context().route("https://www.facebook.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<title>Meta authorization fixture</title>",
    }),
  );
  const popupEvent = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Conectar Instagram", exact: true }).first().click();
  const popup = await popupEvent;
  // Local fixture stops external navigation; this proves the real button reaches OAuth.
  await page
    .getByRole("status")
    .filter({ hasText: /Autoriza.*aberta/ })
    .waitFor();
  assert.equal(await page.getByRole("region", { name: "Conectar navegador local" }).count(), 0);
  await popup.waitForURL("https://www.facebook.com/**");
  assert.equal(await popup.evaluate(() => window.opener === null), true);
  // A callback notification alone cannot manufacture a connected account.
  const rechecked = page.waitForResponse((response) =>
    response.url().includes("/rest/v1/instagram_accounts"),
  );
  await page.evaluate(() => {
    const channel = new BroadcastChannel("mausehot-instagram-connection");
    channel.postMessage({ type: "oauth-result", id: crypto.randomUUID(), success: true });
    channel.close();
  });
  await rechecked;
  await page.getByRole("button", { name: "Cancelar esta tentativa", exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("status")
      .filter({ hasText: /@conta_fixture_a conectada/ })
      .count(),
    0,
  );
  accountVerifiedAt = "2026-11-16T00:00:00Z";
  await page
    .context()
    .route(web + "/api/instagram/oauth/callback?fixture=success", async (route) => {
      const result = instagramOAuthResult("connected", undefined, {
        workspaceId: id(1),
        instagramAccountIds: ["122"],
      });
      await route.fulfill({
        status: result.status,
        headers: Object.fromEntries(result.headers),
        body: await result.text(),
      });
    });
  const closed = popup.waitForEvent("close");
  await popup.goto(web + "/api/instagram/oauth/callback?fixture=success").catch((error) => {
    if (!/closed/i.test(error.message)) throw error;
  });
  await closed;
  await page
    .getByRole("status")
    .filter({ hasText: /@conta_fixture_a conectada/ })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Cancelar esta tentativa", exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "Próximo: configurar Reels", exact: true }).click();
  await page.getByRole("button", { name: "Ordem aleatória", exact: true }).click();
  await page.getByRole("button", { name: /Ver pr.* dos Reels/ }).click();
  const activate = page.getByRole("button", { name: "Ativar esta programação", exact: true });
  await activate.waitFor();
  assert.equal(await activate.isDisabled(), true);
  await page.getByRole("button", { name: "Ativar publicação automática", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: /Processamento autom.*ativado/ })
    .waitFor();
  assert.equal(workerActive, true);
  assert.equal(await page.getByLabel("Vou preparar Stories", { exact: false }).count(), 0);
  await page.getByLabel("Conferi a conta, os vídeos", { exact: false }).check();
  await page.waitForTimeout(1500);
  if (await activate.isDisabled())
    throw new Error(
      "Activation disabled: " + (await page.locator("main").innerText()).slice(-5000),
    );
  await activate.click();
  await page.getByRole("button", { name: "Agendamento salvo", exact: true }).waitFor();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].p_stories, "skip");
  assert.equal(saved[0].p_posts.length, 20);
  assert.ok(
    saved[0].p_posts.every(
      (p) => p.instagram_account_id === id(2) && Number(p.media_asset_id.slice(-12)) < 300,
    ),
  );
  await page.screenshot({ path: ".superpowers/automatic-post-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
  await page.screenshot({ path: ".superpowers/automatic-post-mobile.png", fullPage: true });
  const isolated = await browser.newContext();
  const resultPage = await isolated.newPage();
  await resultPage.goto(web + "/api/instagram/oauth/callback?error=access_denied");
  await resultPage.getByText(/autoriza.*cancelada/).waitFor();
  assert.equal(await resultPage.getByRole("button", { name: "Continuar com Google" }).count(), 0);
  await isolated.close();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Contas conectadas", exact: true }).click();
  assert.equal(await page.getByRole("region", { name: "Passo a passo por conta" }).count(), 0);
  await page.getByRole("button", { name: "Configurar Stories", exact: true }).first().click();
  await page.getByRole("region", { name: "Biblioteca exclusiva de Stories" }).waitFor();
  assert.equal(await page.getByRole("region", { name: "Passo a passo por conta" }).count(), 0);
  const upload = page.getByLabel("Enviar para a biblioteca de Stories", { exact: true });
  await upload.setInputFiles({
    name: "story-fixture.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page
    .getByRole("status")
    .filter({ hasText: /1 arquivos salvos/ })
    .waitFor();
  assert.equal(library.size, 1);
  assert.ok([...library.keys()][0].startsWith(`${id(1)}/stories/${id(2)}/`));
  await page.goto(web + "/automacao-instagram?tab=stories");
  await page.getByRole("button", { name: "Selecionar até 45", exact: true }).click();
  await page.getByRole("button", { name: "Preparar 1 Stories selecionados", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: /Mídia carregada/ })
    .waitFor();
  assert.equal(
    await page.getByRole("combobox", { name: "Em qual conta você vai publicar?" }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Amanhã", exact: true }).click();
  await page.getByRole("button", { name: "Ver a agenda antes de salvar", exact: true }).click();
  await page.getByRole("button", { name: "Ativar 1 lembretes de Stories", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: /Lembretes salvos/ })
    .waitFor();
  assert.equal(copies.length, 1);
  assert.equal(storyRows.length, 1);
  assert.equal(storyRows[0].instagram_account_id, id(2));
  assert.equal(library.size, 1);
  assert.equal(saved.length, 1); // No additional Reel scheduling from Stories.
  await page
    .getByRole("button", { name: "Conectar outra conta para Stories", exact: true })
    .click();
  assert.equal(await page.getByRole("region", { name: "Passo a passo por conta" }).count(), 0);
  await page.getByRole("button", { name: "Próximo: biblioteca de Stories", exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: native OAuth popup and optional connector, new-account steps, existing-account flow, persistent Stories library upload/reload/copy and reminder activation, independent connection, random 20 Reels at 10/day, confirmed RPC, responsive layout; fixtures only",
  );
} catch (e) {
  console.error(e.stack || e.message);
  console.error("API calls:", [...new Set(calls)].join(","));
  console.error(output.slice(-1500));
  process.exitCode = 1;
} finally {
  releaseInitialAccounts();
  await browser?.close();
  vite.kill();
  api.closeAllConnections();
  await new Promise((r) => api.close(r));
}
