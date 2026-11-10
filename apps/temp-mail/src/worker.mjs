import { Queue, Worker } from "bullmq";
import { pathToFileURL } from "node:url";
import { readConfig } from "./config.mjs";
import { activeMailbox, audit, count, db, lockMailbox, now, purgeMailbox, redisClient } from "./core.mjs";
import { parseMail } from "./mime.mjs";

const queueName = "mail-processing";

export async function processIntake(client, redis, id) {
  const intake = await client.intake.findUnique({ where: { id } });
  if (!intake?.raw || intake.status !== "pending") return;
  const parsed = await parseMail(intake.raw, intake.envelopeFrom, intake.fingerprint);
  const created = await client.$transaction(async (tx) => {
    if (!(await lockMailbox(tx, intake.mailboxId))) return false;
    const box = await tx.mailbox.findFirst({
      where: { id: intake.mailboxId, ...activeMailbox() }, select: { id: true, address: true },
    });
    if (!box) return false;
    const current = await tx.intake.updateMany({
      where: { id, status: "pending" }, data: { status: "processed", raw: null, envelopeFrom: "" },
    });
    if (!current.count) return false;
    const receipt = await tx.messageReceipt.createMany({
      data: [{ mailboxId: box.id, dedupeKey: parsed.dedupeKey }], skipDuplicates: true,
    });
    if (receipt.count) {
      await tx.message.create({
        data: { ...parsed, mailboxId: box.id, recipient: box.address, receivedAt: intake.receivedAt, sizeBytes: intake.sizeBytes },
      });
      await tx.mailbox.update({ where: { id: box.id }, data: { lastActivityAt: now() } });
      await count(tx, "messages_processed");
    } else {
      await count(tx, "messages_deduplicated");
    }
    return Boolean(receipt.count);
  });
  if (created) await redis.publish("mail:events", intake.mailboxId + ":changed").catch(() => {});
}

export async function expireMailboxes(client, redis) {
  const boxes = await client.mailbox.findMany({
    where: { status: "active", expiresAt: { lte: now() } }, orderBy: { expiresAt: "asc" },
    take: 250, select: { id: true },
  });
  for (const { id } of boxes) {
    const purged = await client.$transaction((tx) => purgeMailbox(tx, id, "expired"));
    if (purged) await redis.publish("mail:events", id + ":closed").catch(() => {});
  }
  const cutoff = new Date(Date.now() - 30 * 86_400_000);
  await client.systemLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  await client.mailbox.deleteMany({ where: { status: { not: "active" }, expiresAt: { lt: cutoff } } });
}

export async function startWorker(config, client = db) {
  const connection = redisClient(config, { maxRetriesPerRequest: null });
  const publisher = redisClient(config);
  publisher.on("error", () => {});
  connection.on("error", () => {});
  const queue = new Queue(queueName, { connection });
  queue.on("error", (error) => console.error("mail_queue_failure", error.code ?? error.name));
  const worker = new Worker(queueName, async (job) => {
    if (job.name === "scan") {
      const pending = await client.intake.findMany({
        where: { status: "pending", mailbox: activeMailbox() },
        orderBy: { receivedAt: "asc" }, take: 100, select: { id: true },
      });
      await queue.addBulk(pending.map(({ id }) => ({
        name: "parse", data: { id },
        opts: { jobId: id, attempts: 5, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: true, removeOnFail: true },
      })));
      return;
    }
    if (job.name === "expire") return expireMailboxes(client, publisher);
    if (job.name !== "parse") throw new Error("Unexpected queue job");
    try {
      await processIntake(client, publisher, job.data.id);
    } catch (error) {
      if (job.attemptsMade + 1 >= job.opts.attempts) {
        await client.$transaction(async (tx) => {
          const changed = await tx.intake.updateMany({
            where: { id: job.data.id, status: "pending" }, data: { status: "failed" },
          });
          if (changed.count) {
            await count(tx, "messages_failed");
            await audit(tx, "mime_processing_failed", "worker", "error");
          }
        });
      }
      throw error;
    }
  }, { connection, concurrency: 4, maxStalledCount: 2 });
  worker.on("error", (error) => console.error("mail_worker_failure", error.code ?? error.name));
  worker.on("failed", (_job, error) => console.error("mail_job_failed", error.code ?? error.name));
  const recurring = { opts: { removeOnComplete: true, removeOnFail: true } };
  await queue.upsertJobScheduler("mail-scan", { every: 3000 }, { name: "scan", ...recurring });
  await queue.upsertJobScheduler("mail-expire", { every: 30_000 }, { name: "expire", ...recurring });
  const heartbeat = () => publisher.set("mail:heartbeat:worker", "1", "EX", 45).catch(() => {});
  await heartbeat();
  const timer = setInterval(heartbeat, 15_000);
  return {
    async close() {
      clearInterval(timer);
      await worker.close();
      await queue.close();
      publisher.disconnect();
      connection.disconnect();
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = readConfig();
  await db.$connect();
  const worker = await startWorker(config);
  for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, async () => {
    await worker.close();
    await db.$disconnect();
  });
}
