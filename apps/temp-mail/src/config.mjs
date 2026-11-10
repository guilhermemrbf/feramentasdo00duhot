import { domainToASCII } from "node:url";
import { z } from "zod";

export function normalizeDomain(value) {
  const domain = domainToASCII(value.trim().toLowerCase());
  return domain.length <= 253 &&
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(domain)
    ? domain
    : null;
}

const port = z.coerce.number().int().min(1).max(65535);
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//),
  REDIS_URL: z.string().regex(/^rediss?:\/\//).default("redis://127.0.0.1:6379"),
  APP_URL: z.url().default("http://localhost:8080"),
  DEFAULT_MAIL_DOMAIN: z.string().transform(normalizeDomain).optional(),
  MAILBOX_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  MAILBOX_TOKEN_SECRET: z.string().regex(/^[a-f0-9]{64}$/i),
  API_PORT: port.default(3001),
  API_BIND: z.string().default("127.0.0.1"),
  TRUST_PROXY: z.enum(["0", "1"]).default("0"),
  SMTP_BIND: z.string().default("127.0.0.1"),
  SMTP_INTERNAL_PORT: port.default(2525),
  SMTP_MAP_PORT: port.default(10027),
  MAX_MESSAGE_SIZE: z.coerce.number().int().min(1024).max(10_485_760).default(2_097_152),
  MAX_MAILBOX_MESSAGES: z.coerce.number().int().min(1).max(500).default(100),
  MAX_MAILBOX_BYTES: z.coerce.number().int().min(1024).max(104_857_600).default(20_971_520),
  CREATE_PER_HOUR: z.coerce.number().int().min(1).max(100).default(8),
  ABUSE_CONTACT: z.email().optional(),
  ADMIN_EMAIL: z.email().optional(),
  ADMIN_PASSWORD: z.string().min(16).max(256).optional(),
});

export function readConfig(env = process.env) {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error("Configuração inválida: " + result.error.issues.map((issue) => issue.path.join(".")).join(", "));
  }
  const config = result.data;
  const url = new URL(config.APP_URL);
  if (!["http:", "https:"].includes(url.protocol) || url.href !== url.origin + "/") {
    throw new Error("APP_URL deve ser a origem HTTP(S) da aplicação.");
  }
  if (config.DEFAULT_MAIL_DOMAIN === null) throw new Error("DEFAULT_MAIL_DOMAIN inválido.");
  if (config.NODE_ENV === "production" &&
      (url.protocol !== "https:" || !config.ABUSE_CONTACT ||
        config.DEFAULT_MAIL_DOMAIN?.endsWith(".test"))) {
    throw new Error("Produção exige APP_URL HTTPS, ABUSE_CONTACT e domínio real.");
  }
  if (config.MAX_MAILBOX_BYTES < config.MAX_MESSAGE_SIZE) {
    throw new Error("MAX_MAILBOX_BYTES precisa comportar uma mensagem.");
  }
  return { ...config, origin: url.origin, secure: url.protocol === "https:" };
}
