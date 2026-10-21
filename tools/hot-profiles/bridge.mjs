import http from "node:http";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { createStore, fail, uuid } from "./storage.mjs";
import { findBrowser, startBrowser } from "./browser.mjs";
import { discoverAndroid, openAndroidManager, startAndroid } from "./android.mjs";
import { createGateway, checkProxy } from "./proxy.mjs";

if (Number(process.versions.node.split(".")[0]) < 22)
  throw new Error("Hot Profiles precisa de Node.js 22 ou superior.");
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const port = Number(argument("--port") || 47900);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Porta inválida.");
const directory = path.resolve(
  argument("--data-dir") ||
    path.join(process.env.LOCALAPPDATA || os.homedir(), "00duHot", "HotProfiles"),
);
const origins = new Set([
  "https://feramentasdo00duhot.lovable.app",
  "http://127.0.0.1:8081",
  "http://localhost:8081",
  "http://127.0.0.1:8080",
  "http://localhost:8080",
]);
const additionalOrigin = argument("--allow-origin");
if (additionalOrigin) {
  const origin = new URL(additionalOrigin);
  if (origin.origin !== additionalOrigin || !["https:", "http:"].includes(origin.protocol))
    throw new Error("Informe uma origem exata, sem caminho.");
  origins.add(origin.origin);
}
const store = await createStore(directory);
const token = randomBytes(32).toString("base64url");
let pairCode = String(randomInt(100000, 1000000));
let pairExpires = Date.now() + 15 * 60 * 1000;
let attempts = [];
const sessions = new Map();
let shuttingDown = false;
const equal = (a, b) => {
  if (typeof a !== "string") return false;
  const first = Buffer.from(a),
    second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
};
const sessionInfo = (session) => ({
  profileId: session.profile.id,
  kind: session.profile.kind,
  name: session.profile.name,
  status: session.status,
  startedAt: session.startedAt,
  error: session.error || null,
  needsCleanup: session.status === "error" && !!session.runtime,
});
const active = (id) => {
  const session = sessions.get(id);
  return (
    !!session &&
    (["starting", "running", "stopping"].includes(session.status) ||
      (session.status === "error" && !!session.runtime))
  );
};
const publicState = () => ({
  profiles: store.data.profiles,
  proxies: store.data.proxies.map(store.publicProxy),
  sessions: [...sessions.values()].map(sessionInfo),
  activities: store.data.activities,
});
async function body(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32768) fail("Envio excede 32 KB.", 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || "{}");
  } catch {
    fail("O conteúdo enviado não é válido.");
  }
}
function send(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}
async function stopSession(session) {
  if (!session || session.status === "stopped") return;
  if (session.status === "starting") {
    session.cancelled = true;
    session.abort.abort();
    return;
  }
  session.status = "stopping";
  try {
    await session.runtime?.stop();
    session.runtime = null;
    session.gateway?.close();
    session.status = "stopped";
    session.error = null;
    await store.activity("Sessão encerrada", session.profile);
  } catch (error) {
    session.status = "error";
    session.error = error.message;
    // Preserve a gateway if Android proxy restoration failed; a second stop can retry.
    throw error;
  }
}
async function launch(profile) {
  if ([...sessions.values()].filter((session) => active(session.profile.id)).length >= 8)
    fail(
      "Encerre um ambiente antes de abrir outro. Esta base aceita até oito sessões simultâneas.",
      409,
    );
  if (active(profile.id)) fail("Este perfil já tem uma sessão aberta.", 409);
  if (
    profile.kind === "android" &&
    [...sessions.values()].some(
      (session) => active(session.profile.id) && session.profile.deviceId === profile.deviceId,
    )
  )
    fail("Esta instância Android já está em uso.", 409);
  const session = {
    profile,
    status: "starting",
    startedAt: new Date().toISOString(),
    runtime: null,
    gateway: null,
    cancelled: false,
    control: Promise.resolve(),
    controlCount: 0,
    capturing: false,
    abort: new AbortController(),
    ready: null,
  };
  sessions.set(profile.id, session);
  session.ready = (async () => {
    try {
      const proxy = profile.proxyId ? store.proxy(profile.proxyId) : null;
      if (profile.proxyId && !proxy) fail("O proxy deste perfil não está mais disponível.");
      if (proxy) {
        await checkProxy(proxy);
        session.gateway = await createGateway(proxy);
      }
      session.runtime =
        profile.kind === "browser"
          ? await startBrowser(
              profile,
              directory,
              session.gateway,
              () => {
                if (session.status === "running") {
                  session.status = "stopped";
                  session.gateway?.close();
                }
              },
              session.abort.signal,
            )
          : await startAndroid(profile, session.gateway, session.abort.signal);
      // Android must expose a real screen before its session is ready. Chrome's
      // page compositor may still be loading; its authenticated CDP connection
      // already confirms the process and the viewer retries frames independently.
      if (profile.kind === "android") await session.runtime.frame();
      session.status = "running";
      await store.activity("Sessão iniciada", profile);
      if (session.cancelled || shuttingDown) await stopSession(session);
    } catch (error) {
      try {
        await session.runtime?.stop();
        session.runtime = null;
      } catch {}
      if (!session.runtime) session.gateway?.close();
      session.status = session.cancelled && !session.runtime ? "stopped" : "error";
      session.error =
        session.status === "stopped" ? null : error.message || "Não foi possível iniciar a sessão.";
    }
  })();
  return sessionInfo(session);
}

