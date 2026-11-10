import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
const path = new URL("../.env", import.meta.url);
try {
  writeFileSync(path, [
    "POSTGRES_PASSWORD=" + randomBytes(24).toString("hex"),
    "MAILBOX_TOKEN_SECRET=" + randomBytes(32).toString("hex"),
    "APP_URL=http://localhost:8080",
    "DEFAULT_MAIL_DOMAIN=mail.test",
    "SMTP_HOST=mx.mail.test",
    "",
  ].join("\n"), { flag: "wx", mode: 0o600 });
  console.info(".env criado com credenciais locais aleatórias.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.info(".env já existe.");
}
