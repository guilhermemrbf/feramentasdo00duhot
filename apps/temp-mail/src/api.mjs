import Fastify from "fastify";
import swagger from "@fastify/swagger";
import { z } from "zod";
import { pathToFileURL } from "node:url";
import { readConfig, normalizeDomain } from "./config.mjs";
import {
  activeMailbox, audit, count, db, digest, expiresAt, now, purgeMailbox, randomLocalPart,
  rateLimit, redisClient, token, uuid, validToken, verifyPassword,
} from "./core.mjs";

const boxFields = { id: true, address: true, createdAt: true, expiresAt: true };
const messageFields = {
  id: true, sender: true, recipient: true, subject: true, receivedAt: true, sizeBytes: true, isRead: true,
};
const domainFields = { id: true, domain: true, status: true, isDefault: true, updatedAt: true };
const requiredId = z.string().regex(uuid);
const domainInput = z.string().max(253).transform(normalizeDomain).refine(Boolean);
const sessionLifetime = 8 * 3600;
const dummyHash = "0".repeat(32) + ":" + "0".repeat(128);

export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}
const missing = () => new HttpError(404, "Registro indisponível.");
function validate(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, "Dados inválidos.");
  return result.data;
}

export async function buildApi(config, client = db, redis = redisClient(config)) {
  const app = Fastify({
    bodyLimit: 16_384,
    trustProxy: config.TRUST_PROXY === "1" ? 1 : false,
    logger: false,
  });
  await app.register(swagger, {
    openapi: {
      info: { title: "00duHot · E-mail temporário", version: "1.0.0" },
      components: { securitySchemes: {
        mailbox: { type: "apiKey", in: "cookie", name: config.secure ? "__Host-mailbox" : "mailbox" },
        admin: { type: "apiKey", in: "cookie", name: config.secure ? "__Host-mail-admin" : "mail-admin" },
      } },
    },
  });
  const boxCookie = config.secure ? "__Host-mailbox" : "mailbox";
  const adminCookie = config.secure ? "__Host-mail-admin" : "mail-admin";
  function cookieValue(req, name) {
    const value = (req.headers.cookie ?? "").split(/;\s*/u)
      .find((pair) => pair.startsWith(name + "="))?.slice(name.length + 1);
    return validToken(value) ? value : null;
  }
  function setCookie(reply, name, value, age) {
    reply.header("set-cookie", name + "=" + value + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" +
      Math.max(0, Math.floor(age)) + (config.secure ? "; Secure" : ""));
  }
  const hash = (value) => digest(config.MAILBOX_TOKEN_SECRET, value);
  const adminKey = (value) => "mail:admin:" + hash(value);
  const limiter = async (req, bucket, max, seconds) => {
    if (!(await rateLimit(redis, config, req, bucket, max, seconds))) {
      throw new HttpError(429, "Limite de requisições atingido. Tente novamente mais tarde.");
    }
  };
  async function lookupMailbox(req) {
    const value = cookieValue(req, boxCookie);
    return value && client.mailbox.findFirst({
      where: { accessTokenHash: hash(value), ...activeMailbox() }, select: boxFields,
    });
  }
  async function mailbox(req) {
    const box = await lookupMailbox(req);
    if (!box) throw missing();
    return box;
  }
  async function admin(req) {
    const value = cookieValue(req, adminCookie);
    const id = value && await redis.get(adminKey(value));
    const account = id && await client.adminUser.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!account || account.role !== "owner") throw new HttpError(401, "Entre como administrador.");
    return account;
  }
  app.addHook("onRequest", async (req, reply) => {
    reply.header("Cache-Control", "no-store").header("X-Content-Type-Options", "nosniff");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        (req.headers.origin !== config.origin || req.headers["x-mail-action"] !== "1")) {
      throw new HttpError(403, "Origem da solicitação não autorizada.");
    }
  });
  app.setErrorHandler((error, req, reply) => {
    const status = error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 503;
    if (status === 503) console.error("mail_api_failure", error.code ?? error.name);
    if (status === 429) reply.header("Retry-After", "60");
    reply.code(status).send({
      error: error instanceof HttpError ? error.message : status === 503 ? "Serviço temporariamente indisponível." : "Requisição inválida.",
    });
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: "Registro indisponível." }));
  const get = (path, summary, handler, security) => route("GET", path, summary, handler, security);
  function route(method, path, summary, handler, security, requestBody) {
    app.route({
      method, url: "/api" + path,
      schema: {
        summary, tags: [path.split("/")[1]],
        ...(security ? { security: [{ [security]: [] }] } : {}),
        ...(requestBody ? { body: requestBody } : {}),
      },
      handler,
    });
  }
  const domainBody = { type: "object", properties: { domain: { type: "string" } }, additionalProperties: false };
  get("/openapi.json", "Documento OpenAPI", async () => app.swagger());
  get("/health/live", "Verificar o processo HTTP", async () => ({ status: "ok" }));
  const readiness = async (_req, reply) => {
    const checks = await Promise.allSettled([client.$queryRaw`SELECT 1`, redis.ping()]);
    const database = checks[0].status === "fulfilled";
    const cache = checks[1].status === "fulfilled";
    return reply.code(database && cache ? 200 : 503).send({ database, redis: cache });
  };
  get("/health/ready", "Verificar PostgreSQL e Redis", readiness);
  get("/health", "Verificar dependências", readiness);
  get("/info", "Consultar contato de abuso", async () => ({ abuseContact: config.ABUSE_CONTACT ?? null }));
  get("/domains", "Listar domínios ativos", async () => client.domain.findMany({
    where: { status: "active" }, orderBy: [{ isDefault: "desc" }, { domain: "asc" }],
    select: { domain: true, isDefault: true }, take: 100,
  }));

  async function newMailbox(req, reply, renew) {
    await limiter(req, "create", config.CREATE_PER_HOUR, 3600);
    const selected = validate(z.object({ domain: domainInput.optional() }), req.body ?? {});
    const previous = renew ? await mailbox(req) : await lookupMailbox(req);
    if (!renew && previous) return reply.send(previous);
    for (let attempt = 0; attempt < 4; attempt++) {
      const secret = token();
      const localPart = randomLocalPart();
      try {
        const box = await client.$transaction(async (tx) => {
          const domain = await tx.domain.findFirst({
            where: { status: "active", ...(selected.domain ? { domain: selected.domain } : {}) },
            orderBy: [{ isDefault: "desc" }, { domain: "asc" }], select: { domain: true, id: true },
          });
          if (!domain) throw new HttpError(selected.domain ? 400 : 503, "Nenhum domínio selecionado está disponível.");
          if (previous && !(await purgeMailbox(tx, previous.id, "deleted"))) throw missing();
          const settings = await tx.settings.findUnique({ where: { id: 1 } });
          const result = await tx.mailbox.create({
            data: {
              address: localPart + "@" + domain.domain, localPart, domainId: domain.id,
              accessTokenHash: hash(secret), expiresAt: expiresAt(settings?.ttlHours ?? config.MAILBOX_TTL_HOURS),
            },
            select: boxFields,
          });
          await count(tx, "mailboxes_created");
          return result;
        });
        if (previous) await notify(previous.id, "closed");
        setCookie(reply, boxCookie, secret, (box.expiresAt.getTime() - Date.now()) / 1000 + 1);
        return reply.code(201).send(box);
      } catch (error) {
        if (error.code !== "P2002" || attempt === 3) throw error;
      }
    }
  }
  route("POST", "/mailboxes", "Criar ou recuperar a caixa atual", (req, reply) => newMailbox(req, reply, false), null, domainBody);
  get("/mailboxes/current", "Consultar a caixa atual", mailbox, "mailbox");
  route("POST", "/mailboxes/renew", "Substituir e limpar a caixa atual", (req, reply) => newMailbox(req, reply, true), "mailbox", domainBody);
  route("DELETE", "/mailboxes/current", "Excluir a caixa atual", async (req, reply) => {
    const box = await lookupMailbox(req);
    if (box) {
      await client.$transaction((tx) => purgeMailbox(tx, box.id, "deleted"));
      await notify(box.id, "closed");
    }
    setCookie(reply, boxCookie, "", 0);
    return reply.code(204).send();
  }, "mailbox");

  get("/messages", "Listar mensagens em ordem de recebimento", async (req) => {
    const box = await mailbox(req);
    const query = validate(z.object({ before: requiredId.optional() }), req.query);
    const cursor = query.before && await client.message.findFirst({
      where: { id: query.before, mailboxId: box.id }, select: { id: true, receivedAt: true },
    });
    if (query.before && !cursor) throw missing();
    const rows = await client.message.findMany({
      where: { mailboxId: box.id, ...(cursor ? { OR: [
        { receivedAt: { lt: cursor.receivedAt } }, { receivedAt: cursor.receivedAt, id: { lt: cursor.id } },
      ] } : {}) },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }], take: 26, select: messageFields,
    });
    return { messages: rows.slice(0, 25), next: rows.length > 25 ? rows[24].id : null };
  }, "mailbox");
  get("/messages/:id", "Ler uma mensagem da própria caixa", async (req) => {
    const box = await mailbox(req);
    const item = await client.message.findFirst({
      where: { id: validate(requiredId, req.params.id), mailboxId: box.id },
      select: { ...messageFields, textBody: true, htmlBody: true },
    });
    if (!item) throw missing();
    return item;
  }, "mailbox");
  for (const [method, path, summary] of [
    ["PATCH", "/messages/:id/read", "Marcar mensagem como lida"],
    ["DELETE", "/messages/:id", "Excluir uma mensagem"],
  ]) {
    route(method, path, summary, async (req, reply) => {
      const box = await mailbox(req);
      const where = { id: validate(requiredId, req.params.id), mailboxId: box.id };
      const result = method === "PATCH" ? await client.message.updateMany({ where, data: { isRead: true } })
        : await client.message.deleteMany({ where });
      if (!result.count) throw missing();
      await notify(box.id, "changed");
      return reply.code(204).send();
    }, "mailbox");
  }

  const sockets = new Map();
  const ipCounts = new Map();
  let openSockets = 0;
  const subscriber = redis.duplicate();
  subscriber.on("error", () => {});
  redis.on("error", () => {});
  await subscriber.subscribe("mail:events");
  subscriber.on("message", (_channel, payload) => {
    const [id, type] = payload.split(":");
    if (!["changed", "closed"].includes(type)) return;
    for (const connection of sockets.get(id) ?? []) {
      if (type === "closed") connection.end();
      else connection.send("event: changed\ndata: {}\n\n");
    }
  });
  async function notify(id, type) {
    await redis.publish("mail:events", id + ":" + type).catch(() => {});
  }
  get("/events", "Receber alterações da caixa por SSE", async (req, reply) => {
    await limiter(req, "sse", 30, 60);
    const box = await mailbox(req);
    const clients = sockets.get(box.id) ?? new Set();
    if (clients.size >= 3 || (ipCounts.get(req.ip) ?? 0) >= 10 || openSockets >= 1000) {
      throw new HttpError(429, "Limite de conexões em tempo real.");
    }
    reply.hijack();
    const stream = reply.raw;
    stream.writeHead(200, {
      "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no", "Connection": "keep-alive",
    });
    const connection = {
      send(chunk) { if (!stream.destroyed && !stream.write(chunk)) stream.destroy(); },
      end() {
        if (!stream.destroyed) stream.end("event: closed\ndata: {}\n\n");
      },
    };
    clients.add(connection);
    sockets.set(box.id, clients);
    openSockets++;
    ipCounts.set(req.ip, (ipCounts.get(req.ip) ?? 0) + 1);
    const heartbeat = setInterval(async () => {
      try {
        const active = await client.mailbox.count({ where: { id: box.id, ...activeMailbox() } });
        if (active) connection.send(": heartbeat\n\n");
        else connection.end();
      } catch {
        stream.destroy();
      }
    }, 20_000);
    const expiry = setTimeout(() => connection.end(), Math.max(0, box.expiresAt.getTime() - Date.now()));
    stream.once("close", () => {
      clearTimeout(expiry);
      clearInterval(heartbeat);
      clients.delete(connection);
      if (!clients.size) sockets.delete(box.id);
      openSockets--;
      const count = ipCounts.get(req.ip) - 1;
      if (count) ipCounts.set(req.ip, count);
      else ipCounts.delete(req.ip);
    });
    connection.send("retry: 4000\nevent: ready\ndata: {}\n\n");
  }, "mailbox");

  route("POST", "/admin/login", "Iniciar sessão administrativa", async (req, reply) => {
    await limiter(req, "admin-login", 5, 900);
    const input = validate(z.object({ email: z.email().max(254), password: z.string().min(1).max(256) }), req.body);
    const account = await client.adminUser.findUnique({ where: { email: input.email.toLowerCase() } });
    const verified = await verifyPassword(input.password, account?.passwordHash ?? dummyHash);
    if (!account || account.role !== "owner" || !verified) throw new HttpError(401, "Credenciais inválidas.");
    const old = cookieValue(req, adminCookie);
    if (old) await redis.del(adminKey(old));
    const value = token();
    await redis.set(adminKey(value), account.id, "EX", sessionLifetime);
    await audit(client, "admin_login", "api");
    setCookie(reply, adminCookie, value, sessionLifetime);
    return { role: account.role };
  });
  route("POST", "/admin/logout", "Encerrar sessão administrativa", async (req, reply) => {
    const value = cookieValue(req, adminCookie);
    if (value) await redis.del(adminKey(value));
    setCookie(reply, adminCookie, "", 0);
    return reply.code(204).send();
  }, "admin");
  const administrative = (method, path, summary, handler) =>
    route(method, "/admin" + path, summary, async (req, reply) => {
      const owner = await admin(req);
      await limiter(req, "admin", 100, 60);
      return handler(req, reply, owner);
    }, "admin");

  administrative("GET", "/dashboard", "Consultar indicadores e serviços", async () => {
    const [counters, active, domains, pending, failed, redisStatus, worker, smtp, settings] = await Promise.all([
      client.counter.findMany(), client.mailbox.count({ where: activeMailbox() }), client.domain.count(),
      client.intake.count({ where: { status: "pending" } }), client.intake.count({ where: { status: "failed" } }),
      redis.ping(), redis.exists("mail:heartbeat:worker"), redis.exists("mail:heartbeat:smtp"),
      client.settings.findUnique({ where: { id: 1 } }),
    ]);
    return {
      counters: Object.fromEntries(counters.map(({ name, value }) => [name, value.toString()])),
      active, domains, pending, failed, ttlHours: settings?.ttlHours ?? config.MAILBOX_TTL_HOURS,
      services: { database: true, redis: redisStatus === "PONG", worker: Boolean(worker), smtp: Boolean(smtp) },
    };
  });
  administrative("GET", "/domains", "Consultar os domínios", async () => client.domain.findMany({
    orderBy: [{ isDefault: "desc" }, { domain: "asc" }], take: 100, select: domainFields,
  }));
  const domainOptions = z.object({ status: z.enum(["active", "disabled"]).optional(), isDefault: z.boolean().optional() });
  async function updateDomain(req, owner, mode) {
    const input = validate(mode === "create" ? domainOptions.extend({ domain: domainInput }) : domainOptions, req.body ?? {});
    const id = mode === "create" ? null : validate(requiredId, req.params.id);
    try {
      return await client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(962014)) AS domain_lock`;
        const current = id && await tx.domain.findUnique({ where: { id }, select: domainFields });
        if (id && !current) throw missing();
        const status = mode === "delete" ? "disabled" : input.status ?? (current ? current.status : "disabled");
        const isDefault = status === "active" && (input.isDefault ?? (current ? current.isDefault : false));
        if (input.isDefault && status !== "active") throw new HttpError(400, "Ative o domínio antes de defini-lo como padrão.");
        if (isDefault) await tx.domain.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
        if (mode === "create" && await tx.domain.count() >= 100) throw new HttpError(409, "Limite de domínios atingido.");
        if (mode === "create" && config.NODE_ENV === "production" &&
          /\.(?:test|local|invalid|example|localhost)$/u.test(input.domain)) {
          throw new HttpError(400, "Cadastre um domínio público que você controla.");
        }
        const result = mode === "create"
          ? await tx.domain.create({ data: { domain: input.domain, status, isDefault }, select: domainFields })
          : await tx.domain.update({ where: { id }, data: { status, isDefault }, select: domainFields });
        await audit(tx, "domain_" + mode, "admin", "info", { adminId: owner.id, domainId: result.id });
        return result;
      });
    } catch (error) {
      if (error.code === "P2002") throw new HttpError(409, "Domínio já cadastrado.");
      throw error;
    }
  }
  administrative("POST", "/domains", "Cadastrar um domínio", (req, _reply, owner) => updateDomain(req, owner, "create"));
  administrative("PATCH", "/domains/:id", "Alterar status ou domínio padrão", (req, _reply, owner) => updateDomain(req, owner, "update"));
  administrative("DELETE", "/domains/:id", "Retirar um domínio de operação", (req, _reply, owner) => updateDomain(req, owner, "delete"));
  function pageQuery(req, filter = {}) {
    const parsed = validate(z.object({ page: z.coerce.number().int().min(1).max(400).default(1), ...filter }), req.query);
    return { ...parsed, skip: (parsed.page - 1) * 25, take: 26 };
  }
  function page(rows) {
    return { items: rows.slice(0, 25), hasMore: rows.length > 25 };
  }
  administrative("GET", "/mailboxes", "Listar caixas sem dados privados", async (req) => {
    const { status, skip, take } = pageQuery(req, { status: z.enum(["active", "expired", "deleted"]).optional() });
    const date = now();
    const where = status === "expired" ? { OR: [{ status }, { status: "active", expiresAt: { lte: date } }] }
      : status === "active" ? activeMailbox(date) : status ? { status } : {};
    return page(await client.mailbox.findMany({
      where, skip, take, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, status: true, createdAt: true, expiresAt: true, domain: { select: { domain: true } }, _count: { select: { messages: true } } },
    }));
  });
  administrative("DELETE", "/mailboxes/:id", "Excluir uma caixa e auditar", async (req, reply, owner) => {
    const id = validate(requiredId, req.params.id);
    await client.$transaction(async (tx) => {
      if (!(await purgeMailbox(tx, id, "deleted"))) throw missing();
      await audit(tx, "mailbox_deleted", "admin", "info", { adminId: owner.id });
    });
    await notify(id, "closed");
    return reply.code(204).send();
  });
  administrative("GET", "/messages", "Listar processamento, sem conteúdo de mensagens", async (req) => {
    const { skip, take } = pageQuery(req);
    return page(await client.intake.findMany({
      where: { status: { in: ["pending", "failed"] } }, skip, take, orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      select: { id: true, status: true, receivedAt: true },
    }));
  });
  administrative("POST", "/messages/:id/retry", "Reenfileirar processamento com falha", async (req, reply, owner) => {
    const id = validate(requiredId, req.params.id);
    await client.$transaction(async (tx) => {
      const result = await tx.intake.updateMany({
        where: { id, status: "failed", raw: { not: null }, mailbox: activeMailbox() }, data: { status: "pending" },
      });
      if (!result.count) throw missing();
      await audit(tx, "intake_retry", "admin", "info", { adminId: owner.id });
    });
    return reply.code(204).send();
  });
  administrative("GET", "/logs", "Consultar eventos técnicos e auditoria", async (req) => {
    const { skip, take } = pageQuery(req);
    return page(await client.systemLog.findMany({ skip, take, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
  });
  administrative("POST", "/settings", "Ajustar validade das caixas futuras", async (req, _reply, owner) => {
    const data = validate(z.object({ ttlHours: z.number().int().min(1).max(168) }), req.body);
    return client.$transaction(async (tx) => {
      const settings = await tx.settings.upsert({ where: { id: 1 }, create: data, update: data });
      await audit(tx, "settings_updated", "admin", "info", { adminId: owner.id, ttlHours: data.ttlHours });
      return settings;
    });
  });

  app.addHook("preClose", async () => {
    for (const clients of sockets.values()) for (const connection of clients) connection.end();
  });
  app.addHook("onClose", async () => {
    subscriber.disconnect();
    redis.disconnect();
    await client.$disconnect();
  });
  await app.ready();
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = readConfig();
  const app = await buildApi(config);
  await app.listen({ host: config.API_BIND, port: config.API_PORT });
  for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => void app.close());
}
