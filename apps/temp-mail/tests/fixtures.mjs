import { createConnection } from "node:net";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";

export function mailFixture(to, subject, messageId = randomUUID()) {
  return [
    "From: Equipe de testes <qa@example.test>",
    "To: " + to,
    "Subject: " + subject,
    "Message-ID: <" + messageId + "@example.test>",
    "Date: Thu, 1 Jan 2026 12:00:00 +0000",
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="mail-test"',
    "",
    "--mail-test",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Mensagem de teste SMTP real.",
    "--mail-test",
    "Content-Type: text/html; charset=utf-8",
    "",
    '<p>Conteudo <strong>protegido</strong></p><script>window.__mailAttack=1</script>',
    '<img src="https://tracker.invalid/pixel" onerror="alert(1)">',
    '<a href="javascript:alert(1)">Link bloqueado</a>',
    "--mail-test--",
    "",
  ].join("\r\n");
}

export async function sendMail(to, raw, options = {}) {
  const socket = createConnection({
    host: options.host ?? process.env.TEST_SMTP_HOST ?? "127.0.0.1",
    port: Number(options.port ?? process.env.TEST_SMTP_PORT ?? 1025),
  });
  socket.setTimeout(10_000, () => socket.destroy(new Error("SMTP timeout")));
  const readline = createInterface({ input: socket });
  const iterator = readline[Symbol.asyncIterator]();
  const read = async () => {
    while (true) {
      const { value, done } = await iterator.next();
      if (done) throw new Error("SMTP encerrou sem resposta.");
      if (/^\d{3} /u.test(value)) return Number(value.slice(0, 3));
    }
  };
  const command = (line) => { socket.write(line + "\r\n"); return read(); };
  try {
    if (await read() !== 220 || await command("EHLO qa.example.test") !== 250 ||
      await command("MAIL FROM:<qa@example.test>") !== 250) throw new Error("Falha no handshake SMTP.");
    const result = await command("RCPT TO:<" + to + ">");
    if (result !== 250 || raw === null) return result;
    if (await command("DATA") !== 354) throw new Error("SMTP não aceitou DATA.");
    return await command(raw.replace(/^\./gmu, "..") + "\r\n.");
  } finally {
    readline.close();
    socket.destroy();
  }
}

export async function eventually(read, timeout = 25_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await read();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error("O estado esperado não apareceu no prazo.");
}
