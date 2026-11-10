import { createServer } from "node:net";
import { pathToFileURL } from "node:url";
import { SMTPServer } from "smtp-server";
import { normalizeDomain, readConfig } from "./config.mjs";
import { activeMailbox, count, db, lockMailbox, recipient, redisClient, sha256 } from "./core.mjs";

class SmtpError extends Error {
  constructor(responseCode, message) {
    super(message);
    this.responseCode = responseCode;
  }
}

export async function storeIncoming(client, config, to, from, raw) {
  if (raw.length > config.MAX_MESSAGE_SIZE) throw new SmtpError(552, "Message too large");
  const accepted = await recipient(client, to);
  if (!accepted) throw new SmtpError(550, "Recipient unavailable");
  const fingerprint = sha256(Buffer.concat([Buffer.from(from + "\0"), raw]));
  await client.$transaction(async (tx) => {
    if (!(await lockMailbox(tx, accepted.id))) throw new SmtpError(550, "Recipient unavailable");
    const active = await tx.mailbox.findFirst({
      where: { id: accepted.id, ...activeMailbox(), domain: { status: "active" } }, select: { id: true },
    });
    if (!active) throw new SmtpError(550, "Recipient unavailable");
    if (await tx.intake.count({ where: { mailboxId: active.id, fingerprint } })) return;
    const quota = await tx.intake.aggregate({
      where: { mailboxId: active.id }, _count: true, _sum: { sizeBytes: true },
    });
    if (quota._count >= config.MAX_MAILBOX_MESSAGES ||
      (quota._sum.sizeBytes ?? 0) + raw.length > config.MAX_MAILBOX_BYTES) {
      throw new SmtpError(552, "Recipient quota exceeded");
    }
    await tx.intake.create({
      data: { mailboxId: active.id, fingerprint, raw, envelopeFrom: from.slice(0, 512), sizeBytes: raw.length },
    });
    await count(tx, "messages_received");
    await count(tx, "bytes_received", raw.length);
  });
}

export function decodeMapRequest(value) {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(value);
  const match = /^(\d{1,4}):/u.exec(input.subarray(0, 5).toString("ascii"));
  if (!match) return input.length > 5 ? false : null;
  const end = match[0].length + Number(match[1]);
  if (end > 1024) return false;
  if (input.length <= end) return null;
  if (input[end] !== 44 || input.length !== end + 1) return false;
  return input.subarray(match[0].length, end).toString("utf8");
}
export async function mapAnswer(client, request) {
  const separator = request.indexOf(" ");
  const kind = request.slice(0, separator);
  const key = request.slice(separator + 1);
  if (kind === "domains") {
    const domain = normalizeDomain(key);
    return domain && await client.domain.count({ where: { domain, status: "active" } }) ? "OK 1" : "NOTFOUND ";
  }
  if (kind === "recipients") return await recipient(client, key) ? "OK 1" : "NOTFOUND ";
  return "PERM Unknown map";
}

export function buildSmtp(config, client = db) {
  const smtp = new SMTPServer({
    authOptional: true, disabledCommands: ["AUTH", "STARTTLS"],
    maxClients: 32, socketTimeout: 30_000, size: config.MAX_MESSAGE_SIZE, logger: false,
    onRcptTo(address, session, callback) {
      if (session.envelope.rcptTo.length) return callback(new SmtpError(452, "One recipient per transaction"));
      recipient(client, address.address).then(
        (box) => callback(box ? undefined : new SmtpError(550, "Recipient unavailable")),
        () => callback(new SmtpError(451, "Recipient lookup unavailable")),
      );
    },
    onData(stream, session, callback) {
      const chunks = [];
      let length = 0;
      let broken = false;
      stream.on("data", (chunk) => {
        length += chunk.length;
        if (length <= config.MAX_MESSAGE_SIZE) chunks.push(chunk);
      });
      stream.once("error", () => {
        broken = true;
        callback(new SmtpError(451, "Message stream unavailable"));
      });
      stream.once("end", async () => {
        if (broken) return;
        if (stream.sizeExceeded || length > config.MAX_MESSAGE_SIZE) return callback(new SmtpError(552, "Message too large"));
        try {
          await storeIncoming(client, config, session.envelope.rcptTo[0].address,
            session.envelope.mailFrom?.address ?? "", Buffer.concat(chunks));
          callback(null, "Stored");
        } catch (error) {
          callback(error instanceof SmtpError ? error : new SmtpError(451, "Storage temporarily unavailable"));
        }
      });
    },
  });
  // Postfix opens one connection and can reuse it for subsequent lookups.
  const map = createServer((socket) => {
    socket.setEncoding("utf8");
    socket.setTimeout(20_000, () => socket.end());
    let input = Buffer.alloc(0);
    socket.on("error", () => {});
    socket.on("data", (chunk) => {
      if (input.length + chunk.length > 1025) return socket.destroy();
      input = Buffer.concat([input, chunk]);
      const decoded = decodeMapRequest(input);
      if (decoded === false) return socket.end("18:PERM Invalid query,");
      if (decoded === null) return;
      input = Buffer.alloc(0);
      socket.pause();
      mapAnswer(client, decoded).catch(() => "TEMP Lookup unavailable").then((response) => {
        if (socket.destroyed) return;
        socket.write(Buffer.byteLength(response) + ":" + response + ",");
        socket.resume();
      });
    });
  });
  map.maxConnections = 100;
  return { smtp, map };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = readConfig();
  await db.$connect();
  const { smtp, map } = buildSmtp(config);
  smtp.on("error", (error) => console.error("mail_smtp_failure", error.code ?? error.name));
  const redis = redisClient(config);
  redis.on("error", () => {});
  const heartbeat = () => redis.set("mail:heartbeat:smtp", "1", "EX", 45).catch(() => {});
  smtp.listen(config.SMTP_INTERNAL_PORT, config.SMTP_BIND, () => void heartbeat());
  map.listen(config.SMTP_MAP_PORT, config.SMTP_BIND);
  const timer = setInterval(heartbeat, 15_000);
  for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => {
    clearInterval(timer);
    map.close();
    smtp.close(() => {
      redis.disconnect();
      void db.$disconnect();
    });
  });
}
