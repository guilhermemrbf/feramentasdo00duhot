import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { once } from "node:events";

const require = createRequire(
  resolve(process.env.INTELLIGENCE_PG_TEST_DEPS || ".", "package.json"),
);
const { PGlite } = require("@electric-sql/pglite");
const { chromium } = require("playwright-core");
const db = new PGlite();
const uid = "f0fb6477-21a5-4a6e-84a2-4ccfa03a2e38";
const web = "http://127.0.0.1:4382";
const now = Math.floor(Date.now() / 1000);
const claims = { sub: uid, role: "authenticated", is_anonymous: false, iat: now, exp: now + 3600 };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = encode({ alg: "HS256" }) + "." + encode(claims) + ".test";
const chrome =
  process.env.INTELLIGENCE_CHROME ||
  (process.platform === "win32"
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : "/usr/bin/google-chrome");

const rpc = {
  analyze_instagram_intelligence_batch: ["p_usernames"],
  list_instagram_intelligence_sources: [],
  list_instagram_intelligence_results: ["p_batch"],
  enqueue_instagram_intelligence_import: ["p_batch", "p_label", "p_items"],
  get_instagram_intelligence_report: ["p_job"],
  save_instagram_intelligence_review: ["p_job", "p_assessment"],
};

const api = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", web);
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, apikey, content-type, x-client-info, accept-profile, content-profile, prefer, range",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  if (req.headers.authorization !== "Bearer " + token) return res.writeHead(401).end("{}");
  const url = new URL(req.url, web);
  const name = url.pathname.split("/").at(-1);
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
    const result = await db.transaction(async (tx) => {
      await tx.exec("set local role authenticated");
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      if (name === "instagram_intelligence_batches") {
        return (
          await tx.query(
            "select id,name,profile_count,created_at from public.instagram_intelligence_batches order by created_at desc",
          )
        ).rows;
      }
      const keys = rpc[name];
      assert(keys, "RPC inesperado " + name);
      const params = keys.map((_, i) => "$" + (i + 1)).join(",");
      const statement = [
        "list_instagram_intelligence_sources",
        "analyze_instagram_intelligence_batch",
      ].includes(name)
        ? "select * from public." + name + "(" + params + ")"
        : "select public." + name + "(" + params + ") as value";
      const { rows } = await tx.query(
        statement,
        keys.map((key) => body[key]),
      );
      if (name === "list_instagram_intelligence_sources") return rows;
      if (name === "analyze_instagram_intelligence_batch") return rows[0];
      return rows[0].value;
    });
    if (name === "enqueue_instagram_intelligence_import")
      await db.query("select private.process_instagram_intelligence_jobs(25)");
    res.end(JSON.stringify(result));
  } catch (error) {
    console.error(error.message);
    res.writeHead(400).end(JSON.stringify({ code: error.code, message: error.message }));
  }
});

let browser;
try {
  await db.exec(
    "create role authenticated; create role anon; create role service_role; create schema auth; create schema private;" +
      "create table auth.users(id uuid primary key);" +
      "create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;" +
      "create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;" +
      "grant usage on schema auth to authenticated; insert into auth.users values ('" +
      uid +
      "');" +
      "create table public.workspaces(id uuid primary key, owner_id uuid, name text);" +
      "create table public.instagram_accounts(id uuid primary key, workspace_id uuid, username text, connection_status text);" +
      "create table private.instagram_analytics_sync(account_id uuid primary key, followers bigint);" +
      "create table private.instagram_analytics_media(account_id uuid, media_id text, kind text, published_at timestamptz, permalink text, views bigint, likes bigint, comments bigint, measured_at timestamptz);",
  );
  for (const file of [
    "20261112235500_instagram_intelligence_import.sql",
    "20261113130000_instagram_intelligence_processing.sql",
    "20261113193000_instagram_intelligence_analyze.sql",
  ]) {
    await db.exec(
      await readFile(new URL("../supabase/migrations/" + file, import.meta.url), "utf8"),
    );
  }
  await db.query("insert into public.workspaces values ($1,$2,'Equipe')", [
    "9a5f7332-eb29-467b-8d14-39917443b095",
    uid,
  ]);
  await db.query(
    "insert into public.instagram_accounts values (gen_random_uuid(),$1,'perfil_teste','connected')",
    ["9a5f7332-eb29-467b-8d14-39917443b095"],
  );
  api.listen(4383, "127.0.0.1");
  await once(api, "listening");
  browser = await chromium.launch({ executablePath: chrome, headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await page.addInitScript(
    ({ uid, token, now }) => {
      localStorage.setItem(
        "sb-127-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "test",
          token_type: "bearer",
          expires_at: now + 3600,
          user: {
            id: uid,
            aud: "authenticated",
            role: "authenticated",
            is_anonymous: false,
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        }),
      );
    },
    { uid, token, now },
  );
  await page.goto(web + "/instagram-intelligence");
  await page.getByRole("heading", { name: "Cole os links dos perfis" }).waitFor({ timeout: 6000 });
  const input = page.getByRole("textbox", { name: "Cole os links dos perfis" });
  const action = page.getByRole("button", { name: "ANALISAR", exact: true });
  await input.fill("https://example.org/conta");
  await page.getByRole("alert").filter({ hasText: "Corrija" }).waitFor();
  assert.equal(await action.isEnabled(), false);
  await input.fill("https://www.instagram.com/perfil_teste/\n@Perfil_Teste\n@segundo_perfil");
  await page.getByText(/1 duplicidade removida/).waitFor();
  await action.click();
  await page.getByText("0 de 2 perfis processados").waitFor();
  await page.getByText("Sem uma fonte de dados autorizada para este perfil.").waitFor();
  await db.query("select private.process_instagram_intelligence_jobs(25)");
  await page.getByText("1 de 2 perfis processados").waitFor();
  await page.getByRole("heading", { name: "@perfil_teste" }).waitFor();
  await page.getByText("Aguardando revisão de conteúdo e do Status da Conta.").waitFor();
  const result = page.getByRole("region", { name: "Não aprovados", exact: true });
  assert.match(await result.innerText(), /^2\n/);
  assert.equal(await result.getByText("Sem nota final", { exact: true }).count(), 2);
  assert.equal(await page.getByRole("button").count(), 1);
  assert.equal(await page.getByRole("navigation").count(), 0);
  const model = page.getByRole("region", { name: "Modelo de pontuação" });
  for (const weight of [35, 25, 30, 10]) {
    await model.getByText(weight + "%", { exact: true }).waitFor();
  }
  await page.reload();
  await page.getByText("1 de 2 perfis processados").waitFor();
  await page.setViewportSize({ width: 360, height: 800 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.goto(web + "/instagram-intelligence?modo=revisao");
  await page.getByText("Cole os links dos perfis").waitFor();
  await page.getByLabel("Arquivo de métricas autorizadas").waitFor();
  await page.getByRole("button", { name: "@perfil_teste", exact: true }).click();
  await page.getByRole("button", { name: "Registrar revisão", exact: true }).waitFor();
  assert.deepEqual(runtimeErrors, []);
  console.log(
    "Chrome + PostgreSQL: entrada, progresso automático, zero pontuações inventadas, pesos, retomada e celular.",
  );
} finally {
  await browser?.close();
  api.closeAllConnections();
  api.close();
  await db.close();
}
