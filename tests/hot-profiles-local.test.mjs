import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import http from "node:http";
import { createStore, validHost } from "../tools/hot-profiles/storage.mjs";
import { proxyKey, performanceInfo } from "../tools/hot-profiles/policy.mjs";
import { frameCache } from "../tools/hot-profiles/frame-cache.mjs";
import { tunnel, checkProxy, createGateway } from "../tools/hot-profiles/proxy.mjs";
import { parseProxyAddress } from "../src/lib/proxy-input.ts";
const proxy = (extra = {}) => ({
  name: "Projeto A",
  protocol: "http",
  host: "127.0.0.1",
  port: 3128,
  username: "test-user",
  password: "fixture-secret",
  clearPassword: false,
  ...extra,
});
const profile = (extra = {}) => ({
  kind: "browser",
  name: "Ambiente A",
  notes: "",
  tags: [],
  proxyId: null,
  startUrls: [],
  viewport: { width: 1280, height: 800 },
  ...extra,
});
async function storeFor(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "hot-profiles-test-"));
  const store = await createStore(dir);
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  return store;
}
async function listen(t, server) {
  const sockets = new Set();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    for (const socket of sockets) socket.destroy();
    server.close();
  });
  return server.address().port;
}
test("proxy paste handles credentials, defaults and IPv6, without accepting website URLs", () => {
  assert.deepEqual(parseProxyAddress("localhost:8080:user:pass:extra"), {
    protocol: "http",
    host: "localhost",
    port: 8080,
    username: "user",
    password: "pass:extra",
  });
  assert.equal(parseProxyAddress("socks5://user:p%40ss@[::1]:1080").password, "p@ss");
  assert.equal(parseProxyAddress("https://proxy.example").port, 443);
  for (const value of [
    "https://proxy.example/path",
    "https://proxy.example?secret=x",
    "ftp://proxy.example:21",
    "http://user%0A:x@host:80",
    "http://user%3Ax:x@host:80",
  ])
    assert.throws(() => parseProxyAddress(value));
});
test("proxy host validation rejects empty DNS labels and malformed IP addresses", () => {
  for (const value of ["localhost", "proxy.example.com", "127.0.0.1", "::1"])
    assert.equal(validHost(value), true, value);
  for (const value of [
    "a..b",
    "-a.example",
    "a-.example",
    "999.999.1.1",
    "http://proxy.example",
    "a b",
  ])
    assert.equal(validHost(value), false, value);
});
test("proxy passwords are encrypted on disk and never returned to the panel", async (t) => {
  const store = await storeFor(t),
    saved = await store.putProxy(proxy());
  assert.equal(saved.hasPassword, true);
  assert.equal("secret" in saved, false);
  assert.equal("password" in saved, false);
  assert.equal(
    (await readFile(path.join(store.directory, "workspace.json"), "utf8")).includes(
      "fixture-secret",
    ),
    false,
  );
  assert.equal(store.proxy(saved.id).password, "fixture-secret");
  const retained = await store.putProxy(proxy({ password: "" }), saved.id);
  assert.equal(retained.hasPassword, true);
  assert.equal(store.proxy(saved.id).password, "fixture-secret");
  await store.putProxy(proxy({ password: "", clearPassword: true }), saved.id);
  assert.equal(store.proxy(saved.id).password, "");
});
test("proxy endpoint duplicates are rejected, while separate provider usernames are allowed", async (t) => {
  const store = await storeFor(t);
  await store.putProxy(proxy({ host: "Proxy.Example" }));
  await assert.rejects(store.putProxy(proxy({ host: "proxy.example", name: "Outro nome" })), {
    status: 409,
  });
  assert.ok(await store.putProxy(proxy({ host: "proxy.example", username: "another-session" })));
  assert.equal(proxyKey(proxy({ host: "Example.COM" })), proxyKey(proxy({ host: "example.com." })));
});
test("one proxy belongs to one new profile; editing its owner and independent proxies remain valid", async (t) => {
  const store = await storeFor(t),
    first = await store.putProxy(proxy()),
    second = await store.putProxy(proxy({ port: 3129 }));
  const a = await store.putProfile(profile({ proxyId: first.id }));
  await assert.rejects(store.putProfile(profile({ name: "B", proxyId: first.id })), {
    status: 409,
  });
  await store.putProfile(profile({ name: "A editado", proxyId: first.id }), a.id);
  const b = await store.putProfile(profile({ name: "B", proxyId: second.id }));
  await assert.rejects(store.putProfile(profile({ name: "B", proxyId: first.id }), b.id), {
    status: 409,
  });
  await store.putProfile(profile({ proxyId: null }), a.id);
  await store.putProfile(profile({ name: "B", proxyId: first.id }), b.id);
  assert.equal(store.data.profiles.find((p) => p.id === b.id).proxyId, first.id);
});
test("Android instances remain exclusive across profiles", async (t) => {
  const store = await storeFor(t);
  await store.putProfile(profile({ kind: "android", deviceId: "adb:emulator-5554" }));
  await assert.rejects(
    store.putProfile(profile({ kind: "android", deviceId: "adb:emulator-5554" })),
    /já está vinculado/,
  );
});

