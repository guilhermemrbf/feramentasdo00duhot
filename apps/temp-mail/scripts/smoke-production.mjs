import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolveMx } from "node:dns/promises";
import { parseArgs } from "node:util";
import nodemailer from "nodemailer";
import { normalizeDomain } from "../src/config.mjs";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { "mx-host": { type: "string" } },
});
if (positionals.length !== 2) {
  throw new Error("Uso: pnpm smoke:production https://correio.seudominio.com temporario.seudominio.com [--mx-host mx.seudominio.com]");
}

const site = new URL(positionals[0]);
const domain = normalizeDomain(positionals[1]);
assert(site.protocol === "https:" && site.href === site.origin + "/", "Informe a origem HTTPS da caixa.");
assert(domain, "Informe o domínio dos endereços temporários.");

const mx = values["mx-host"]
  ? normalizeDomain(values["mx-host"])
  : (await resolveMx(domain)).sort((a, b) => a.priority - b.priority)[0]?.exchange;
assert(mx, "O domínio precisa de um registro MX válido.");
console.log(values["mx-host"] ? "SMTP direcionado ao host de teste." : "DNS público: MX encontrado.");

const user = process.env.MAIL_SMOKE_WEB_USER;
const password = process.env.MAIL_SMOKE_WEB_PASSWORD;
assert(user && password, "Defina MAIL_SMOKE_WEB_USER e MAIL_SMOKE_WEB_PASSWORD no ambiente.");
const authorization = "Basic " + Buffer.from(user + ":" + password).toString("base64");

let cookie;
const events = new AbortController();

function request(path, method = "GET", body, signal = AbortSignal.timeout(12_000)) {
  return fetch(site.origin + "/api" + path, {
    method,
    redirect: "error",
    headers: {
      authorization,
      ...(cookie ? { cookie } : {}),
      ...(method !== "GET" ? { origin: site.origin, "x-mail-action": "1" } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
}

async function* eventNames(body) {
  let pending = "";
  for await (const chunk of body.pipeThrough(new TextDecoderStream())) {
    pending += chunk;
    let end;
    while ((end = pending.indexOf("\n\n")) !== -1) {
      const packet = pending.slice(0, end);
      pending = pending.slice(end + 2);
      const event = packet.match(/^event:\s*(\w+)/m);
      if (event) yield event[1];
    }
    assert(pending.length < 16384, "O stream SSE ultrapassou o limite esperado.");
  }
}

const transport = nodemailer.createTransport({
  host: mx,
  port: 25,
  requireTLS: true,
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 10000,
  tls: { minVersion: "TLSv1.2", servername: mx },
});

try {
  const anonymous = await fetch(site.origin, { redirect: "error", signal: AbortSignal.timeout(8000) });
  assert.equal(anonymous.status, 401, "A página precisa exigir autenticação.");
  assert.match(anonymous.headers.get("www-authenticate") ?? "", /^Basic\b/i);
  const anonymousApi = await fetch(site.origin + "/api/health/ready", {
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  assert.equal(anonymousApi.status, 401, "A API precisa exigir autenticação.");
  console.log("Acesso privado: a interface e a API recusaram visitantes sem credenciais.");

  const ready = await request("/health/ready");
  assert.equal(ready.status, 200, "O serviço HTTPS precisa estar pronto.");
  const created = await request("/mailboxes", "POST", { domain });
  assert.equal(created.status, 201, "A API precisa criar uma caixa de teste.");
  const session = created.headers.get("set-cookie") ?? "";
  if (session.startsWith("__Host-mailbox=")) cookie = session.split(";", 1)[0];
  assert(cookie && /;\s*Secure(?:;|$)/i.test(session) && /;\s*HttpOnly(?:;|$)/i.test(session),
    "A caixa precisa de um cookie HTTPS privado.");
  const { address } = await created.json();
  assert.equal(address?.split("@")[1], domain, "A caixa foi criada no domínio informado.");

  const stream = await request("/events", "GET", undefined,
    AbortSignal.any([events.signal, AbortSignal.timeout(45_000)]));
  assert.equal(stream.status, 200, "O stream SSE precisa estar disponível.");
  assert.match(stream.headers.get("content-type") ?? "", /^text\/event-stream\b/);
  const updates = eventNames(stream.body);
  assert.equal((await updates.next()).value, "ready", "O SSE precisa confirmar a conexão.");

  const subject = "Teste do Correio Temporário " + randomUUID();
  const payload = {
    from: "postmaster@" + site.hostname,
    to: address,
    subject,
    text: subject,
    html: "<p>Entrega SMTP confirmada</p><script>throw new Error('smoke')</script><img src=\"https://example.invalid/pixel\">",
  };
  const sent = await transport.sendMail(payload);
  assert(sent.accepted.includes(address), "O MX precisa aceitar a caixa de teste.");
  console.log("SMTP: porta 25, STARTTLS e aceitação confirmados.");
  assert.equal((await updates.next()).value, "changed", "A entrega precisa chegar pelo SSE.");

  const listed = await request("/messages");
  assert.equal(listed.status, 200);
  const message = (await listed.json()).messages.find((item) => item.subject === subject);
  assert(message, "A caixa precisa listar o e-mail enviado.");
  const opened = await request("/messages/" + encodeURIComponent(message.id));
  assert.equal(opened.status, 200);
  const { textBody, htmlBody } = await opened.json();
  assert(textBody?.includes(subject), "A versão em texto precisa preservar o conteúdo de teste.");
  assert(htmlBody?.includes("Entrega SMTP confirmada") && !/<(?:script|img)\b/i.test(htmlBody),
    "O HTML precisa preservar o texto e remover elementos ativos.");
  console.log("HTTPS e SSE: a mensagem chegou e o conteúdo foi sanitizado.");

  const removed = await request("/mailboxes/current", "DELETE");
  assert.equal(removed.status, 204);
  assert.equal((await request("/mailboxes/current")).status, 404, "A caixa excluída precisa ficar indisponível.");
  cookie = undefined;
  await assert.rejects(transport.sendMail(payload), (error) => error.responseCode === 550,
    "O MX precisa recusar a caixa excluída.");
  console.log("Limpeza: caixa excluída e destinatário rejeitado pelo SMTP.");
} finally {
  events.abort();
  transport.close();
  if (cookie) {
    await request("/mailboxes/current", "DELETE").catch(() => {});
  }
}
