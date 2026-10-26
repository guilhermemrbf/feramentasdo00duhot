// Explicit opt-in smoke test: creates only an empty, isolated device in the
// supplied writable workspace directory. Never reads existing personal AVDs.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { startLocalAndroid, discoverRuntime } from "./android-runtime.mjs";
import { createGateway } from "./proxy.mjs";

if (!process.argv.includes("--run-empty-device"))
  throw new Error("Use --run-empty-device --directory <pasta exclusiva>.");
const at = process.argv.indexOf("--directory");
if (at < 0 || !process.argv[at + 1]) throw new Error("Informe uma pasta exclusiva para o teste.");
const directory = path.resolve(process.argv[at + 1]);
await mkdir(directory, { recursive: true });
const report = { ok: false, runtime: (await discoverRuntime()).image?.description, checks: {} };
const reuse = process.argv.indexOf("--reuse-test-id");
const id = reuse < 0 ? randomUUID() : process.argv[reuse + 1];
const profile = {
  id,
  deviceId: `runtime:${id}`,
  kind: "android",
  name: "Celular de teste vazio",
  startUrls: [],
  hostAddress: "127.0.0.1",
};
let runtime, gateway, upstream, direct;
const connections = new WeakMap();
const listen = async (server) => {
  const sockets = new Set();
  connections.set(server, sockets);
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server.address().port;
};
const close = async (server) => {
  for (const socket of connections.get(server) || []) socket.destroy();
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
};
try {
  upstream = http.createServer((_request, response) => response.end("HOT_RUNTIME_PROXY_OK"));
  upstream.on("connect", (_request, socket) => {
    socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    socket.once("data", () =>
      socket.end(
        "HTTP/1.1 200 OK\r\nContent-Length: 20\r\nConnection: close\r\n\r\nHOT_RUNTIME_PROXY_OK",
      ),
    );
  });
  const upstreamPort = await listen(upstream);
  gateway = await createGateway({
    protocol: "http",
    host: "127.0.0.1",
    port: upstreamPort,
    username: "",
    password: "",
  });
  let directHits = 0;
  direct = http.createServer((_request, response) => {
    directHits++;
    response.end("DIRECT_ROUTE_MUST_NOT_WORK");
  });
  const directPort = await listen(direct);
  console.log("Booting isolated empty Android...");
  runtime = await startLocalAndroid(profile, directory, gateway, undefined, async () => {}, {
    onDiagnostic: (value) => writeFile(path.join(directory, "motor-diagnostic.txt"), value),
  });
  report.checks.boot = true;
  await runtime.diagnosticCommand(["shell", "input", "keyevent", "224"]);
  await runtime.diagnosticCommand(["shell", "am", "start", "-a", "android.settings.SETTINGS"]);
  await new Promise((resolve) => setTimeout(resolve, 5000));
  let frame = await runtime.frame();
  for (let n = 0; n < 20 && Buffer.from(frame.image.split(",")[1], "base64").length <= 5000; n++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    frame = await runtime.frame();
  }
  assert.ok(frame.width > 0 && frame.image.startsWith("data:image/png;base64,"));
  await writeFile(
    path.join(directory, "android-screen.png"),
    Buffer.from(frame.image.split(",")[1], "base64"),
  );
  assert.ok(
    Buffer.from(frame.image.split(",")[1], "base64").length > 5000,
    "A captura deve mostrar a interface Android, não apenas um PNG preto.",
  );
  report.checks.screen = true;
  await runtime.control({ action: "key", key: "home" });
  await runtime.control({ action: "tap", x: 100, y: 100 });
  await runtime.control({ action: "swipe", x: 250, y: 750, toX: 250, toY: 250 });
  report.checks.input = true;
  await runtime.diagnosticCommand([
    "shell",
    "sh",
    "-c",
    "'echo HOT_RUNTIME_PERSISTENCE > /data/local/tmp/hot-profiles-marker'",
  ]);
  const request = `printf 'GET http://fixture.invalid/test HTTP/1.0\\r\\nHost: fixture.invalid\\r\\n\\r\\n'; sleep 2`;
  const proxied = await runtime.diagnosticCommand([
    "shell",
    `(${request}) | toybox nc -q 3 -w 3 -W 3 127.0.0.1 ${gateway.port}`,
  ]);
  assert.match(proxied, /HOT_RUNTIME_PROXY_OK/);
  report.checks.localProxyTraffic = true;
  for (const host of ["10.0.2.2", "10.0.2.16"]) {
    const bypass = await runtime
      .diagnosticCommand([
        "shell",
        `(${request}) | toybox nc -q 3 -w 3 -W 3 ${host} ${directPort} || true`,
      ])
      .catch(() => "");
    assert.ok(!bypass.includes("DIRECT_ROUTE_MUST_NOT_WORK"));
  }
  assert.equal(directHits, 0);
  report.checks.directHostRouteBlocked = true;
  await close(upstream);
  const failed = await runtime.diagnosticCommand([
    "shell",
    `(${request}) | toybox nc -q 3 -w 3 -W 3 127.0.0.1 ${gateway.port}`,
  ]);
  assert.match(failed, /502/);
  assert.equal(directHits, 0);
  report.checks.proxyFailure502 = true;
  await runtime.stop();
  runtime = null;
  console.log("Restarting the same empty Android to verify persistence...");
  runtime = await startLocalAndroid(profile, directory, null, undefined, async () => {});
  const marker = await runtime.diagnosticCommand([
    "shell",
    "cat",
    "/data/local/tmp/hot-profiles-marker",
  ]);
  assert.match(marker, /HOT_RUNTIME_PERSISTENCE/);
  report.checks.persistentDataAfterRestart = true;
  await runtime.stop();
  runtime = null;
  report.checks.shutdown = true;
  report.ok = true;
} catch (error) {
  report.error = error.message;
  if (runtime) await writeFile(path.join(directory, "motor-diagnostic.txt"), runtime.diagnostic());
  throw error;
} finally {
  await runtime?.stop();
  gateway?.close();
  await close(upstream);
  await close(direct);
  await writeFile(path.join(directory, "runtime-self-test.json"), JSON.stringify(report, null, 2));
}
