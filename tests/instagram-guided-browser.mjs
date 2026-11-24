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
let workerDestinationEnabled = false;
let accountVerifiedAt = "2026-11-15T00:00:00Z";
let accountBDisconnected = false;
let accountBExpired = false;
let disconnections = 0;
let firstAccountRead = true;
let freshWorkspace = false;
let appRow = null;
let freshAccount = null;
let remindersUnavailable = false;
let googleCodeExchanged = false;
let platformStatus = "approved";
let platformExpiry = null;
let createdInvite = false;
let leadDecision = "pending";
let emailLinkSent = false;
let newLeadSignedUp = false;
const fixtureInvite = "e".repeat(64);
const customerApp = "12345678901";
const customerConfig = "12345678902";
const customerSecret = "3".repeat(32);
const customerToken = "customer-access-token";
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
    "authorization,apikey,content-type,x-client-info,x-supabase-api-version,accept-profile,content-profile,prefer,range",
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

  if (name === "platform_access_status") {
    body = {
      status: platformStatus,
      trial_expires_at: platformExpiry,
      server_now: new Date().toISOString(),
    };
  }
  if (name === "platform_is_approved" || name === "platform_approved_user") {
    body = ["approved", "admin"].includes(platformStatus);
  }
  if (name === "sales_overview") {
    body = {
      approved: 0,
      gross_cents: 0,
      reported_net_cents: null,
      reversed_cents: 0,
      reversed: 0,
      refund_or_dispute_count: 0,
      with_net: 0,
      devices: 0,
      series: [],
      monthly: [],
      goal_cents: null,
      month_gross_cents: 0,
      recent: [],
      links: [],
    };
  }
  if (name === "get_postkit_dashboard_performance") {
    body = {
      published: 0,
      active: 0,
      connected: 0,
      views: null,
      measured: 0,
      reels: 0,
      accountNames: {},
      ranking: [],
    };
  }
  if (name === "platform_admin_leads") {
    body = [
      {
        id: id(123),
        name: "Lead Fixture",
        email: "lead@example.test",
        decision: leadDecision,
        created_at: new Date().toISOString(),
        verified_at: new Date().toISOString(),
      },
    ];
  }
  if (name === "platform_admin_decide") {
    assert.equal(input.p_user, id(123));
    assert.equal(input.p_decision, "approved");
    leadDecision = input.p_decision;
    body = null;
  }
  if (name === "platform_admin_invites") body = [];
  if (name === "platform_admin_create_invite") {
    assert.equal(input.p_email, "invite@example.test");
    createdInvite = true;
    body = fixtureInvite;
  }
  if (name === "platform_start_trial") {
    assert.equal(input.p_token, fixtureInvite);
    platformStatus = "trial";
    platformExpiry = new Date(Date.now() + 8000).toISOString();
    body = {
      status: platformStatus,
      trial_expires_at: platformExpiry,
      server_now: new Date().toISOString(),
    };
  }
  if (name === "signup") {
    assert.equal(input.email, "new-lead@example.test");
    assert.equal(input.data.full_name, "Lead de Teste");
    newLeadSignedUp = true;
    body = { ...user, email: input.email };
  }
  if (name === "otp") {
    assert.equal(input.email, "new-lead@example.test");
    emailLinkSent = true;
    body = {};
  }
  if (name === "user") body = user;
  if (name === "token" && url.searchParams.get("grant_type") === "password") {
    assert.equal(input.email, "fixture@example.test");
    assert.equal(input.password, "fixture-password-only");
    body = {
      access_token: token,
      refresh_token: "fixture",
      token_type: "bearer",
      expires_in: 3600,
      user,
    };
  }
  if (name === "token" && url.searchParams.get("grant_type") === "pkce") {
    assert.equal(input.auth_code, "google-fixture-code");
    assert.match(input.code_verifier, /^[a-zA-Z0-9._~-]{43,128}$/);
    googleCodeExchanged = true;
    body = {
      access_token: token,
      refresh_token: "fixture",
      token_type: "bearer",
      expires_in: 3600,
      user,
    };
  }
  if (name === "ensure_postkit_workspace")
    body = [
      {
        id: id(freshWorkspace ? 5 : 1),
        name: "Operação de teste",
        timezone: "America/Sao_Paulo",
        owner_id: user.id,
      },
    ];
  if (name === "has_workspace_role") body = true;
  if (name === "workspaces") body = [{ owner_id: user.id }];
  if (name === "workspace_members") body = [];
  if (name === "instagram_workspace_apps") {
    assert.equal(req.headers.apikey, "fixture-service");
    const config = freshWorkspace
      ? appRow
      : { revision: id(41), app_id: null, login_config_id: null };
    if (config && url.searchParams.get("select") !== "app_id,login_config_id,secret_ciphertext") {
      const { secret_ciphertext: _secret, ...publicConfig } = config;
      body = [publicConfig];
    } else body = config ? [config] : [];
  }
  if (name === "save_instagram_workspace_app") {
    assert.equal(req.headers.apikey, "fixture-service");
    assert.equal(input.p_workspace_id, id(5));
    assert.equal(input.p_user_id, user.id);
    assert.equal(input.p_app_id, customerApp);
    assert.match(input.p_secret_ciphertext, /^v1\./);
    assert.ok(!input.p_secret_ciphertext.includes(customerSecret));
    appRow = {
      revision: id(42),
      app_id: input.p_app_id,
      login_config_id: input.p_login_config_id,
      secret_ciphertext: input.p_secret_ciphertext,
    };
    body = true;
  }
  if (name === "save_workspace_instagram_grant") {
    assert.equal(req.headers.apikey, "fixture-service");
    assert.equal(input.p_workspace_id, id(5));
    assert.equal(input.p_revision, appRow.revision);
    assert.equal(input.p_accounts[0].id, "299");
    assert.equal(input.p_accounts[0].login_config_id, customerConfig);
    assert.match(input.p_token_ciphertext, /^v1\./);
    freshAccount = {
      id: id(6),
      username: input.p_accounts[0].username,
      instagram_user_id: "299",
      last_verified_at: new Date().toISOString(),
      connection_status: "connected",
      scopes: input.p_scopes,
    };
    body = true;
  }
  if (name === "instagram_worker_is_active") body = workerActive;
  if (name === "enable_instagram_worker") {
    workerActive = workerDestinationEnabled;
    body = workerActive;
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
        connection_status: accountBDisconnected
          ? "revoked"
          : accountBExpired
            ? "expired"
            : "connected",
        last_verified_at: "2026-11-15T00:00:00Z",
        account_type: "BUSINESS",
        auth_mode: "instagram_unified_login",
        scopes: accountBDisconnected ? [] : ["instagram_basic", "instagram_content_publish"],
      },
    ];
  if (name === "instagram_accounts" && url.searchParams.has("id")) {
    body = body.find((row) => row.id === url.searchParams.get("id").replace("eq.", "")) ?? null;
  }
  if (freshWorkspace && name === "instagram_accounts") body = freshAccount ? [freshAccount] : [];
  if (name === "instagram_accounts" && req.method === "HEAD") {
    assert.equal(url.searchParams.get("connection_status"), "eq.connected");
    const count = body.filter((row) => row.connection_status === "connected").length;
    res.setHeader("Content-Range", `*/${count}`);
  }
  if (name === "instagram_tokens") body = null;
  if (name === "disconnect_instagram_account") {
    assert.equal(input.p_account_id, id(3));
    accountBDisconnected = true;
    disconnections++;
    body = { disconnected: true, cancelledPosts: 0, cancelledStories: 0 };
  }
  if (name === "media_assets")
    body = (freshWorkspace ? [] : [2, 3]).flatMap((a) =>
      Array.from({ length: 20 }, (_, i) => ({
        id: id(a * 100 + i),
        original_filename: `conta-${a}-video-${i + 1}.mp4`,
        size_bytes: 1000,
        mime_type: "video/mp4",
        storage_path: "fixture",
        status: "uploaded",
        reel_account_id: id(a),
        import_position: i,
        import_folder: a === 3 && i === 19 ? null : "Teste",
        import_batch_id: a === 3 && i === 19 ? null : id(a * 10),
      })),
    );
  if (name === "media_assets" && req.method === "HEAD") {
    assert.equal(url.searchParams.get("archived_at"), "is.null");
    res.setHeader("Content-Range", `*/${freshWorkspace ? 0 : 40}`);
  }
  if (name === "instagram_story_reminders") {
    if (req.method === "POST") {
      storyRows.push(...input.map((row) => ({ ...row, state: "pending" })));
      body = input;
    } else {
      if (remindersUnavailable)
        return res.writeHead(503).end(JSON.stringify({ message: "Fixture unavailable" }));
      body = freshWorkspace ? [] : storyRows;
      if (url.searchParams.has("state"))
        body = body.filter((row) => `eq.${row.state}` === url.searchParams.get("state"));
      res.setHeader("Content-Range", `*/${body.length}`);
    }
  }
  if (name === "schedule_reviewed_instagram_reels") {
    saved.push(input);
    body = input.p_posts.length;
  }
  if (name === "posts" && url.searchParams.get("select")?.includes("media_assets!")) {
    if (!freshWorkspace && saved.length) {
      body = [
        {
          id: id(700),
          scheduled_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          status: "scheduled",
          content_type: "reel",
          instagram_accounts: { username: "conta_fixture_a" },
          media_assets: { original_filename: "reel-que-esta-na-fila.mp4" },
        },
      ];
      res.setHeader("Content-Range", "0-0/1");
    } else {
      res.setHeader("Content-Range", "*/0");
    }
  }
  if (name === "posts" && req.method === "HEAD") {
    const count = freshWorkspace
      ? 0
      : url.searchParams.get("status") === "eq.published"
        ? url.searchParams.has("content_type")
          ? 2
          : 3
        : 1;
    res.setHeader("Content-Range", `*/${count}`);
  }
  if (name === "get_instagram_analytics" || name === "get_instagram_top_posts") {
    const accounts = (freshWorkspace ? [] : [2, ...(accountBDisconnected ? [] : [3])]).map(
      (key) => ({
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
      }),
    );
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
        totals: profiles.length
          ? [
              {
                kind: "reel",
                publications: profiles.length,
                measured,
                views: measured ? 800 : null,
              },
            ]
          : [],
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
  GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL: "",
  GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY: "",
  APP_BASE_URL: web,
  META_APP_ID: "fixture-id",
  META_APP_SECRET: "fixture-secret",
  META_GRAPH_API_VERSION: "v24.0",
  META_INSTAGRAM_LOGIN_CONFIG_ID: "123456",
  INSTAGRAM_OAUTH_STATE_SECRET: "fixture-only-state-secret-at-least-32-characters",
  INSTAGRAM_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
};
const metaFixture = `
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (target, init) => {
    const url = new URL(target instanceof Request ? target.url : target);
    if (url.hostname !== "graph.facebook.com") return originalFetch(target, init);
    const auth = new Headers(init?.headers).get("Authorization");
    if (url.pathname.endsWith("/${customerApp}"))
      return Promise.resolve(auth === "Bearer ${customerApp}|${customerSecret}" ?
        Response.json({ id: "${customerApp}" }) : Response.json({}, { status: 401 }));
    if (url.pathname.endsWith("/oauth/access_token") &&
      url.searchParams.get("client_id") === "${customerApp}" &&
      url.searchParams.get("client_secret") === "${customerSecret}" &&
      url.searchParams.get("code") === "authorized-fixture")
      return Promise.resolve(Response.json({ access_token: "${customerToken}" }));
    if (url.pathname.endsWith("/debug_token") &&
      auth === "Bearer ${customerApp}|${customerSecret}" &&
      url.searchParams.get("input_token") === "${customerToken}")
      return Promise.resolve(Response.json({ data: { app_id: "${customerApp}", is_valid: true, expires_at: 0, scopes: ["instagram_basic", "instagram_content_publish"] } }));
    if (url.pathname.endsWith("/me") && auth === "Bearer ${customerToken}")
      return Promise.resolve(Response.json({ client_business_id: "101" }));
    if (url.pathname.endsWith("/me/assigned_instagram_accounts") && auth === "Bearer ${customerToken}")
      return Promise.resolve(Response.json({ data: [{ id: "299", username: "cliente_fixture" }] }));
    return Promise.resolve(Response.json({}, { status: 403 }));
  };
`;
const vite = spawn(
  process.execPath,
  [
    "--import=data:text/javascript;base64," + Buffer.from(metaFixture).toString("base64"),
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "4384",
    "--strictPort",
  ],
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
  const platformOAuth = new URL(popup.url());
  assert.equal(platformOAuth.searchParams.get("client_id"), env.META_APP_ID);
  assert.equal(platformOAuth.searchParams.get("config_id"), env.META_INSTAGRAM_LOGIN_CONFIG_ID);
  assert.equal(await popup.evaluate(() => window.opener === null), true);
  const workspaceReadsBeforeRefresh = calls.filter(
    (name) => name === "ensure_postkit_workspace",
  ).length;
  await page.evaluate(async () => {
    const authChannel = new BroadcastChannel("sb-127-auth-token");
    authChannel.postMessage({
      event: "TOKEN_REFRESHED",
      session: JSON.parse(localStorage.getItem("sb-127-auth-token")),
    });
    authChannel.close();
    await new Promise((resolve) => setTimeout(resolve, 150));
  });
  assert.equal(
    calls.filter((name) => name === "ensure_postkit_workspace").length,
    workspaceReadsBeforeRefresh,
    "Renovar a sessão da mesma pessoa não deve reabrir a operação",
  );
  await page.getByRole("button", { name: "Cancelar esta tentativa", exact: true }).waitFor();
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
  const activate = page.getByRole("button", { name: "Salvar agendamento", exact: true });
  await activate.waitFor();
  assert.equal(await activate.isDisabled(), true);
  await page.getByRole("button", { name: "Ativar publicação automática", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: /destino de publicação no Supabase/ })
    .waitFor();
  assert.equal(workerActive, false);
  assert.equal(await page.getByLabel("Vou preparar Stories", { exact: false }).count(), 0);
  await page.getByLabel("Conferi a conta, os vídeos", { exact: false }).check();
  await page.waitForTimeout(1500);
  if (await activate.isDisabled())
    throw new Error(
      "Activation disabled: " + (await page.locator("main").innerText()).slice(-5000),
    );
  await activate.click();
  await page
    .getByRole("status")
    .filter({ hasText: /Agendamento salvo.*desativada/ })
    .waitFor();
  await page.getByRole("button", { name: "Próximo: acompanhar na fila", exact: true }).waitFor();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].p_stories, "skip");
  assert.equal(saved[0].p_posts.length, 20);
  workerDestinationEnabled = true;
  await page.getByRole("button", { name: "Ativar publicação automática", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: /Processamento autom.*ativado/ })
    .waitFor();
  assert.equal(workerActive, true);
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
  await page.getByRole("button", { name: "Abrir menu de ferramentas", exact: true }).click();
  const mobileNav = page.getByRole("dialog", { name: "Menu de ferramentas", exact: true });
  await mobileNav
    .getByRole("navigation", { name: "Seções da automação Instagram" })
    .getByRole("button", { name: "Visão geral", exact: true })
    .click();
  await mobileNav.waitFor({ state: "hidden" });
  const isolated = await browser.newContext();
  const resultPage = await isolated.newPage();
  await resultPage.goto(web + "/api/instagram/oauth/callback?error=access_denied");
  await resultPage.getByText(/autoriza.*cancelada/).waitFor();
  assert.equal(await resultPage.getByRole("button", { name: "Continuar com Google" }).count(), 0);
  await isolated.close();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  const navigation = page.getByRole("navigation", { name: "Seções da automação Instagram" });
  await page.getByText("App Meta da plataforma vinculado à operação", { exact: true }).waitFor();
  await navigation.getByRole("button", { name: "Agendar Reels", exact: true }).waitFor();
  await navigation.getByRole("button", { name: "Stories", exact: true }).waitFor();
  await navigation.getByRole("button", { name: "Biblioteca de Reels", exact: true }).waitFor();
  assert.equal(
    await navigation
      .getByRole("button", { name: /Nova publicação|Lote de vídeos|Notificações/ })
      .count(),
    0,
  );
  await page.getByText("Reel · reel-que-esta-na-fila.mp4", { exact: true }).waitFor();
  const views = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Visualizações de Reels", exact: true }) });
  assert.match(await views.innerText(), /800/);
  const summary = page.getByRole("region", { name: "Resumo da operação" });
  const summaryCard = (name) =>
    summary.getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
  for (const [label, count] of [
    ["Contas conectadas", 2],
    ["Publicações na fila", 1],
    ["Vídeos na biblioteca", 40],
    ["Publicações no período", 3],
  ]) {
    await summaryCard(label).getByText(String(count), { exact: true }).waitFor();
  }
  await summaryCard("Publicações no período")
    .getByText("2 Reels publicados no período", { exact: true })
    .waitFor();
  await page.getByText("1 publicação precisa de atenção neste período.", { exact: true }).waitFor();
  const rankingPreview = page.getByRole("region", { name: "Contas com mais views" });
  assert.match(await rankingPreview.innerText(), /@conta_fixture_a/);
  assert.doesNotMatch(await rankingPreview.innerText(), /@conta_fixture_b/);
  const dateSwitch = page.waitForResponse((response) =>
    response.url().includes("/rpc/get_instagram_analytics"),
  );
  await page.getByRole("button", { name: "7 dias", exact: true }).click();
  const dateInput = (await dateSwitch).request().postDataJSON();
  assert.ok(Date.parse(dateInput.p_end) - Date.parse(dateInput.p_start) >= 7 * 23 * 3600 * 1000);
  await views.getByText("800", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Personalizado", exact: true }).click();
  await page.getByLabel("Data inicial").fill("2026-11-01");
  await page.getByLabel("Data final").fill("2026-11-02");
  const customRange = page.waitForResponse((response) =>
    response.url().includes("/rpc/get_instagram_analytics"),
  );
  await page.getByRole("button", { name: "Aplicar período", exact: true }).click();
  const submittedRange = (await customRange).request().postDataJSON();
  assert.equal(submittedRange.p_start, "2026-11-01T03:00:00.000Z");
  assert.equal(submittedRange.p_end, "2026-11-03T03:00:00.000Z");
  await views.getByText("800", { exact: true }).waitFor();
  if (process.env.INSTAGRAM_BROWSER_SCREENSHOTS)
    await page.screenshot({
      path: resolve(process.env.INSTAGRAM_BROWSER_SCREENSHOTS, "instagram-overview-desktop.png"),
      fullPage: true,
    });
  await page.getByRole("button", { name: "Biblioteca de Reels", exact: true }).click();
  await page.getByRole("button", { name: /@conta_fixture_b/ }).click();
  await page.getByText("Google Drive para Reels", { exact: true }).click();
  await page
    .getByText("A integração com Google Drive ainda não foi ativada nesta instalação.", {
      exact: true,
    })
    .waitFor();
  await page.getByText("Google Drive para Reels", { exact: true }).click();
  const folders = page.getByRole("region", { name: "Pastas da biblioteca" });
  const catalog = page.getByRole("region", { name: "Vídeos desta pasta" });
  await folders.getByRole("button", { name: "Teste 19", exact: true }).click();
  assert.equal(await catalog.getByRole("checkbox").count(), 19);
  await folders.getByRole("button", { name: "Sem pasta 1", exact: true }).click();
  assert.equal(await catalog.getByRole("checkbox").count(), 1);
  await catalog.getByRole("checkbox", { name: "Usar conta-3-video-20.mp4" }).uncheck();
  assert.equal(
    await catalog.getByRole("button", { name: "Próximo: configurar Reels" }).isDisabled(),
    true,
  );
  await folders.getByRole("button", { name: "Todos os vídeos 20", exact: true }).click();
  await catalog.getByRole("searchbox", { name: "Buscar vídeos" }).fill("CONTA-3-VIDEO-11");
  assert.equal(await catalog.getByRole("checkbox").count(), 1);
  assert.equal(
    await catalog.getByRole("checkbox", { name: "Usar conta-3-video-11.mp4" }).count(),
    1,
  );
  await catalog.getByRole("searchbox", { name: "Buscar vídeos" }).clear();
  await catalog.getByRole("searchbox", { name: "Buscar vídeos" }).blur();
  const chooseFiles = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Enviar vídeos", exact: true }).click();
  assert.equal((await chooseFiles).isMultiple(), true);
  if (process.env.INSTAGRAM_BROWSER_SCREENSHOTS)
    await page.screenshot({
      path: resolve(process.env.INSTAGRAM_BROWSER_SCREENSHOTS, "instagram-library-desktop.png"),
      fullPage: true,
    });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileFolders = folders.getByRole("combobox", { name: "Pasta da biblioteca" });
  await mobileFolders.click();
  await page.getByRole("option", { name: "Sem pasta (1)", exact: true }).click();
  assert.equal(await catalog.getByRole("checkbox").count(), 1);
  await mobileFolders.click();
  await page.getByRole("option", { name: "Todos os vídeos (20)", exact: true }).click();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
  if (process.env.INSTAGRAM_BROWSER_SCREENSHOTS)
    await page.screenshot({
      path: resolve(process.env.INSTAGRAM_BROWSER_SCREENSHOTS, "instagram-library-mobile.png"),
      fullPage: true,
    });
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
  accountBExpired = true;
  await page.reload();
  await page.getByRole("button", { name: "Contas conectadas", exact: true }).click();
  const cardB = page.getByRole("button", { name: "Abrir conta @conta_fixture_b", exact: true });
  const disconnectB = page.getByRole("button", {
    name: "Desconectar @conta_fixture_b",
    exact: true,
  });
  assert.match(await cardB.innerText(), /Acesso expirado/);
  await disconnectB.click();
  await page
    .getByRole("alertdialog", { name: "Desconectar @conta_fixture_b?", exact: true })
    .waitFor();
  assert.equal(await optionsB.count(), 0);
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Manter conectada", exact: true })
    .click();
  assert.equal(disconnections, 0);
  await cardB.click();
  await optionsB.waitFor();
  await disconnectB.click();
  const disconnectedResponse = page.waitForResponse(
    (response) => response.url().includes("/_serverFn/") && response.request().method() === "POST",
  );
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirmar desconexão", exact: true })
    .click();
  await disconnectedResponse;
  await page.getByRole("alertdialog").waitFor({ state: "detached" });
  await cardB.waitFor({ state: "detached" });
  await optionsB.waitFor({ state: "detached" });
  assert.equal(await disconnectB.count(), 0);
  await page
    .getByRole("status")
    .filter({ hasText: /@conta_fixture_b foi desconectada/ })
    .waitFor();
  const cardA = page.getByRole("button", { name: "Abrir conta @conta_fixture_a", exact: true });
  assert.match(await cardA.innerText(), /Conectada/);
  assert.equal(disconnections, 1);
  await page.reload();
  await page.getByRole("button", { name: "Contas conectadas", exact: true }).click();
  await cardA.waitFor();
  assert.equal(await cardB.count(), 0);
  assert.equal(await disconnectB.count(), 0);
  await page.getByRole("button", { name: "Biblioteca de Reels", exact: true }).click();
  await page.getByRole("button", { name: /@conta_fixture_b/ }).click();
  await page
    .getByRole("heading", { name: "Biblioteca de @conta_fixture_b", exact: true })
    .waitFor();
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
  storyRows.push({ ...storyRows[0], id: id(701), filename: "concluido.png", state: "done" });
  storyRows.push({ ...storyRows[0], id: id(702), filename: "cancelado.png", state: "cancelled" });
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  const upcoming = page.getByRole("region", { name: "Próximas publicações" });
  await upcoming.getByText(/Lembrete de Story ·/).waitFor();
  await upcoming.getByText("1 lembrete de Story pendente").waitFor();
  assert.equal(await upcoming.getByText(/concluido.png|cancelado.png/).count(), 0);
  await summaryCard("Publicações na fila").getByText("1", { exact: true }).waitFor();
  await summaryCard("Contas conectadas").getByText("1", { exact: true }).waitFor();
  await upcoming.getByRole("button", { name: "Ver lembretes" }).click();
  await page.getByRole("region", { name: "Biblioteca exclusiva de Stories" }).waitFor();
  remindersUnavailable = true;
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await upcoming.getByText("Não foi possível carregar toda a programação.").waitFor();
  assert.equal(await upcoming.getByText("Nenhuma publicação na fila").count(), 0);
  await summaryCard("Publicações na fila").getByText("1", { exact: true }).waitFor();
  remindersUnavailable = false;
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await upcoming.getByText("1 lembrete de Story pendente").waitFor();
  await upcoming.getByRole("button", { name: "Ver lembretes" }).click();
  await page
    .getByRole("button", { name: "Conectar outra conta para Stories", exact: true })
    .click();
  assert.equal(await page.getByRole("region", { name: "Passo a passo por conta" }).count(), 0);
  await page.getByRole("button", { name: "Próximo: biblioteca de Stories", exact: true }).waitFor();
  freshWorkspace = true;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(web + "/automacao-instagram?tab=stories");
  await page.getByRole("heading", { name: "Primeiros passos" }).waitFor();
  assert.equal(await page.getByText("App Meta da plataforma vinculado à operação").count(), 0);
  assert.equal(
    await page
      .getByRole("progressbar", { name: "Progresso dos primeiros passos" })
      .getAttribute("value"),
    "0",
  );
  assert.equal(
    await page.getByRole("region", { name: "Biblioteca exclusiva de Stories" }).count(),
    0,
  );
  assert.equal(
    await page.getByRole("button", { name: "Conectar Instagram", exact: true }).isDisabled(),
    true,
  );
  await page.getByRole("heading", { name: "Próximas publicações", exact: true }).waitFor();
  assert.equal(await page.getByLabel("Segredo do app").count(), 0);
  await page.getByRole("button", { name: "Ocultar primeiros passos", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Mostrar primeiros passos", exact: true }).click();
  await page.getByRole("region", { name: "Primeiros passos", exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
  if (process.env.INSTAGRAM_BROWSER_SCREENSHOTS)
    await page.screenshot({
      path: resolve(process.env.INSTAGRAM_BROWSER_SCREENSHOTS, "primeiros-passos-mobile.png"),
      fullPage: true,
    });
  await page.getByRole("button", { name: "Ver guia", exact: true }).click();
  const setupGuide = page.getByRole("region", { name: "Guia de configuração do Meta" });
  await setupGuide.getByRole("heading", { name: "Crie o app na Meta" }).waitFor();
  assert.equal(
    await setupGuide
      .getByRole("link", { name: "Abrir developers.facebook.com" })
      .getAttribute("href"),
    "https://developers.facebook.com/apps/",
  );
  const firstImage = setupGuide.getByRole("img", { name: /Tela Criar um app/ });
  await firstImage.evaluate((image) => image.decode());
  assert.equal(
    await firstImage.locator("..").getAttribute("href"),
    "/tutorial-meta/meta-01-criar-app.webp",
  );
  if (process.env.INSTAGRAM_BROWSER_SCREENSHOTS)
    await page.screenshot({
      path: resolve(process.env.INSTAGRAM_BROWSER_SCREENSHOTS, "cadastro-meta-mobile.png"),
      fullPage: true,
    });
  assert.equal(
    await setupGuide.getByRole("button", { name: "Voltar", exact: true }).isDisabled(),
    true,
  );
  await setupGuide.getByRole("button", { name: "Próximo", exact: true }).click();
  await setupGuide.getByRole("heading", { name: "Escolha o caso de uso e crie o app" }).waitFor();
  await setupGuide.getByRole("button", { name: "Voltar", exact: true }).click();
  await setupGuide.getByRole("heading", { name: "Crie o app na Meta" }).waitFor();
  for (let step = 2; step <= 7; step += 1) {
    await setupGuide.getByRole("button", { name: new RegExp(`Etapa ${step} de 7`) }).click();
    const images = await setupGuide.getByRole("img").all();
    assert.ok(images.length > 0, `Etapa ${step} sem captura`);
    await Promise.all(images.map((image) => image.evaluate((asset) => asset.decode())));
  }
  await setupGuide.getByRole("button", { name: /Etapa 5 de 7/ }).click();
  await setupGuide.getByText(web + "/api/instagram/oauth/callback", { exact: true }).waitFor();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: web });
  await setupGuide.getByRole("button", { name: "Copiar endereço", exact: true }).click();
  await setupGuide.getByText("Endereço copiado.", { exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    web + "/api/instagram/oauth/callback",
  );
  await setupGuide.getByRole("button", { name: /Etapa 7 de 7/ }).click();
  assert.equal(await setupGuide.getByRole("button", { name: "Próximo", exact: true }).count(), 0);
  assert.equal(await page.getByRole("form", { name: "Cadastro do app Meta" }).count(), 0);
  await setupGuide.getByRole("button", { name: "Ir para o cadastro", exact: true }).click();
  await page.getByRole("form", { name: "Cadastro do app Meta" }).waitFor();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
  await page.getByRole("button", { name: "Voltar à visão geral", exact: true }).click();
  await page.getByRole("button", { name: "Cadastrar app Meta", exact: true }).click();
  await setupGuide.getByRole("heading", { name: "Crie o app na Meta" }).waitFor();
  await setupGuide.getByRole("button", { name: /Etapa 6 de 7/ }).click();
  await page.getByLabel("ID do app Meta").fill(customerApp);
  await page.getByLabel("ID da configuração do Login Unificado").fill(customerConfig);
  await page.getByLabel("Segredo do app").fill("4".repeat(32));
  await page.getByRole("button", { name: "Validar e salvar app" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: /Meta não aceitou/ })
    .waitFor();
  assert.equal(appRow, null);
  assert.equal(
    await setupGuide.getByRole("button", { name: /Etapa 6 de 7/ }).getAttribute("aria-current"),
    "step",
  );
  await page.getByLabel("Segredo do app").fill(customerSecret);
  await page.getByRole("button", { name: "Validar e salvar app" }).click();
  await page.getByRole("button", { name: "Conectar a primeira conta", exact: true }).click();
  await page.getByRole("region", { name: "Passo a passo por conta" }).waitFor();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  const firstSteps = page.getByRole("region", { name: "Primeiros passos" });
  await firstSteps.getByRole("button", { name: "Conectar Instagram" }).waitFor();
  assert.equal(await firstSteps.getByRole("progressbar").getAttribute("value"), "1");
  assert.equal(
    await page.getByRole("region", { name: "Biblioteca exclusiva de Stories" }).count(),
    0,
  );
  assert.equal(await page.getByLabel("Segredo do app").count(), 0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await firstSteps.getByRole("button", { name: "Conectar Instagram" }).click();
  const newLogin = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Conectar Instagram", exact: true }).click();
  const freshPopup = await newLogin;
  await freshPopup.waitForURL("https://www.facebook.com/**");
  const auth = new URL(freshPopup.url());
  assert.equal(auth.searchParams.get("client_id"), customerApp);
  assert.equal(auth.searchParams.get("config_id"), customerConfig);
  assert.ok(!auth.href.includes(customerSecret));
  const cb = new URL(auth.searchParams.get("redirect_uri"));
  cb.searchParams.set("state", auth.searchParams.get("state"));
  cb.searchParams.set("code", "authorized-fixture");
  await freshPopup.goto(cb.href).catch((error) => {
    if (!/closed/i.test(error.message)) throw error;
  });
  await page
    .getByRole("status")
    .filter({ hasText: /@cliente_fixture conectada/ })
    .waitFor();
  await page.goto(web + "/automacao-instagram");
  await page.getByRole("button", { name: "Abrir conta @cliente_fixture" }).waitFor();
  assert.equal(await firstSteps.getByRole("progressbar").getAttribute("value"), "2");
  assert.deepEqual(errors, []);
  const googlePage = await browser.newPage();
  await googlePage.context().route(apiUrl + "/auth/v1/authorize?**", (route) => {
    const query = new URL(route.request().url()).searchParams;
    assert.equal(query.get("provider"), "google");
    assert.equal(query.get("code_challenge_method"), "s256");
    assert.match(query.get("code_challenge") ?? "", /^[a-zA-Z0-9_-]{43}$/);
    const destination = new URL(query.get("redirect_to"));
    assert.equal(destination.origin, web);
    assert.equal(destination.pathname, "/");

    destination.searchParams.set("code", "google-fixture-code");
    return route.fulfill({ status: 302, headers: { location: destination.href } });
  });
  await googlePage.goto(web);
  await googlePage.waitForFunction(() =>
    [...document.querySelectorAll("button")].some((button) =>
      button.textContent.trim() === "Continuar com Google" &&
      Object.keys(button).some((key) => key.startsWith("__reactProps")),
    ),
  );
  await googlePage.getByRole("button", { name: "Continuar com Google", exact: true }).click();
  await googlePage.getByRole("heading", { level: 1, name: /^(Bom dia|Boa tarde|Boa noite)(?:, .+)?!$/ }).waitFor();
  await googlePage.goto(web + "/automacao-instagram?tab=nova-conta");
  await googlePage.getByRole("region", { name: "Passo a passo por conta" }).waitFor();
  assert.equal(googleCodeExchanged, true);
  await googlePage.close();

  const visitor = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await visitor.goto(web);
  await visitor
    .getByRole("heading", { name: "Sua operação digital em um só lugar.", exact: true })
    .waitFor();
  assert.equal(
    await visitor.getByRole("link", { name: "Solicitar acesso", exact: true }).count(),
    0,
  );
  await visitor.waitForFunction(
    () => document.querySelector("button.saas-button-primary[type=submit]")?.disabled === false,
  );
  const landing = visitor.locator(".organic-landing");
  const loginControl = landing
    .locator("#acesso")
    .getByRole("button", { name: "Continuar com Google" });
  await landing
    .getByRole("heading", { name: "Veja a fila rodando ao vivo.", exact: true })
    .waitFor();
  await landing
    .locator("#ferramentas")
    .getByRole("heading", { name: "Instagram Intelligence" })
    .waitFor();
  await landing
    .locator("#ferramentas")
    .getByRole("heading", { name: "Fazenda de celulares" })
    .waitFor();
  assert.equal(await visitor.getByRole("button", { name: "Continuar com Google" }).count(), 1);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1024, height: 850 },
    { width: 1440, height: 900 },
  ]) {
    await visitor.setViewportSize(viewport);
    await visitor.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const entry = landing
      .getByRole("navigation", { name: "Menu público" })
      .getByRole("link", { name: "Criar conta", exact: true });
    assert.match(
      await entry.evaluate((element) => getComputedStyle(element).backgroundImage),
      /linear-gradient/,
    );
    const box = await entry.boundingBox();
    assert.ok(box && box.y >= 0 && box.y + box.height <= viewport.height);
    await entry.click();
    await loginControl.waitFor();
    await visitor.waitForFunction(
      () => location.hash === "#acesso" && document.activeElement?.id === "acesso",
    );
    assert.ok(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await visitor.mouse.move(100, 1);
  await visitor.evaluate(() => document.dispatchEvent(new MouseEvent("mouseout", { clientY: 0 })));
  assert.equal(await visitor.getByText("Antes de ir…", { exact: true }).count(), 0);
  assert.equal(await visitor.getByRole("dialog").count(), 0);

  const orbit = landing.getByRole("group", { name: "Áreas da operação" });
  await orbit.getByRole("button", { name: "Perfis", exact: true }).hover();
  await orbit.getByText("Perfis para analisar e comparar").waitFor();
  const media = await orbit.getByRole("img", { name: "Mascote MouseHot" }).evaluate((image) => ({
    loaded: image.complete && image.naturalWidth === 640,
    local: new URL(image.src).origin === location.origin,
  }));
  assert.deepEqual(media, { loaded: true, local: true });
  const marquee = landing.locator(".animate-marquee");
  assert.equal(
    await marquee.evaluate((element) => getComputedStyle(element).animationName),
    "organic-marquee",
  );

  const queue = landing.getByRole("region", { name: "Demonstração da fila de Reels" });
  const queuedPost = queue.getByRole("listitem").first();
  const initialPost = await queuedPost.textContent();
  await queue.getByRole("button", { name: "+ Agendar" }).click();
  await visitor.waitForFunction(
    (previous) =>
      document.querySelector('[aria-label="Demonstração da fila de Reels"] li')?.textContent !==
      previous,
    initialPost,
  );
  const calculator = landing.locator("#calculadora");
  const hours = calculator.getByRole("link", { name: /Quero essas/ });
  const before = await hours.textContent();
  await calculator.getByRole("slider", { name: /Perfis que você opera/ }).press("End");
  await visitor.waitForFunction(
    (previous) =>
      document.querySelector('#calculadora a[href="#acesso"]')?.textContent !== previous,
    before,
  );
  const compare = landing.getByRole("slider", { name: "Comparar antes e depois" });
  await compare.press("End");
  assert.equal(await compare.inputValue(), "100");
  await landing.getByRole("button", { name: "1 a 2", exact: true }).click();
  await landing.getByRole("button", { name: "Preparar mídia", exact: true }).click();
  await landing.getByRole("button", { name: "Escalar vários perfis", exact: true }).click();
  await landing.getByRole("heading", { name: "Comece pelo Preparo em Lote" }).waitFor();

  const trialFaq = landing.getByRole("button", { name: "Como funciona o convite de 15 minutos?" });
  await trialFaq.click();
  await landing.getByText(/O convite vale uma vez/).waitFor();
  await visitor.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await marquee.evaluate((element) => getComputedStyle(element).animationName),
    "none",
  );
  const mascotButton = landing.getByRole("button", { name: "Dê um toque no rato" });
  await mascotButton.click();
  await landing.getByText(/O chefe tá de olho/).waitFor();
  await landing
    .locator("#acesso")
    .getByRole("button", { name: "Criar conta", exact: true })
    .click();
  await visitor.getByLabel("Nome", { exact: true }).fill("Lead de Teste");
  await visitor.getByLabel("E-mail", { exact: true }).fill("new-lead@example.test");
  await visitor.getByLabel("Senha", { exact: true }).fill("fixture-password-only");
  await visitor.getByRole("button", { name: "Criar minha conta", exact: true }).click();
  await visitor
    .getByText(/Verifique seu e-mail para confirmar/)
    .or(visitor.getByRole("alert"))
    .waitFor();
  assert.equal(
    await visitor.getByRole("alert").count(),
    0,
    await visitor.getByRole("alert").allTextContents(),
  );
  assert.equal(newLeadSignedUp, true);
  await visitor.getByRole("button", { name: "Link por e-mail", exact: true }).click();
  await visitor.getByLabel("E-mail", { exact: true }).fill("new-lead@example.test");
  await visitor.getByRole("button", { name: "Enviar link de acesso", exact: true }).click();
  await visitor.getByText(/Enviamos um link de acesso/).waitFor();
  assert.equal(emailLinkSent, true);
  await visitor.goto(web + "/automacao-instagram");
  await visitor.getByRole("heading", { name: "Entre para usar a MouseHot" }).waitFor();
  await visitor.goto(web + "/#acesso");
  const loginForm = visitor.locator("#acesso .access-form-panel");
  await loginForm.getByRole("button", { name: "Entrar", exact: true }).click();
  await loginForm.getByLabel("E-mail", { exact: true }).fill("fixture@example.test");
  await loginForm.getByLabel("Senha", { exact: true }).fill("fixture-password-only");
  await loginForm.locator("form").getByRole("button", { name: "Entrar", exact: true }).click();
  await visitor.getByRole("heading", { level: 1, name: /^(Bom dia|Boa tarde|Boa noite)(?:, .+)?!$/ }).waitFor();
  await visitor.close();

  platformStatus = "pending";
  await page.goto(web + "/aprovacoes");
  await page.getByRole("heading", { name: "Aguardando aprovação do administrador" }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Aprovações e convites" }).count(), 0);
  await page.goto(web + "/convite#" + fixtureInvite);
  await page.getByRole("button", { name: "Iniciar meus 15 minutos" }).click();
  const toolsLink = page.getByRole("link", { name: "Ver todas as ferramentas", exact: true });
  await toolsLink.waitFor();
  assert.equal(new URL(page.url()).pathname, "/painel");
  await toolsLink.click();
  await page.getByRole("heading", { name: "Ferramentas do seu teste" }).waitFor();
  const overview = page.locator(".workspace-overview");
  assert.deepEqual(
    await overview
      .getByRole("link", { name: /^Abrir / })
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")).sort()),
    ["/gerar-preview", "/limpar-metadados", "/otimizar-criativos"],
  );
  assert.equal(await page.getByRole("link", { name: "Automatic Post", exact: true }).count(), 0);
  await page.getByRole("heading", { name: "Seu teste terminou" }).waitFor({ timeout: 15_000 });

  platformStatus = "admin";
  platformExpiry = null;
  await page.goto(web + "/painel");
  await page.getByRole("heading", { level: 1, name: /^(Bom dia|Boa tarde|Boa noite)(?:, .+)?!$/ }).waitFor();
  const publishingCard = overview.getByRole("article", { name: "Automatic Post · Instagram" });
  assert.equal(await publishingCard.count(), 0);
  await toolsLink.click();
  await publishingCard.waitFor();
  assert.equal(
    await publishingCard
      .getByRole("link", { name: "Abrir Automatic Post · Instagram" })
      .getAttribute("href"),
    "/automacao-instagram",
  );
  assert.equal(await page.getByRole("button", { name: "Gerar link de 15 minutos" }).count(), 0);
  assert.equal(
    await page
      .locator(".app-workspace")
      .evaluate((element) => getComputedStyle(element).getPropertyValue("--background").trim()),
    "#151114",
  );
  await page.getByRole("link", { name: "Aprovações e convites", exact: true }).click();
  await page.getByRole("heading", { name: "Aprovações e convites", exact: true }).waitFor();
  await page.getByText("Lead Fixture", { exact: true }).waitFor();
  const inviteCard = page.getByRole("region", { name: "Convites de 15 minutos" });
  await inviteCard.getByLabel("E-mail do convidado").fill("invite@example.test");
  await inviteCard.getByRole("button", { name: "Gerar link de 15 minutos" }).click();
  const link = await inviteCard.getByLabel("Link do convite").inputValue();
  assert.equal(link, web + "/convite#" + fixtureInvite);
  assert.equal(new URL(page.url()).pathname, "/aprovacoes");
  assert.equal(createdInvite, true);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: web });
  await inviteCard.getByRole("button", { name: "Copiar link" }).click();
  await inviteCard.getByText("Link copiado.", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), link);
  await page.getByRole("button", { name: "Aprovar", exact: true }).click();
  await page.getByText("Cadastro aprovado.", { exact: true }).waitFor();
  assert.equal(leadDecision, "approved");
  await page.getByLabel("Mostrar").selectOption("approved");
  await page.getByText("Lead Fixture", { exact: true }).waitFor();
  if (process.env.INSTAGRAM_BROWSER_SCREENSHOTS) {
    await page.screenshot({
      path: resolve(process.env.INSTAGRAM_BROWSER_SCREENSHOTS, "aprovacoes-desktop.png"),
    });
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: signup, password, email link, Google PKCE, access gates, trial expiry, admin invite, Instagram OAuth, library and scheduling; fixtures only",
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
