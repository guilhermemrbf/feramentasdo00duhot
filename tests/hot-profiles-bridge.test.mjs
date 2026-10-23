import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";

test("local bridge authenticates pairing, enforces origin and proxy ownership, and never returns passwords", async (t) => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "hot-bridge-test-"));
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const child = spawn(
    process.execPath,
    [
      "tools/hot-profiles/bridge.mjs",
      "--port",
      String(port),
      "--data-dir",
      folder,
      "--max-sessions",
      "2",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let stdout = "";
  child.stdout.on("data", (bytes) => {
    stdout += bytes;
  });
  let stderr = "";
  child.stderr.on("data", (bytes) => {
    stderr += bytes;
  });
  t.after(async () => {
    if (child.exitCode === null) {
      const end = once(child, "exit");
      child.kill("SIGTERM");
      await end;
    }
    await rm(folder, { recursive: true, force: true });
  });
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100 && !stdout.includes("Código de conexão:"); attempt++) {
    if (child.exitCode !== null) assert.fail("Connector exited before pairing");
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  const code = stdout.match(/Código de conexão: (\d{6})/)?.[1];
  assert.ok(code, "connector must expose a one-time pairing code");
  async function call(route, { input, method, token, origin = "http://localhost:8080" } = {}) {
    const response = await fetch(url + route, {
      method: method ?? (input === undefined ? "GET" : "POST"),
      headers: {
        Origin: origin,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(input === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    return { status: response.status, body: await response.json() };
  }
  assert.equal((await call("/v1/state")).status, 401);
  assert.equal(
    (await call("/pair", { input: { code }, origin: "https://unrelated.example" })).status,
    403,
  );
  const paired = await call("/pair", { input: { code } });
  assert.equal(paired.status, 200);
  const token = paired.body.token;
  assert.equal(
    (await call("/v1/state", { token, origin: "https://unrelated.example" })).status,
    403,
  );
  const proxy = {
    name: "Proxy do projeto",
    protocol: "http",
    host: "127.0.0.1",
    port: 3128,
    username: "fixture-user",
    password: "private-fixture",
    clearPassword: false,
  };
  const added = await call("/v1/proxies", { token, input: proxy });
  assert.equal(added.status, 200);
  assert.equal(added.body.hasPassword, true);
  assert.equal("secret" in added.body, false);
  const input = {
    name: "Navegador A",
    kind: "browser",
    tags: [],
    notes: "",
    proxyId: added.body.id,
    startUrls: [],
    viewport: { width: 1280, height: 800 },
  };
  const first = await call("/v1/profiles", { token, input });
  assert.equal(first.status, 200);
  assert.equal((await call("/v1/profiles", { token, input: { ...input, name: "B" } })).status, 409);
  assert.equal(
    (await call(`/v1/proxies/${added.body.id}`, { token, input: {}, method: "DELETE" })).status,
    409,
  );
  const state = await call("/v1/state", { token });
  assert.equal(state.body.performance.maxSessions, 2);
  assert.equal(state.body.sessions.length, 0);
  assert.equal(JSON.stringify(state.body).includes("private-fixture"), false);
  assert.equal(
    (await readFile(path.join(folder, "workspace.json"), "utf8")).includes("private-fixture"),
    false,
  );
  assert.equal(stderr.includes("private-fixture"), false);
  assert.equal(stdout.includes("private-fixture"), false);
  assert.equal(
    (
      await call(`/v1/profiles/${first.body.id}`, {
        token,
        input: { ...input, proxyId: null },
        method: "PATCH",
      })
    ).status,
    200,
  );
  assert.equal(
    (await call(`/v1/proxies/${added.body.id}`, { token, input: {}, method: "DELETE" })).status,
    200,
  );
});
