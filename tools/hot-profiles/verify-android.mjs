// Opt-in integration check against an existing local Android. No accounts,
// screenshots, downloads, external destinations, or persistent profile store.
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { discoverAndroid, findAdb, startAndroid } from "./android.mjs";
import { createGateway } from "./proxy.mjs";

const index = process.argv.indexOf("--device");
const deviceId = index >= 0 ? process.argv[index + 1] : null;
if (!deviceId)
  throw new Error(
    "Use node verify-android.mjs --device bluestacks:Pie64. O Android deve estar aberto e com ADB local habilitado.",
  );
const discovery = await discoverAndroid();
const device = discovery.devices.find((d) => d.id === deviceId && d.ready);
if (!device)
  throw new Error(
    "Instância sem endpoint ADB confirmado. Abra-a e confira as opções avançadas do BlueStacks.",
  );
if (discovery.adbRemoteEnabled)
  throw new Error("Desative o ADB remoto antes desta verificação local.");
const binary = await findAdb();
const execute = promisify(execFile);
const command = async (args) =>
  (
    await execute(binary, ["-s", device.serial, ...args], {
      timeout: 10000,
      maxBuffer: 16384,
      windowsHide: true,
    })
  ).stdout;
const sockets = new Set();
const listen = async (server) => {
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.once("close", () => sockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
};
let delivered = 0;
const target = http.createServer((_req, res) => {
  delivered++;
  res.end("hot-profiles-local-fixture");
});
const upstream = http.createServer();
let gateway, runtime, report, previous;
try {
  const targetPort = await listen(target);
  upstream.on("connect", (request, client, head) => {
    if (request.url !== "hot-profiles-test.invalid:80") {
      client.destroy();
      return;
    }
    const remote = net.connect(targetPort, "127.0.0.1", () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) remote.write(head);
      client.pipe(remote).pipe(client);
    });
    remote.on("error", () => client.destroy());
    client.on("error", () => remote.destroy());
    client.on("close", () => remote.destroy());
    remote.on("close", () => client.destroy());
  });
  const upstreamPort = await listen(upstream);
  gateway = await createGateway({
    host: "127.0.0.1",
    port: upstreamPort,
    protocol: "http",
    username: "",
    password: "",
  });
  previous = (await command(["shell", "settings", "get", "global", "http_proxy"])).trim();
  runtime = await startAndroid({ deviceId, hostAddress: "127.0.0.1", startUrls: [] }, gateway);
  report = await runtime.network();
  assert.equal(report.systemProxyMatches, true);
  // This Android 9 netcat can finish at stdin EOF before receiving its response.
  const request = () =>
    command([
      "shell",
      `(printf 'GET http://hot-profiles-test.invalid/ HTTP/1.1\\r\\nHost: hot-profiles-test.invalid\\r\\nConnection: close\\r\\n\\r\\n'; sleep 2) | toybox nc -q 3 -w 3 -W 3 127.0.0.1 ${gateway.port}`,
    ]);
  assert.match(await request(), /hot-profiles-local-fixture/);
  assert.equal(delivered, 1);
  await new Promise((resolve) => upstream.close(resolve));
  assert.match(await request(), /502/);
  assert.equal(delivered, 1);
  await runtime.stop();
  runtime = null;
  if ((await command(["shell", "settings", "get", "global", "http_proxy"])).trim() !== previous)
    throw new Error(
      "A proxy anterior não foi restaurada. Confira a configuração de rede da instância.",
    );
  console.log(
    JSON.stringify(
      {
        deviceId,
        endpoint: report.endpoint,
        systemProxyApplied: true,
        androidToGatewayToProxy: true,
        proxyFailureReturned502: true,
        previousProxyRestored: true,
        scope:
          "Somente HTTP explícito via gateway e servidores locais simulados. Não testa aplicativos, IP externo, DNS real ou bloqueio de conexão direta do Android.",
      },
      null,
      2,
    ),
  );
} finally {
  try {
    if (runtime) await runtime.stop();
  } finally {
    gateway?.close();
    for (const socket of sockets) socket.destroy();
    target.close();
    upstream.close();
  }
}
