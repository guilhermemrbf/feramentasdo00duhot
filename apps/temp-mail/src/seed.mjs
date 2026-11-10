import { readConfig } from "./config.mjs";
import { db, passwordHash } from "./core.mjs";

const config = readConfig();
try {
  if (config.DEFAULT_MAIL_DOMAIN) {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(962014)) AS domain_lock`;
      const hasDefault = await tx.domain.count({ where: { isDefault: true } });
      await tx.domain.upsert({
        where: { domain: config.DEFAULT_MAIL_DOMAIN },
        update: {},
        create: { domain: config.DEFAULT_MAIL_DOMAIN, isDefault: !hasDefault, status: "active" },
      });
    });
    console.info("Domínio inicial verificado.");
  }
  if (Boolean(config.ADMIN_EMAIL) !== Boolean(config.ADMIN_PASSWORD)) {
    throw new Error("Forneça ADMIN_EMAIL e ADMIN_PASSWORD juntos para criar o administrador.");
  }
  if (config.ADMIN_EMAIL) {
    const email = config.ADMIN_EMAIL.toLowerCase();
    const existing = await db.adminUser.findUnique({ where: { email }, select: { id: true } });
    if (!existing) {
      await db.adminUser.create({ data: { email, passwordHash: await passwordHash(config.ADMIN_PASSWORD) } });
    }
    console.info("Administrador inicial verificado.");
  }
} finally {
  await db.$disconnect();
}
