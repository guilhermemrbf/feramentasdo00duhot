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
let accountBDisconnected = false;
let disconnections = 0;
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
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PATCH,OPTIONS");
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
        auth_mode: "instagram_unified_login",
        scopes: ["instagram_basic", "instagram_content_publish"],
      },
      {
        id: id(3),
        username: "conta_fixture_b",
        instagram_user_id: "133",
        connection_status: accountBDisconnected ? "revoked" : "connected",
        last_verified_at: "2026-11-15T00:00:00Z",
        account_type: "BUSINESS",
        auth_mode: "instagram_unified_login",
        scopes: accountBDisconnected ? [] : ["instagram_basic", "instagram_content_publish"],
      },
    ];
  if (name === "instagram_accounts" && url.searchParams.has("id")) {
    body = body.find((row) => row.id === url.searchParams.get("id").replace("eq.", "")) ?? null;
  }
  if (name === "instagram_tokens") body = null;
  if (name === "disconnect_instagram_account") {
    assert.equal(input.p_account_id, id(3));
    accountBDisconnected = true;
    disconnections++;
    body = { disconnected: true, cancelledPosts: 0, cancelledStories: 0 };
  }
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
  if (name === "get_instagram_analytics" || name === "get_instagram_top_posts") {
    const accounts = [2, ...(accountBDisconnected ? [] : [3])].map((key) => ({
      id: id(key),
      username: key === 2 ? "conta_fixture_a" : "conta_fixture_b",
      auth_mode: "instagram_unified_login",
      followers: key === 2 ? 120 : 80,
      following: 12,
      reel_views: key === 2 ? 800 : null,
      reels: 1,
      measured: key === 2 ? 1 : 0,
      issue: null,
      last_catalog_at: "2026-11-19T00:00:00Z",
      last_measured_at: key === 2 ? "2026-11-19T00:00:00Z" : null,
    }));
    const profiles = accounts.filter(
      (profile) => !input.p_account || profile.id === input.p_account,
    );
    const totals = profiles.map((profile) => ({
      position: 1,
      username: profile.username,
      account_id: profile.id,
      media_id: "media-" + profile.id,
      published_at: "2026-11-18T00:00:00Z",
      permalink: null,
      views: profile.reel_views,
      likes: profile.followers,
      comments: 4,
      interactions: profile.followers + 4,
    }));
    const measured = profiles.filter((profile) => profile.reel_views != null).length;
    if (name === "get_instagram_analytics") {
      body = {
        accounts,
        profiles,
        reels: totals,
        statuses: [],
        totals: [
          { kind: "reel", publications: profiles.length, measured, views: measured ? 800 : null },
        ],
      };
    } else {
      body = {
        accounts,
        ranking_basis: "engagement",
        ranking: totals,
        leader: null,
        totals: {
          reels: profiles.length,
          measured,
          views: measured ? 800 : null,
          likes: profiles.reduce((sum, profile) => sum + profile.followers, 0),
          comments: profiles.length * 4,
          likes_measured: profiles.length,
          comments_measured: profiles.length,
        },
      };
    }
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
  await page.getByText("Minha conta ainda é pessoal", { exact: true }).click();
  const professionalGuide = page.getByLabel("Preparar conta profissional", { exact: true });
  assert.equal(
    await professionalGuide
      .getByRole("link", { name: "Abrir configuração no Instagram", exact: true })
      .getAttribute("href"),
    "https://www.instagram.com/accounts/convert_to_professional_account/",
  );
  const continueProfessional = professionalGuide.getByRole("button", {
    name: "Continuar conexão do Instagram",
    exact: true,
  });
  assert.equal(await continueProfessional.isDisabled(), true);
  await professionalGuide
    .getByRole("checkbox", {
      name: "Concluí a configuração profissional no Instagram.",
      exact: true,
    })
    .check();
  assert.equal(await continueProfessional.isEnabled(), true);
  const professionalPopupEvent = page.waitForEvent("popup");
  await continueProfessional.click();
  const professionalPopup = await professionalPopupEvent;
  await professionalPopup.waitForURL("https://www.facebook.com/**");
  assert.equal(await continueProfessional.isDisabled(), true);
  await page.getByRole("button", { name: "Cancelar esta tentativa", exact: true }).click();
  await page.getByRole("button", { name: "Conectar Instagram", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Conectar Instagram", exact: true }).isEnabled(),
    true,
  );
  // Cross-origin opener isolation can prevent the parent from closing Meta's tab.
  // Cancellation must stop waiting; fixture cleanup closes any remaining tab.
  await professionalPopup.close();
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
  await page.getByRole("button", { name: "Próximo: legenda e capa", exact: true }).click();
  await page.getByRole("button", { name: "Próximo: dias e horários", exact: true }).click();
  await page.getByRole("button", { name: "Ordem aleatória", exact: true }).click();
  await page.getByRole("button", { name: "Próximo: revisar Reels", exact: true }).click();
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
  await page.getByRole("button", { name: "Próximo: acompanhar na fila", exact: true }).waitFor();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].p_stories, "skip");
  assert.equal(saved[0].p_posts.length, 20);
  assert.ok(
    saved[0].p_posts.every(
      (p) => p.instagram_account_id === id(2) && Number(p.media_asset_id.slice(-12)) < 300,
    ),
  );
  if (process.env.INSTAGRAM_BROWSER_SCREENSHOTS)
    await page.screenshot({
      path: resolve(process.env.INSTAGRAM_BROWSER_SCREENSHOTS, "automatic-post-desktop.png"),
      fullPage: true,
    });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
  if (process.env.INSTAGRAM_BROWSER_SCREENSHOTS)
    await page.screenshot({
      path: resolve(process.env.INSTAGRAM_BROWSER_SCREENSHOTS, "automatic-post-mobile.png"),
      fullPage: true,
    });
  const isolated = await browser.newContext();
  const resultPage = await isolated.newPage();
  await resultPage.goto(web + "/api/instagram/oauth/callback?error=access_denied");
  await resultPage.getByText(/autoriza.*cancelada/).waitFor();
  assert.equal(await resultPage.getByRole("button", { name: "Continuar com Google" }).count(), 0);
  await isolated.close();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Contas conectadas", exact: true }).click();
  assert.equal(
    await page
      .getByRole("main")
      .getByRole("button", { name: "Biblioteca de Reels", exact: true })
      .count(),
    0,
  );
  await page.getByRole("button", { name: "Abrir conta @conta_fixture_b", exact: true }).click();
  const optionsB = page.getByRole("region", { name: "Opções de @conta_fixture_b" });
  await optionsB.getByRole("button", { name: "Biblioteca de Reels", exact: true }).click();
  await page.getByRole("heading", { name: /Biblioteca.*conta_fixture_b/ }).waitFor();
  await page.getByRole("button", { name: "Contas conectadas", exact: true }).click();
  await page.getByRole("button", { name: "Abrir conta @conta_fixture_b", exact: true }).click();
  await page.getByRole("button", { name: "Ver resultados", exact: true }).click();
  await page.getByText("80 seguidores · 12 seguindo").waitFor();
  assert.equal(await page.getByText("120 seguidores · 12 seguindo").count(), 0);
  await page.getByRole("button", { name: "Melhores publicações", exact: true }).click();
  await page.getByRole("heading", { name: "Top 10 Reels por engajamento", exact: true }).waitFor();
  const ranking = page.getByRole("list", { name: "Ranking de Reels" });
  assert.match(await ranking.innerText(), /@conta_fixture_a/);
  assert.match(await ranking.innerText(), /@conta_fixture_b/);
  await page.getByRole("button", { name: "Contas conectadas", exact: true }).click();
  await page.getByRole("button", { name: "Abrir conta @conta_fixture_b", exact: true }).click();
  const detailsB = page.locator('details[aria-label="Conexão de @conta_fixture_b"]');
  await detailsB.locator("summary").click();
  await detailsB.getByRole("button", { name: "Verificar acesso", exact: true }).click();
  await detailsB
    .getByRole("status")
    .filter({ hasText: /Não foi possível verificar/ })
    .waitFor();
  assert.equal(accountBDisconnected, false); // A missing token fixture is never called verified.
  await detailsB.getByRole("button", { name: "Desconectar desta operação", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Manter conectada", exact: true })
    .click();
  assert.equal(disconnections, 0);
  await detailsB.getByRole("button", { name: "Desconectar desta operação", exact: true }).click();
  const disconnectedResponse = page.waitForResponse(
    (response) => response.url().includes("/_serverFn/") && response.request().method() === "POST",
  );
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirmar desconexão", exact: true })
    .click();
  await disconnectedResponse;
  await page.getByRole("alertdialog").waitFor({ state: "detached" });
  await detailsB
    .getByRole("button", { name: "Desconectar desta operação", exact: true })
    .waitFor({ state: "detached" });
  assert.equal(disconnections, 1);
  await page.reload();
  await page.getByRole("button", { name: "Contas conectadas", exact: true }).click();
  await page.getByRole("button", { name: "Abrir conta @conta_fixture_b", exact: true }).click();
  await detailsB.locator("summary").click();
  await page.getByText("Conecte esta conta novamente", { exact: true }).waitFor();
  assert.equal(
    await detailsB.getByRole("button", { name: "Desconectar desta operação", exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "Contas conectadas", exact: true }).click();
  assert.equal(await page.getByRole("region", { name: "Passo a passo por conta" }).count(), 0);
  await page.getByRole("button", { name: "Abrir conta @conta_fixture_a", exact: true }).click();
  await page.getByRole("button", { name: "Configurar Stories", exact: true }).click();
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
  console.error(output.slice(-6500));
  process.exitCode = 1;
} finally {
  releaseInitialAccounts();
  await browser?.close();
  vite.kill();
  api.closeAllConnections();
  await new Promise((r) => api.close(r));
}