test("Android endpoint binding persists and blocks aliases across profile IDs", async (t) => {
  const store = await storeFor(t);
  const a = await store.putProfile(profile({ kind: "android", deviceId: "bluestacks:Pie64" }));
  const b = await store.putProfile(profile({ kind: "android", deviceId: "bluestacks:Pie64_4" }));
  const binding = {
    deviceId: a.deviceId,
    endpoint: "127.0.0.1:5555",
    verifiedAt: new Date().toISOString(),
  };
  await store.bindAndroid(a.id, binding);
  await assert.rejects(
    store.bindAndroid(b.id, { ...binding, deviceId: b.deviceId }),
    /já pertence/,
  );
  await assert.rejects(
    store.putProfile(profile({ kind: "android", deviceId: "adb:emulator-5554" })),
    /já está vinculado/,
  );
  await store.putProfile(profile({ kind: "android", deviceId: a.deviceId, name: "Editado" }), a.id);
  const saved = JSON.parse(await readFile(path.join(store.directory, "workspace.json"), "utf8"));
  assert.deepEqual(saved.profiles.find((p) => p.id === a.id).androidBinding, binding);
});

test("local Android serial aliases share one ownership and remote ADB is rejected", async (t) => {
  const store = await storeFor(t);
  const saved = await store.putProfile(profile({ kind: "android", deviceId: "adb:emulator-5554" }));
  assert.equal(saved.deviceId, "adb:127.0.0.1:5555");
  await assert.rejects(
    store.putProfile(profile({ kind: "android", deviceId: "adb:127.0.0.1:5555" })),
    /já está vinculado/,
  );
  await assert.rejects(
    store.putProfile(profile({ kind: "android", deviceId: "adb:10.0.0.2:5555" })),
    /local válido/,
  );
});

