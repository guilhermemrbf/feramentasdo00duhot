import http from "node:http";
import net from "node:net";
import tls from "node:tls";

function socketReady(socket, event = "connect") {
  return new Promise((resolve, reject) => {
    socket.setTimeout(12000, () => socket.destroy(new Error("Tempo de conexão excedido.")));
    socket.once("error", reject);
    socket.once(event, () => {
      socket.removeListener("error", reject);
      resolve(socket);
    });
  });
}
function reader(socket) {
  let buffer = Buffer.alloc(0);
  let waiting;
  let failed;
  const pump = () => {
    if (!waiting) return;
    if (failed) {
      const next = waiting;
      waiting = null;
      next.reject(failed);
      return;
    }
    const size = waiting.length || buffer.indexOf("\r\n\r\n") + 4;
    if ((!waiting.length && size < 4) || buffer.length < size) return;
    const result = buffer.subarray(0, size);
    buffer = buffer.subarray(size);
    const next = waiting;
    waiting = null;
    next.resolve(result);
  };
  const onData = (data) => {
    buffer = Buffer.concat([buffer, data]);
    if (buffer.length > 65536) failed = new Error("Resposta do proxy excedeu o limite.");
    pump();
  };
  const onError = (error) => {
    failed = error;
    pump();
  };
  const onEnd = () => onError(new Error("O proxy encerrou a conexão."));
  socket.on("data", onData);
  socket.on("error", onError);
  socket.on("end", onEnd);
  return {
    read(length = 0) {
      return new Promise((resolve, reject) => {
        waiting = { length, resolve, reject };
        pump();
      });
    },
    release() {
      socket.pause();
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("end", onEnd);
      if (buffer.length) socket.unshift(buffer);
    },
  };
}
export async function tunnel(proxy, host, port) {
  const socket =
    proxy.protocol === "https"
      ? tls.connect({
          host: proxy.host,
          port: proxy.port,
          servername: net.isIP(proxy.host) ? undefined : proxy.host,
        })
      : net.connect(proxy.port, proxy.host);
  try {
    await socketReady(socket, proxy.protocol === "https" ? "secureConnect" : "connect");
    const input = reader(socket);
    if (proxy.protocol === "socks5") {
      socket.write(Buffer.from([5, 1, proxy.username ? 2 : 0]));
      const greeting = await input.read(2);
      if (greeting[0] !== 5 || ![0, 2].includes(greeting[1]))
        throw new Error("O proxy SOCKS5 recusou a autenticação.");
      if (greeting[1] === 2) {
        const user = Buffer.from(proxy.username),
          password = Buffer.from(proxy.password);
        if (user.length > 255 || password.length > 255)
          throw new Error("Credenciais SOCKS5 excedem 255 bytes.");
        socket.write(
          Buffer.concat([
            Buffer.from([1, user.length]),
            user,
            Buffer.from([password.length]),
            password,
          ]),
        );
        if ((await input.read(2))[1] !== 0)
          throw new Error("Usuário ou senha do proxy foram recusados.");
      }
      const address = Buffer.from(host);
      if (address.length > 255) throw new Error("Destino inválido.");
      socket.write(
        Buffer.concat([
          Buffer.from([5, 1, 0, 3, address.length]),
          address,
          Buffer.from([port >> 8, port & 255]),
        ]),
      );
      const response = await input.read(4);
      if (response[1] !== 0) throw new Error("O proxy SOCKS5 não conseguiu conectar ao destino.");
      const length =
        response[3] === 1
          ? 4
          : response[3] === 4
            ? 16
            : response[3] === 3
              ? (await input.read(1))[0]
              : 0;
      if (!length) throw new Error("Resposta SOCKS5 inválida.");
      await input.read(length + 2);
    } else {
      const target = `${net.isIP(host) === 6 ? `[${host}]` : host}:${port}`;
      const auth = proxy.username
        ? `Proxy-Authorization: Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString("base64")}\r\n`
        : "";
      socket.write(
        `CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n${auth}Connection: keep-alive\r\n\r\n`,
      );
      const response = (await input.read()).toString("latin1");
      if (!/^HTTP\/1\.[01] 200\b/.test(response))
        throw new Error(
          response.includes(" 407 ")
            ? "Usuário ou senha do proxy foram recusados."
            : "O proxy não aceitou a conexão ao destino.",
        );
    }
    input.release();
    socket.setTimeout(0);
    return socket;
  } catch (error) {
    socket.destroy();
    throw error;
  }
}

export async function checkProxy(proxy) {
  const started = Date.now();
  const socket = await tunnel(proxy, "example.com", 443);
  socket.destroy();
  return {
    ok: true,
    latency: Date.now() - started,
    checkedAt: new Date().toISOString(),
    message:
      "Proxy aceitou um túnel para example.com:443. Isso não verifica reputação ou localização do IP.",
  };
}

export async function createGateway(proxy) {
  const sockets = new Set();
  const track = (socket) => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.once("close", () => sockets.delete(socket));
    return socket;
  };
  const server = http.createServer(async (request, response) => {
    let upstream;
    try {
      const url = new URL(request.url);
      if (url.protocol !== "http:" || url.username || url.password)
        throw new Error("Destino HTTP inválido.");
      upstream = track(await tunnel(proxy, url.hostname, Number(url.port || 80)));
      const headers = { ...request.headers, host: url.host, connection: "close" };
      delete headers["proxy-authorization"];
      delete headers["proxy-connection"];
      const outgoing = http.request(
        {
          hostname: url.hostname,
          port: Number(url.port || 80),
          method: request.method,
          path: url.pathname + url.search,
          headers,
          createConnection: () => upstream,
        },
        (incoming) => {
          response.writeHead(incoming.statusCode || 502, incoming.headers);
          incoming.pipe(response);
        },
      );
      outgoing.on("socket", (socket) => socket.resume());
      outgoing.on("error", () => {
        if (!response.headersSent) response.writeHead(502);
        response.end("O proxy não conseguiu conectar.");
        upstream?.destroy();
      });
      request.pipe(outgoing);
      request.on("aborted", () => outgoing.destroy());
    } catch {
      upstream?.destroy();
      response.writeHead(502);
      response.end("O proxy não conseguiu conectar.");
    }
  });
  server.on("connection", track);
  server.on("connect", async (request, client, head) => {
    try {
      const destination = new URL(`http://${request.url}`);
      const port = Number(destination.port || 443);
      if (
        !destination.hostname ||
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535 ||
        destination.username ||
        destination.password
      )
        throw new Error("Destino inválido.");
      const upstream = track(
        await tunnel(proxy, destination.hostname.replace(/^\[|\]$/g, ""), port),
      );
      if (client.destroyed) {
        upstream.destroy();
        return;
      }
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      client.pipe(upstream).pipe(client);
      upstream.on("error", () => client.destroy());
      client.on("error", () => upstream.destroy());
      client.on("close", () => upstream.destroy());
      upstream.on("close", () => client.destroy());
    } catch {
      client.end("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    port: server.address().port,
    close() {
      for (const socket of sockets) socket.destroy();
      server.close();
    },
  };
}
