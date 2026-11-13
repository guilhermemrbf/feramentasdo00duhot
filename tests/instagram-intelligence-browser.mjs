import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { once } from "node:events";
import { spawnSync } from "node:child_process";

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
  create_instagram_intelligence_batch: ["p_name", "p_usernames"],
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
      const statement =
        name === "list_instagram_intelligence_sources"
          ? "select * from public.list_instagram_intelligence_sources()"
          : "select public." + name + "(" + params + ") as value";
      const { rows } = await tx.query(
        statement,
        keys.map((key) => body[key]),
      );
      return name === "list_instagram_intelligence_sources" ? rows : rows[0].value;
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
  ]) {
    await db.exec(
      await readFile(new URL("../supabase/migrations/" + file, import.meta.url), "utf8"),
    );
  }
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
  await page.getByLabel("Nome do lote").fill("Validação local");
  await page.getByLabel("Links de perfil ou @usuários").fill("@perfil_teste");
  await page.getByRole("button", { name: "Salvar lote" }).click();
  const publishedAt = new Date(Date.now() - 24 * 3600000).toISOString();
  await page.getByLabel("Arquivo de métricas autorizadas").setInputFiles({
    name: "metricas-autorizadas.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        {
          username: "perfil_teste",
          snapshot: {
            capturedAt: new Date().toISOString(),
            followers: 500,
            reels: [{ publishedAt, url: "https://www.instagram.com/reel/exemplo01/", views: 1234 }],
          },
        },
      ]),
    ),
  });
  await page.getByLabel("Tenho autorização para usar os dados deste arquivo.").check();
  await page.getByRole("button", { name: "Importar e analisar" }).click();
  await page.getByRole("button", { name: "@perfil_teste" }).click();
  await page.getByText("Fichas por Reel (1)").click();
  await page.getByText("1.234 views", { exact: false }).last().waitFor();
  const [csv] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exportar seleção do filtro" }).click(),
  ]);
  assert.match(await readFile(await csv.path(), "utf8"), /perfil_teste.*1234/);
  const [pdf] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Baixar relatório em PDF" }).click(),
  ]);
  assert.match((await readFile(await pdf.path())).subarray(0, 8).toString(), /^%PDF-/);

  await page.getByRole("button", { name: "Registrar revisão", exact: true }).click();
  await page
    .getByLabel("Reel para revisar", { exact: false })
    .selectOption("https://www.instagram.com/reel/exemplo01/");
  const media = spawnSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=240x320:rate=24",
    "-t",
    "3",
    "-c:v",
    "libx264",
    "-movflags",
    "frag_keyframe+empty_moov",
    "-f",
    "mp4",
    "pipe:1",
  ]);
  assert.equal(media.status, 0, media.stderr?.toString());
  await page.getByLabel("Vídeo local para ", { exact: false }).setInputFiles({
    name: "fixture.mp4",
    mimeType: "video/mp4",
    buffer: media.stdout,
  });
  await page.getByRole("button", { name: "Extrair frames" }).click();
  await page.getByAltText("Frame em 0 segundos", { exact: true }).waitFor();
  assert((await page.getByAltText(/^Frame em /).count()) > 3);
  if (process.env.INTELLIGENCE_TEST_OLLAMA === "1") {
    const attach = page.getByRole("button", { name: "Anexar sugestões à ficha" });
    const alerts = page.getByRole("alert");
    await page.getByRole("button", { name: "Sugerir observações com IA local" }).click();
    await attach.or(alerts).first().waitFor({ timeout: 100000 });
    assert(await attach.isVisible(), await alerts.allTextContents());
    await attach.click();
  }
  await page.getByLabel("Observação da revisão").fill("Frames sintéticos revisados no navegador.");
  await page.getByRole("button", { name: "Salvar revisão" }).click();
  await page.getByText("Histórico de revisões", { exact: true }).waitFor();
  if (process.env.INTELLIGENCE_TEST_OLLAMA === "1") {
    await page.getByText("Sugestões registradas de qwen3.5:0.8b.", { exact: false }).waitFor();
    console.log("Ollama: inferência visual real e registro das observações confirmados.");
  }
  assert.equal(runtimeErrors.length, 0, runtimeErrors.join("\n"));
  console.log(
    "Chrome + PostgreSQL: cadastro, upload JSON, processamento, ranking, relatório, CSV, PDF, vídeo local e revisão.",
  );
} finally {
  await browser?.close();
  api.closeAllConnections();
  api.close();
  await db.close();
}