test("two gateways keep separate proxy routes and never fall back directly on proxy failure", async (t) => {
  const target = http.createServer((_req, res) => res.end("must-not-connect-directly"));
  let directRequests = 0;
  target.on("request", () => directRequests++);
  const targetPort = await listen(t, target);
  const ports = await Promise.all(
    ["A", "B"].map(async (label) => {
      const upstream = http.createServer();
      upstream.on("connect", (_req, socket) => {
        socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        socket.once("data", () =>
          socket.end(`HTTP/1.1 200 OK\r\nContent-Length: 1\r\nConnection: close\r\n\r\n${label}`),
        );
      });
      return listen(t, upstream);
    }),
  );
  const gateways = await Promise.all(ports.map((port) => createGateway(proxy({ port }))));
  t.after(() => gateways.forEach((g) => g.close()));
  async function request(gateway) {
    return new Promise((resolve, reject) =>
      http
        .get(
          { host: "127.0.0.1", port: gateway.port, path: `http://127.0.0.1:${targetPort}/` },
          (response) => {
            let body = "";
            response.on("data", (chunk) => (body += chunk));
            response.on("end", () => resolve({ status: response.statusCode, body }));
          },
        )
        .on("error", reject),
    );
  }
  assert.deepEqual(await Promise.all(gateways.map(request)), [
    { status: 200, body: "A" },
    { status: 200, body: "B" },
  ]);
  const unavailable = net.createServer();
  const unused = await listen(t, unavailable);
  await new Promise((resolve) => unavailable.close(resolve));
  const failed = await createGateway(proxy({ port: unused }));
  t.after(() => failed.close());
  assert.equal((await request(failed)).status, 502);
  assert.equal(directRequests, 0);
});
test("resource recommendation is conservative, bounded and does not imply Android capacity", () => {
  const fake = {
    totalmem: () => 8 * 1024 ** 3,
    freemem: () => 3 * 1024 ** 3,
    availableParallelism: () => 8,
    platform: () => "win32",
  };
  assert.deepEqual(performanceInfo(undefined, fake), {
    totalGB: 8,
    freeGB: 3,
    cores: 8,
    maxSessions: 3,
    suggested: 3,
    platform: "win32",
  });
  assert.equal(performanceInfo(1, fake).maxSessions, 1);
  assert.equal(performanceInfo(undefined, { ...fake, totalmem: () => 1 * 1024 ** 3 }).suggested, 1);
});
test("concurrent frame requests share work; invalidation, expiry and errors allow a fresh capture", async () => {
  let clock = 0,
    calls = 0,
    complete;
  const cache = frameCache(250, () => clock);
  const capture = () => {
    calls++;
    return new Promise((resolve) => {
      complete = resolve;
    });
  };
  const first = cache.get(capture),
    second = cache.get(capture);
  await Promise.resolve();
  assert.equal(calls, 1);
  complete({ image: "frame1" });
  assert.deepEqual(await first, await second);
  await cache.get(() => assert.fail("cached"));
  clock = 251;
  await cache.get(() => {
    calls++;
    return { image: "frame2" };
  });
  assert.equal(calls, 2);
  cache.clear();
  await assert.rejects(
    cache.get(() => {
      throw new Error("capture failed");
    }),
    /capture failed/,
  );
  assert.deepEqual(await cache.get(() => ({ image: "recovered" })), { image: "recovered" });
});
test("invalidation prevents an in-flight frame from becoming a stale cached result", async () => {
  const cache = frameCache();
  let resolve;
  const pending = cache.get(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await Promise.resolve();
  cache.clear();
  resolve({ image: "old" });
  await pending;
  assert.deepEqual(await cache.get(() => ({ image: "new" })), { image: "new" });
});
test("HTTP proxy verification exercises CONNECT authentication without leaking the secret", async (t) => {
  let auth;
  const server = http.createServer();
  server.on("connect", (request, socket) => {
    auth = request.headers["proxy-authorization"];
    socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
  });
  const port = await listen(t, server);
  const result = await checkProxy(proxy({ port }));
  assert.equal(result.ok, true);
  assert.equal(auth, `Basic ${Buffer.from("test-user:fixture-secret").toString("base64")}`);
  assert.ok(result.checkedAt);
  assert.equal(JSON.stringify(result).includes("fixture-secret"), false);
});
test("proxy authentication failures remain explicit and redact credentials", async (t) => {
  const server = http.createServer();
  server.on("connect", (_request, socket) =>
    socket.end("HTTP/1.1 407 Proxy Authentication Required\r\n\r\n"),
  );
  const port = await listen(t, server);
  await assert.rejects(
    checkProxy(proxy({ port })),
    (error) => /recusados/.test(error.message) && !error.message.includes("fixture-secret"),
  );
});
test("SOCKS5 authenticated handshake and local HTTP gateway preserve tunnel data", async (t) => {
  const server = net.createServer((socket) => {
    let stage = 0;
    socket.on("data", (data) => {
      if (stage === 0) {
        assert.deepEqual([...data], [5, 1, 2]);
        stage++;
        socket.write(Buffer.from([5, 2]));
      } else if (stage === 1) {
        assert.equal(data[0], 1);
        stage++;
        socket.write(Buffer.from([1, 0]));
      } else if (stage === 2) {
        assert.equal(data[0], 5);
        stage++;
        socket.write(Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 80]));
      } else socket.write(data);
    });
  });
  const port = await listen(t, server);
  const socket = await tunnel(proxy({ port, protocol: "socks5" }), "example.com", 443);
  t.after(() => socket.destroy());
  const reply = new Promise((resolve) => socket.once("data", resolve));
  socket.resume();
  socket.write("local-test");
  assert.equal((await reply).toString(), "local-test");
  const gateway = await createGateway(proxy({ port, protocol: "socks5" }));
  t.after(() => gateway.close());
  assert.ok(gateway.port > 0);
});
test("the local gateway routes HTTP through the configured proxy and strips proxy credentials", async (t) => {
  let observed;
  const destination = http.createServer((request, response) => {
    observed = request;
    response.end("proxied-local-response");
  });
  const targetPort = await listen(t, destination);
  const upstream = http.createServer();
  upstream.on("connect", (request, client) => {
    assert.ok(request.headers["proxy-authorization"]);
    const remote = net.connect(targetPort, "127.0.0.1", () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      client.pipe(remote).pipe(client);
    });
    remote.on("error", () => client.destroy());
    client.on("close", () => remote.destroy());
  });
  const upstreamPort = await listen(t, upstream),
    gateway = await createGateway(proxy({ port: upstreamPort }));
  t.after(() => gateway.close());
  const body = await new Promise((resolve, reject) => {
    http
      .get(
        {
          hostname: "127.0.0.1",
          port: gateway.port,
          path: "http://unit.invalid/test-path",
          headers: { "proxy-authorization": "must-not-forward" },
        },
        (response) => {
          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("end", () => resolve(Buffer.concat(chunks).toString()));
        },
      )
      .on("error", reject);
  });
  assert.equal(body, "proxied-local-response");
  assert.equal(observed.url, "/test-path");
  assert.equal(observed.headers["proxy-authorization"], undefined);
});
test("a control invalidation waits for the old capture before starting a fresh one", async () => {
  const cache = frameCache();
  let resolveFirst,
    calls = 0;
  const first = cache.get(() => {
    calls++;
    return new Promise((resolve) => {
      resolveFirst = resolve;
    });
  });
  await Promise.resolve();
  cache.clear();
  const next = cache.get(() => {
    calls++;
    return { image: "after-control" };
  });
  await Promise.resolve();
  assert.equal(calls, 1);
  resolveFirst({ image: "before-control" });
  await first;
  assert.deepEqual(await next, { image: "after-control" });
  assert.equal(calls, 2);
});
