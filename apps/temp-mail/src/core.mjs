import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { normalizeDomain } from "./config.mjs";

export const db = new PrismaClient();
export const redisClient = (config, options = {}) => new Redis(config.REDIS_URL, { maxRetriesPerRequest: 2, ...options });
export const now = () => new Date();
export const expiresAt = (hours, date = now()) => new Date(date.getTime() + hours * 3_600_000);
export const sha256 = (data) => createHash("sha256").update(data).digest("hex");
export const token = () => randomBytes(32).toString("base64url");
export const digest = (secret, value) => createHmac("sha256", secret).update(value).digest("hex");
export const validToken = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/u.test(value);
export const randomLocalPart = () => "caixa-" + randomBytes(12).toString("hex");
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function activeMailbox(date = now()) {
  return { status: "active", expiresAt: { gt: date } };
}

export function normalizeRecipient(value) {
  const match = /^(caixa-[0-9a-f]{24})@([^@]+)$/iu.exec(value);
  const domain = match && normalizeDomain(match[2]);
  return domain ? match[1].toLowerCase() + "@" + domain : null;
}

export async function recipient(client, value) {
  const address = normalizeRecipient(value);
  if (!address) return null;
  return client.mailbox.findFirst({
    where: { address, ...activeMailbox(), domain: { status: "active" } },
    select: { id: true, address: true },
  });
}

export async function lockMailbox(tx, id) {
  return (await tx.$queryRaw`SELECT id FROM mailboxes WHERE id = ${id}::uuid FOR UPDATE`).length > 0;
}

export async function count(tx, name, increment = 1) {
  await tx.$executeRaw`INSERT INTO counters (name,value) VALUES (${name}, ${increment}::bigint)
    ON CONFLICT (name) DO UPDATE SET value = counters.value + EXCLUDED.value`;
}

export async function purgeMailbox(tx, id, status) {
  if (!(await lockMailbox(tx, id))) return false;
  const changed = await tx.mailbox.updateMany({
    where: { id, status: "active", ...(status === "expired" ? { expiresAt: { lte: now() } } : {}) },
    data: { status, address: null, localPart: null, accessTokenHash: null },
  });
  if (!changed.count) return false;
  await tx.message.deleteMany({ where: { mailboxId: id } });
  await tx.intake.deleteMany({ where: { mailboxId: id } });
  await tx.messageReceipt.deleteMany({ where: { mailboxId: id } });
  if (status === "expired") await count(tx, "mailboxes_expired");
  return true;
}

const derive = promisify(scrypt);
export async function passwordHash(password, salt = randomBytes(16).toString("hex")) {
  const key = await derive(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return salt + ":" + key.toString("hex");
}
export async function verifyPassword(password, stored) {
  const encoded = await passwordHash(password, stored.split(":")[0]);
  return timingSafeEqual(Buffer.from(encoded), Buffer.from(stored));
}

export async function rateLimit(redis, config, request, bucket, max, seconds) {
  const window = Math.floor(Date.now() / 1000 / seconds);
  const key = "mail:rate:" + bucket + ":" + window + ":" + digest(config.MAILBOX_TOKEN_SECRET, request.ip);
  const used = await redis.eval(
    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n",
    1, key, seconds + 1,
  );
  return used <= max;
}

export async function audit(tx, event, source, severity = "info", metadata = {}) {
  await tx.systemLog.create({ data: { event, severity, source, metadata } });
}
