import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { serveLocalUi } from "../apps/hot-profiles-desktop/local-server.mjs";

test("desktop bootstrap cannot be enabled by a regular Node CLI without its private parent channel", async () => {
  const execute = promisify(execFile);
  await assert.rejects(
    execute(
      process.execPath,
      ["tools/hot-profiles/bridge.mjs", "--desktop-origin", "http://127.0.0.1:8080"],
      { windowsHide: true },
    ),
    (error) =>
      error.code === 1 &&
      error.stderr.includes("O modo desktop requer") &&
      !error.stdout.includes("token"),
  );
});

test("desktop serves only bundled UI over loopback and rejects foreign hosts, methods, sites and traversal", async (t) => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "hp-desktop-server-"));
  const root = path.join(folder, "ui");
  await mkdir(root);
  await writeFile(path.join(root, "index.html"), "<html>local desktop fixture</html>");
  await writeFile(path.join(folder, "outside.txt"), "must-not-be-served");
  const server = await serveLocalUi(root);
  t.after(async () => {
    await server.close();
    await rm(folder, { recursive: true, force: true });
  });
  const request = (route = "/", headers = {}, method = "GET") =>
    new Promise((resolve, reject) => {
      const req = http.request(server.origin + route, { method, headers }, (response) => {
        let body = "";
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () =>
          resolve({ status: response.statusCode, headers: response.headers, body }),
        );
      });
      req.on("error", reject);
      req.end();
    });
  const valid = await request();
  assert.equal(new URL(server.origin).hostname, "127.0.0.1");
  assert.equal(valid.status, 200);
  assert.match(valid.body, /local desktop fixture/);
  assert.match(valid.headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.equal(valid.headers["access-control-allow-origin"], undefined);
  assert.equal((await request("/", { Host: "untrusted.example" })).status, 404);
  assert.equal((await request("/", { "Sec-Fetch-Site": "cross-site" })).status, 404);
  assert.equal((await request("/", {}, "POST")).status, 404);
  for (const route of [
    "/%2e%2e%2foutside.txt",
    "/%2e%2e%5coutside.txt",
    "/C:%5coutside.txt",
    "/missing",
  ]) {
    const rejected = await request(route);
    assert.equal(rejected.status, 404);
    assert.equal(rejected.body.includes("must-not-be-served"), false);
  }
});