const server = http.createServer(async (request, response) => {
  try {
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(request.headers.host))
      fail("Endereço do conector não autorizado.", 403);
    const origin = request.headers.origin;
    if (origin && !origins.has(origin))
      fail("Este site não está autorizado a acessar o conector.", 403);
    if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    response.setHeader("Access-Control-Allow-Private-Network", "true");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    if (url.pathname === "/health" && request.method === "GET") {
      send(response, 200, { name: "Hot Profiles", version: 1 });
      return;
    }
    if (url.pathname === "/pair" && request.method === "POST") {
      if (!origin || !origins.has(origin))
        fail("Abra o Hot Profiles para conectar este computador.", 403);
      attempts = attempts.filter((attempt) => attempt > Date.now() - 60000);
      if (attempts.length >= 5) fail("Muitas tentativas. Aguarde um minuto.", 429);
      attempts.push(Date.now());
      const input = await body(request);
      if (Date.now() > pairExpires || !equal(input.code, pairCode))
        fail(
          "Código inválido ou expirado. Use o código atual mostrado na janela do conector.",
          401,
        );
      attempts = [];
      send(response, 200, { token, computer: os.hostname() });
      return;
    }
    const authorization = request.headers.authorization;
    if (!equal(authorization, `Bearer ${token}`)) fail("Conecte este computador novamente.", 401);
    if (shuttingDown) fail("O conector está encerrando.", 503);
    const segments = url.pathname.split("/").filter(Boolean);
    const [version, collection, id, action] = segments;
    if (version !== "v1") fail("Operação não encontrada.", 404);
    const method = request.method;
    if (collection === "state" && method === "GET") {
      send(response, 200, publicState());
      return;
    }
    if (collection === "devices" && method === "GET") {
      send(response, 200, {
        ...(await discoverAndroid()),
        browserAvailable: !!(await findBrowser()),
        computer: os.hostname(),
      });
      return;
    }
    if (collection === "android" && id === "manager" && method === "POST") {
      send(response, 200, await openAndroidManager());
      return;
    }
    if (!["profiles", "proxies", "sessions"].includes(collection) || (id && !uuid(id)))
      fail("Operação não encontrada.", 404);
    if (collection === "profiles") {
      const profile = id ? store.data.profiles.find((item) => item.id === id) : null;
      if (id && !profile) fail("Perfil não encontrado.", 404);
      if (method === "POST" && action === "start") {
        send(response, 202, await launch(profile));
        return;
      }
      if (method === "POST" && action === "stop") {
        await stopSession(sessions.get(id));
        send(response, 200, publicState());
        return;
      }
      if (id && active(id)) fail("Encerre a sessão antes de editar ou excluir este perfil.", 409);
      if ((method === "POST" && !id) || (method === "PATCH" && id && !action)) {
        const input = await body(request);
        if (
          input.kind === "android" &&
          !(await discoverAndroid()).devices.some((device) => device.id === input.deviceId)
        )
          fail("Selecione uma instância Android detectada neste computador.");
        send(response, 200, await store.putProfile(input, id));
        return;
      }
      if (method === "DELETE" && id && !action) {
        await store.remove("profiles", id);
        sessions.delete(id);
        send(response, 200, { ok: true });
        return;
      }
    }
    if (collection === "proxies") {
      if (method === "POST" && action === "check" && id) {
        const proxy = store.proxy(id);
        if (!proxy) fail("Proxy não encontrado.", 404);
        try {
          send(response, 200, await checkProxy(proxy));
        } catch (error) {
          send(response, 200, {
            ok: false,
            message: error.message,
            checkedAt: new Date().toISOString(),
          });
        }
        return;
      }
      if (
        id &&
        [...sessions.values()].some(
          (session) => active(session.profile.id) && session.profile.proxyId === id,
        )
      )
        fail("Este proxy está em uso. Encerre as sessões antes de alterá-lo.", 409);
      if ((method === "POST" && !id) || (method === "PATCH" && id && !action)) {
        send(response, 200, await store.putProxy(await body(request), id));
        return;
      }
      if (method === "DELETE" && id && !action) {
        if (store.data.profiles.some((profile) => profile.proxyId === id))
          fail("Remova este proxy dos perfis antes de excluí-lo.", 409);
        await store.remove("proxies", id);
        send(response, 200, { ok: true });
        return;
      }
    }
    if (collection === "sessions" && id) {
      const session = sessions.get(id);
      if (!session || session.status !== "running") fail("Esta sessão não está em execução.", 409);
      if (method === "GET" && action === "frame") {
        if (session.capturing) fail("A tela está sendo atualizada.", 409);
        session.capturing = true;
        try {
          send(response, 200, await session.runtime.frame());
        } finally {
          session.capturing = false;
        }
        return;
      }
      if (
        action === "tabs" &&
        session.profile.kind === "browser" &&
        ["GET", "POST"].includes(method)
      ) {
        send(
          response,
          200,
          method === "POST"
            ? await session.runtime.addTab((await body(request)).url)
            : await session.runtime.tabs(),
        );
        return;
      }
      if (method === "POST" && action === "control") {
        if (session.controlCount >= 12) fail("Aguarde as ações anteriores terminarem.", 429);
        const input = await body(request);
        session.controlCount++;
        const operation = session.control
          .catch(() => {})
          .then(() => session.runtime.control(input));
        session.control = operation;
        try {
          await operation;
          send(response, 200, { ok: true });
        } finally {
          session.controlCount--;
        }
        return;
      }
    }
    fail("Operação não encontrada.", 404);
  } catch (error) {
    if (!response.headersSent && !response.destroyed)
      send(response, error.status || 500, {
        error:
          error.status || error.message?.startsWith("O ") || error.message?.startsWith("Não ")
            ? error.message
            : "Não foi possível concluir a operação no computador. Confira o conector.",
      });
    else response.end();
  }
});
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? "Já existe um conector nesta porta. Feche-o ou use --port."
      : "Não foi possível abrir o conector local.",
  );
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(
    `\nHOT PROFILES — conector local\n\nEndereço: http://127.0.0.1:${port}\nDados: ${directory}\n\nCódigo de conexão: ${pairCode}\nVálido por 15 minutos. Digite-o apenas no seu painel 00duHot.\n\nMantenha esta janela aberta enquanto usa suas sessões. Ctrl+C para encerrar.\n`,
  );
});
const renewCode = setInterval(
  () => {
    pairCode = String(randomInt(100000, 1000000));
    pairExpires = Date.now() + 15 * 60 * 1000;
    console.log(`Novo código de conexão: ${pairCode} (válido por 15 minutos).`);
  },
  15 * 60 * 1000,
);
renewCode.unref();
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(renewCode);
  server.close();
  const timeout = setTimeout(() => process.exit(1), 15000);
  timeout.unref();
  await Promise.allSettled([...sessions.values()].map(stopSession));
  await Promise.allSettled([...sessions.values()].map((session) => session.ready));
  await store.save();
  clearTimeout(timeout);
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
