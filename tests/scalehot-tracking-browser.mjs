import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(
  resolve(process.env.INTELLIGENCE_PG_TEST_DEPS || ".", "package.json"),
);
const { chromium } = require("playwright-core");
const web = "http://127.0.0.1:4398";
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "fixture@example.test",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
};
const gateway = "00000000-0000-4000-8000-000000000002";
const sourceId = "00000000-0000-4000-8000-000000000003";
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const now = Math.floor(Date.now() / 1000);
const token =
  encode({ alg: "HS256" }) +
  "." +
  encode({ sub: user.id, role: "authenticated", iat: now, exp: now + 3600 }) +
  ".fixture";
let source;
let click;
let binding;
let meta;
let authorizeState;
const api = createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", web);
  response.setHeader(
    "Access-Control-Allow-Headers",
    "authorization,apikey,content-type,x-client-info,x-supabase-api-version,accept-profile,content-profile,prefer",
  );
  response.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PATCH,DELETE,OPTIONS");
  response.setHeader("Content-Type", "application/json");
  if (request.method === "OPTIONS") return response.writeHead(204).end();
  const path = new URL(request.url, "http://127.0.0.1").pathname;
  const resource = path.split("/").at(-1);
  const parts = [];
  for await (const part of request) parts.push(part);
  const input = parts.length ? JSON.parse(Buffer.concat(parts).toString("utf8")) : {};
  const object = request.headers.accept?.includes("vnd.pgrst.object");
  let body = [];
  switch (resource) {
    case "user":
      body = user;
      break;
    case "platform_access_status":
      body = { status: "approved", server_now: new Date().toISOString() };
      break;
    case "platform_is_approved":
      body = true;
      break;
    case "sales_overview":
      body = {
        links: [{ id: gateway, label: "Gateway de teste", provider: "syncpay", active: true }],
      };
      break;
    case "sales_webhook_links":
      body = [{ id: gateway }];
      break;
    case "sales_tracking_sources": {
      if (request.method === "POST") {
        assert.equal(input.user_id, user.id);
        assert.equal(input.link_id, gateway);
        source = { ...input, id: sourceId, active: true };
      }
      if (request.method === "PATCH") source.active = false;
      const rows = source && source.active ? [source] : [];
      body = object ? { id: sourceId } : rows;
      break;
    }
    case "sales_tracking_report": {
      assert.ok([7, 14, 30].includes(input.p_days));
      assert.ok(["campaign", "ad"].includes(input.p_breakdown));
      const attributed = Number(Boolean(binding));
      body = {
        approved: 2,
        attributed,
        unattributed: 2 - attributed,
        gross_cents: 23000,
        gross_attributed_cents: attributed * 8000,
        reversed_attributed_cents: 0,
        series: Array.from({ length: input.p_days }, (_, index) => ({
          day: new Date(Date.now() - (input.p_days - index - 1) * 86_400_000)
            .toISOString()
            .slice(0, 10),
          gross_attributed_cents: index === input.p_days - 1 ? attributed * 8000 : 0,
          gross_unattributed_cents: index === input.p_days - 1 ? 23000 - attributed * 8000 : 0,
          attributed: index === input.p_days - 1 ? attributed : 0,
        })),
        campaigns: binding
          ? [
              {
                source: click.p_utm_source,
                medium: null,
                campaign: click.p_utm_campaign,
                campaign_id: null,
                ad_id: input.p_breakdown === "ad" ? click.p_ad_id : null,
                sales: 1,
                gross_cents: 8000,
                reversed_cents: 0,
              },
            ]
          : [],
        sources: source
          ? [
              {
                id: sourceId,
                origin: source.origin,
                label: "Gateway de teste",
                active: source.active,
                gateway_active: true,
                last_click_at: click ? new Date().toISOString() : null,
              },
            ]
          : [],
      };
      break;
    }
    case "sales_tracking_capture": {
      assert.equal(input.p_secret, source.secret_hash);
      click = input;
      body = true;
      break;
    }
    case "sales_tracking_bind": {
      if (input.p_token !== click?.p_token) body = "invalid_click";
      else {
        binding = input.p_external_id;
        body = "bound";
      }
      break;
    }
    case "sales_meta_ads_connections": {
      if (request.method === "POST") meta = { ...meta, ...input };
      if (request.method === "DELETE") meta = undefined;
      if (request.method === "GET") body = meta ? [meta] : [];
      break;
    }
    case "sales_meta_ads_claim_state": {
      body = meta?.state_hash === input.p_hash && !meta.state_claimed_at ? user.id : null;
      if (body) meta.state_claimed_at = new Date().toISOString();
      break;
    }
    case "sales_meta_ads_finish_state": {
      body = meta?.state_hash === input.p_hash && Boolean(meta.state_claimed_at);
      if (body)
        meta = {
          user_id: input.p_owner,
          app_id: input.p_app,
          token_ciphertext: input.p_token,
          token_expires_at: input.p_expiry,
          accounts: input.p_accounts,
          connected_at: new Date().toISOString(),
        };
      break;
    }
  }
  response.end(JSON.stringify(body));
});
await new Promise((done) => api.listen(0, "127.0.0.1", done));
const apiUrl = "http://127.0.0.1:" + api.address().port;
function metaProviderFixture() {
  const original = globalThis.fetch;
  globalThis.fetch = (target, options) => {
    const url = new URL(target instanceof Request ? target.url : target);
    if (url.hostname !== "graph.facebook.com") return original(target, options);
    const auth = new Headers(options?.headers).get("Authorization");
    if (url.pathname.endsWith("/oauth/access_token")) {
      if (url.searchParams.get("code") === "authorized-fixture")
        return Promise.resolve(Response.json({ access_token: "short-fixture" }));
      if (url.searchParams.get("fb_exchange_token") === "short-fixture")
        return Promise.resolve(Response.json({ access_token: "long-fixture" }));
    }
    if (url.pathname.endsWith("/debug_token") && auth === "Bearer 123|fixture-secret") {
      return Promise.resolve(
        Response.json({
          data: { app_id: "123", is_valid: true, scopes: ["ads_read"], expires_at: 2000000000 },
        }),
      );
    }
    if (url.pathname.endsWith("/me/adaccounts") && auth === "Bearer long-fixture") {
      return Promise.resolve(
        Response.json({
          data: [
            {
              id: "act_1",
              name: "Conta piloto",
              currency: "BRL",
              timezone_name: "America/Sao_Paulo",
              account_status: 1,
            },
          ],
        }),
      );
    }
    if (url.pathname.endsWith("/act_1/insights") && auth === "Bearer long-fixture") {
      return Promise.resolve(
        Response.json({ data: [{ spend: "12.30", impressions: "100", clicks: "5" }] }),
      );
    }
    return Promise.resolve(Response.json({ error: { code: 190 } }, { status: 400 }));
  };
}
const vite = spawn(
  process.execPath,
  [
    "--import=data:text/javascript;base64," +
      Buffer.from("(" + metaProviderFixture.toString() + ")()").toString("base64"),
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "4398",
    "--strictPort",
  ],
  {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      APP_BASE_URL: web,
      VITE_SUPABASE_URL: apiUrl,
      SUPABASE_URL: apiUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: "fixture-anon",
      SUPABASE_PUBLISHABLE_KEY: "fixture-anon",
      SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
      SCALEHOT_META_ADS_ENABLED: "1",
      SCALEHOT_META_ADS_APP_ID: "123",
      SCALEHOT_META_ADS_APP_SECRET: "fixture-secret",
      SCALEHOT_META_ADS_ENCRYPTION_KEY: Buffer.alloc(32, 4).toString("base64"),
      META_GRAPH_API_VERSION: "v27.0",
    },
  },
);
let output = "";
vite.stdout.on("data", (chunk) => {
  output += chunk;
});
vite.stderr.on("data", (chunk) => {
  output += chunk;
});
let browser;
let page;
const requests = [];
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(web, { signal: AbortSignal.timeout(2000) })).ok) break;
    } catch {}
    assert.equal(vite.exitCode, null, output);
    await new Promise((done) => setTimeout(done, 500));
  }
  browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", error => {output += "\n" + error.message;});
  page.on("requestfailed", request => {output += "\n" + new URL(request.url()).pathname + " " + request.failure()?.errorText;});
  page.on("response", (response) => {
    if (response.url().startsWith(apiUrl) || response.url().includes("/_serverFn/")) {
      requests.push([new URL(response.url()).pathname, response.status()]);
    }
  });
  await page.addInitScript(
    ({ token, user, now }) => {
      localStorage.setItem(
        "sb-127-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "fixture",
          token_type: "bearer",
          expires_at: now + 3600,
          user,
        }),
      );
    },
    { token, user, now },
  );
  await page.goto(web + "/vendas/integracoes");
  await page.getByRole("heading", { name: "Cadastrar Pixel" }).waitFor({timeout: 90000});
  if (process.env.SCALEHOT_PIXEL_PREVIEW) {
    await page.locator("#pixels").screenshot({ path: process.env.SCALEHOT_PIXEL_PREVIEW });
  }
  await page.getByLabel("ID do Pixel ou dataset").fill("123456");
  await page.getByLabel("Token da API de Conversões").waitFor();
  await page.goto(web + "/vendas/rastreamento");
  await page.getByRole("link", { name: "Integrações", exact: true }).click();
  assert.equal(
    await page.getByRole("link", { name: "Integrações", exact: true }).getAttribute("aria-current"),
    "page",
  );
  assert.equal(
    await page.getByRole("link", { name: "Desempenho", exact: true }).getAttribute("aria-current"),
    null,
  );
  await page.getByLabel("Gateway", { exact: true }).selectOption(gateway, { timeout: 25000 });
  await page.getByLabel("Domínio da loja").fill("https://loja.example");
  await page.getByRole("button", { name: "Gerar credenciais da loja" }).click();
  const endpoint = await page.getByRole("textbox", { name: "URL", exact: true }).inputValue();
  const key = await page.getByRole("textbox", { name: "Chave", exact: true }).inputValue();
  assert.equal(source.secret_hash, hash(key));
  assert.equal(endpoint, web + "/api/vendas/tracking/" + sourceId);
  const send = (payload, secret = key) =>
    fetch(endpoint, {
      method: "POST",
      headers: { Authorization: "Bearer " + secret, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  const capture = {
    action: "click",
    advertisingConsent: true,
    landingUrl: "https://loja.example/?utm_source=meta&utm_campaign=Piloto&mh_ad_id=456",
  };
  assert.equal((await send(capture, "x".repeat(43))).status, 401);
  assert.equal((await send({ ...capture, advertisingConsent: false })).status, 422);
  const result = await send(capture);
  assert.equal(result.status, 201);
  const { clickToken } = await result.json();
  assert.equal(click.p_token, hash(clickToken));
  const bind = { action: "bind", clickToken, externalId: "pedido-42" };
  assert.equal((await send(bind)).status, 200);
  assert.equal((await send(bind)).status, 200);
  await page.getByRole("link", { name: "Desempenho", exact: true }).click();
  await page.getByRole("rowheader", { name: /Piloto/ }).waitFor();
  await page.getByRole("button", { name: "7 dias", exact: true }).click();
  await page.getByRole("rowheader", { name: /Piloto/ }).waitFor();
  await page.getByRole("searchbox", { name: "Buscar origem" }).fill("inexistente");
  await page.getByText("Nenhuma origem corresponde à busca.").waitFor();
  await page.getByRole("searchbox", { name: "Buscar origem" }).fill("");
  await page.getByRole("button", { name: "Anúncios", exact: true }).click();
  await page.getByRole("rowheader", { name: /Anúncio 456/ }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByRole("link", { name: "Integrações", exact: true }).click();
  await page.getByRole("button", { name: "Desativar https://loja.example" }).click();
  await page.getByText(/Gateway de teste · Desativado/).waitFor();
  assert.equal((await send(capture)).status, 401);
  await page.route("https://www.facebook.com/**", async (route) => {
    const url = new URL(route.request().url());
    assert.equal(url.searchParams.get("scope"), "ads_read");
    authorizeState = url.searchParams.get("state");
    const callback = new URL(url.searchParams.get("redirect_uri"));
    const stale = new URL(callback);
    stale.searchParams.set("state", "x".repeat(43));
    const staleResult = await page.request.get(stale.href, { maxRedirects: 0 });
    assert.equal(staleResult.headers().location, "/vendas/rastreamento?meta=session");
    callback.searchParams.set("state", authorizeState);
    callback.searchParams.set("code", "authorized-fixture");
    return route.fulfill({ status: 302, headers: { Location: callback.href } });
  });
  await page.getByRole("button", { name: "Conectar Meta Ads", exact: true }).click();
  await page.getByLabel("Conta de anúncios", { exact: true }).selectOption("act_1");
  assert.equal(meta.user_id, user.id);
  assert.match(meta.token_ciphertext, /^v1\./);
  assert.equal(JSON.stringify(meta).includes("long-fixture"), false);
  const replay = await fetch(
    web + "/api/vendas/ads/meta/callback?state=" + authorizeState + "&code=authorized-fixture",
    { redirect: "manual" },
  );
  assert.equal(replay.headers.get("location"), "/vendas/rastreamento?meta=session");
  await page.getByRole("button", { name: "Consultar", exact: true }).click();
  await page.getByText(/R\$\s*12,30/).waitFor();
  await page.getByRole("button", { name: "Desconectar", exact: true }).click();
  await page.getByRole("button", { name: "Conectar Meta Ads", exact: true }).waitFor();
  assert.equal(meta, undefined);
  console.log(
    "ScaleHot browser passed: source setup, capture, binding, mobile report, revocation, Meta OAuth, spend and disconnect (fixtures).",
  );
} catch (error) {
  console.error(output.slice(-2200));
  console.error(requests.slice(-16));
  console.error((await page?.locator("main").allTextContents())?.join(" ").slice(0, 850));
  throw error;
} finally {
  await browser?.close();
  vite.kill();
  api.closeAllConnections();
  await new Promise((done) => api.close(done));
}
