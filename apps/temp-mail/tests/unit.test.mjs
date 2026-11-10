import test from "node:test";
import { createConnection } from "node:net";
import assert from "node:assert/strict";
import { readConfig, normalizeDomain } from "../src/config.mjs";
import { activeMailbox, digest, expiresAt, normalizeRecipient, passwordHash, randomLocalPart, token, validToken, verifyPassword } from "../src/core.mjs";
import { buildSmtp, decodeMapRequest, mapAnswer, storeIncoming } from "../src/ingest.mjs";
import { parseMail, sanitizeMessageHtml } from "../src/mime.mjs";
import { mailFixture } from "./fixtures.mjs";

test("geração aleatória, formato e unicidade da amostra", () => {
  const values = Array.from({ length: 4000 }, () => randomLocalPart());
  assert.equal(new Set(values).size, 4000);
  assert.ok(values.every((value) => /^caixa-[a-f0-9]{24}$/.test(value)));
});

test("token privado é validado, derivado por segredo e não vem do endereço", () => {
  const value = token();
  assert.ok(validToken(value));
  assert.ok(!validToken("caixa-" + "a".repeat(24)));
  assert.notEqual(digest("segredo1", value), digest("segredo2", value));
  assert.notEqual(digest("segredo1", value), value);
  assert.equal(digest("segredo1", value), digest("segredo1", value));
});

test("prazo é configurável e a consulta exclui o instante exato da expiração", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  const expiry = expiresAt(24, start);
  assert.equal(expiry.toISOString(), "2026-01-02T00:00:00.000Z");
  assert.deepEqual(activeMailbox(expiry), { status: "active", expiresAt: { gt: expiry } });
});

test("produção recusa HTTP, domínio de teste e segredo inválido", () => {
  const env = { NODE_ENV: "production", DATABASE_URL: "postgres://example.test/db",
    MAILBOX_TOKEN_SECRET: "ab".repeat(32), ABUSE_CONTACT: "operador@example.test" };
  assert.throws(() => readConfig({ ...env, APP_URL: "http://mail.example.test" }), /HTTPS/);
  assert.throws(() => readConfig({ ...env, APP_URL: "https://mail.example.test", DEFAULT_MAIL_DOMAIN: "mail.test" }), /domínio real/);
  assert.throws(() => readConfig({ ...env, MAILBOX_TOKEN_SECRET: "short" }), /MAILBOX_TOKEN_SECRET/);
});

test("a senha administrativa é derivada com salt e validada", async () => {
  const value = "test-password-that-is-long";
  const encoded = await passwordHash(value);
  assert.notEqual(encoded, await passwordHash(value));
  assert.ok(await verifyPassword(value, encoded));
  assert.ok(!await verifyPassword(value + "x", encoded));
});

test("normalização e validação de domínio e destinatário", async () => {
  const local = "caixa-" + "A".repeat(24);
  assert.equal(normalizeDomain("CORREIO.Exemplo.com"), "correio.exemplo.com");
  assert.equal(normalizeDomain("https://bad.com"), null);
  assert.equal(normalizeRecipient(local + "@MAIL.TEST"), local.toLowerCase() + "@mail.test");
  assert.equal(normalizeRecipient(local + "+tag@mail.test"), null);
  assert.equal(await mapAnswer({}, "recipients @mail.test"), "NOTFOUND ");
  assert.equal(await mapAnswer({}, "random mail.test"), "PERM Unknown map");
});

test("socketmap aceita netstring completa e rejeita dados malformados", () => {
  assert.equal(decodeMapRequest("12:domains mail,"), "domains mail");
  assert.equal(decodeMapRequest("12:domains"), null);
  assert.equal(decodeMapRequest("12:domains mail;"), false);
});

test("MIME multipart preserva conteúdo útil e bloqueia HTML malicioso", async () => {
  const to = randomLocalPart() + "@mail.test";
  const item = await parseMail(Buffer.from(mailFixture(to, "Teste real", "abc")), "qa@example.test", "raw");
  assert.equal(item.subject, "Teste real");
  assert.equal(item.messageId, "<abc@example.test>");
  assert.equal(item.sentAt.toISOString(), "2026-01-01T12:00:00.000Z");
  assert.match(item.sender, /Equipe de testes/u);
  assert.match(item.textBody, /SMTP real/u);
  assert.match(item.htmlBody, /<strong>protegido<\/strong>/u);
  assert.doesNotMatch(item.htmlBody, /<img|<script|javascript:|onerror|tracker|href=/iu);
  assert.equal(sanitizeMessageHtml('<iframe>externo</iframe><p onclick="x">oi</p>'), "<p>oi</p>");
});

test("ingestão rejeita mensagens grandes e destinatário desconhecido antes de gravar", async () => {
  const to = randomLocalPart() + "@mail.test";
  const client = { mailbox: { findFirst: async () => null } };
  await assert.rejects(storeIncoming(client, { MAX_MESSAGE_SIZE: 1024 }, to, "", Buffer.alloc(1025)), { responseCode: 552 });
  await assert.rejects(storeIncoming(client, { MAX_MESSAGE_SIZE: 1024 }, to, "", Buffer.alloc(10)), { responseCode: 550 });
});

test("socketmap lê e responde pelo socket TCP com o comprimento em bytes", async () => {
  const { map } = buildSmtp({ MAX_MESSAGE_SIZE: 1024 }, { domain: { count: async () => 1 } });
  try {
    await new Promise((resolve) => map.listen(0, "127.0.0.1", resolve));
    const port = map.address().port;
    const result = await new Promise((resolve, reject) => {
      const socket = createConnection({ host: "127.0.0.1", port }, () => {
        const payload = "domains mês.example";
        socket.write(Buffer.byteLength(payload) + ":" + payload + ",");
      });
      socket.setTimeout(2000, () => socket.destroy(new Error("Socketmap timeout")));
      socket.once("error", reject);
      socket.once("data", (data) => {
        socket.destroy();
        resolve(data.toString());
      });
    });
    assert.equal(result, "4:OK 1,");
  } finally {
    await new Promise((resolve) => map.close(resolve));
  }
});
