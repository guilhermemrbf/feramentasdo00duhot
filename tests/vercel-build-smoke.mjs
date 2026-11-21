import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { TOOL_CATALOG } from "../src/lib/tool-catalog.ts";

const output = new URL("../.vercel/output/", import.meta.url);
const { default: app } = await import(new URL("functions/__server.func/index.mjs", output));
const origin = process.env.APP_BASE_URL;
assert.ok(origin, "APP_BASE_URL must match the origin used for the build");
const context = { waitUntil: (promise) => Promise.resolve(promise).catch(() => {}) };
const request = (path, init) => app.fetch(new Request(new URL(path, origin), init), context);

const routes = new Set([
  "/",
  "/painel",
  "/aprovacoes",
  "/convite",
  ...TOOL_CATALOG.map(({ path }) => path),
  "/email-temporario",
  "/privacidade",
  "/exclusao-de-dados",
]);

for (const path of routes) {
  const response = await request(path);
  assert.equal(response.status, 200, path);
  const html = await response.text();
  assert.match(html, /<title>[^<]*M[ao]useHot[^<]*<\/title>/i, path);
  assert.doesNotMatch(html, /Não foi possível abrir esta página/);
  if (path === "/privacidade" || path === "/exclusao-de-dados") {
    assert.ok(html.includes(new URL(path, origin).href), path + " canonical");
  }
}

for (const [path, target] of [
  ["/control-hub", "/fazenda-de-celulares"],
  ["/automacao-tiktok", "/automacao-instagram"],
]) {
  const response = await request(path);
  assert.ok([301, 308].includes(response.status), path);
  assert.equal(new URL(response.headers.get("location"), origin).pathname, target);
}

const deniedOAuth = await request("/api/instagram/oauth/callback?error=access_denied");
assert.equal(deniedOAuth.status, 200);
assert.match(await deniedOAuth.text(), /A autorização foi cancelada/);
const worker = await request("/api/instagram/worker", { method: "POST" });
assert.equal(worker.status, 401);
const driveCleanup = await request("/api/instagram/drive-cleanup", { method: "POST" });
assert.equal(driveCleanup.status, 401);

for (const asset of [
  "brand/mark.png",
  "brand/compact.webp",
  "hot-profiles-connector.zip",
  "downloads/Mouse-Hot-Downloader-3.0.7.zip",
]) {
  assert.ok((await stat(new URL("static/" + asset, output))).size > 0, asset);
}
const archive = await readFile(new URL("static/hot-profiles-connector.zip", output));
const sums = await readFile(new URL("static/hot-profiles-SHA256SUMS.txt", output), "utf8");
assert.equal(
  sums.trim(),
  createHash("sha256").update(archive).digest("hex") + "  hot-profiles-connector.zip",
);
console.log(
  `PASS: ${routes.size} pages, legacy redirects, authenticated worker, OAuth callback and bundled assets in the Vercel artifact.`,
);
