import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, randomLocalPart } from "../src/core.mjs";
import { eventually, mailFixture, sendMail } from "./fixtures.mjs";

const origin = process.env.TEST_BASE_URL ?? "http://localhost:8080";
const domain = process.env.TEST_MAIL_DOMAIN ?? "mail.test";
const input = (path, { method = "GET", cookie, body, customOrigin = origin, signal } = {}) => fetch(origin + "/api" + path, {
  method, signal, headers: {
    ...(cookie ? { cookie } : {}),
    ...(method === "GET" ? {} : { origin: customOrigin, "x-mail-action": "1" }),
    ...(body ? { "content-type": "application/json" } : {}),
  }, body: body ? JSON.stringify(body) : undefined,
});
async function create(cookie) {
  const response = await input("/mailboxes", { method: "POST", cookie, body: {} });
  assert.equal(response.status, 201, await response.clone().text());
  assert.match(response.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/u);
  return { cookie: response.headers.get("set-cookie").split(";")[0], box: await response.json() };
}

test("Postfix → ingestão durável → BullMQ → PostgreSQL → SSE; isolamento, exclusão e expiração", { timeout: 115_000 }, async () => {
  let a;
  let b;
  let events;
  const controller = new AbortController();
  try {
    const health = await input("/health/ready");
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { database: true, redis: true });
    assert.equal((await input("/mailboxes", { method: "POST", body: {}, customOrigin: "https://other.test" })).status, 403);
    assert.equal((await input("/admin/dashboard")).status, 401);
    assert.equal((await input("/mailboxes/current", { cookie: "mailbox=" + "X".repeat(43) })).status, 404);
    assert.equal((await input("/events", { cookie: "mailbox=" + "X".repeat(43) })).status, 404);
    assert.equal(await sendMail(randomLocalPart() + "@" + domain, null), 550);
    assert.ok([450, 454, 550, 554].includes(await sendMail("nobody@external.example", null)));
    a = await create();
    b = await create();
    assert.notEqual(a.box.address, b.box.address);
    assert.equal((await input("/mailboxes/current", { cookie: a.cookie })).status, 200);
    assert.ok(await db.mailbox.findFirst({ where: { id: a.box.id, accessTokenHash: { not: null } } }));
    events = await input("/events", { cookie: a.cookie, signal: controller.signal });
    assert.equal(events.status, 200);
    const reader = events.body.getReader();
    const next = () => Promise.race([reader.read(), new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout SSE")), 30_000).unref();
    })]);
    assert.match(new TextDecoder().decode((await next()).value), /event: ready/u);
    const key = randomUUID();
    assert.equal(await sendMail(a.box.address, mailFixture(a.box.address, "SMTP completo", key)), 250);
    let incoming = "";
    while (!incoming.includes("event: changed")) {
      const packet = await next();
      assert.ok(!packet.done);
      incoming += new TextDecoder().decode(packet.value);
    }
    const list = await (await input("/messages", { cookie: a.cookie })).json();
    assert.equal(list.messages.length, 1);
    const message = list.messages[0];
    assert.equal(message.subject, "SMTP completo");
    assert.equal(message.recipient, a.box.address);
    const stored = await db.intake.findFirst({ where: { mailboxId: a.box.id } });
    assert.equal(stored.status, "processed");
    assert.equal(stored.raw, null);
    const url = "/messages/" + message.id;
    assert.equal((await input(url, { cookie: b.cookie })).status, 404);
    assert.equal((await input(url, { method: "DELETE", cookie: b.cookie })).status, 404);
    const detail = await (await input(url, { cookie: a.cookie })).json();
    assert.match(detail.htmlBody, /<strong>protegido<\/strong>/u);
    assert.doesNotMatch(detail.htmlBody, /script|tracker|onerror|javascript:/iu);
    assert.equal((await input(url + "/read", { method: "PATCH", cookie: a.cookie })).status, 204);
    assert.equal((await (await input(url, { cookie: a.cookie })).json()).isRead, true);
    assert.equal((await input(url, { method: "DELETE", cookie: a.cookie })).status, 204);
    assert.equal(await sendMail(a.box.address, mailFixture(a.box.address, "Reentrega com mesmo ID", key)), 250);
    await eventually(async () => (await db.intake.count({ where: { mailboxId: a.box.id, status: "processed" } })) >= 2);
    assert.equal(await db.message.count({ where: { mailboxId: a.box.id } }), 0);

    assert.equal(await sendMail(b.box.address, mailFixture(b.box.address, "Para expirar")), 250);
    await eventually(() => db.message.findFirst({ where: { mailboxId: b.box.id } }));
    await db.mailbox.update({ where: { id: b.box.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await input("/messages", { cookie: b.cookie })).status, 404);
    assert.equal(await sendMail(b.box.address, null), 550);
    await eventually(() => db.mailbox.findFirst({ where: { id: b.box.id, status: "expired", address: null } }), 40_000);
    assert.equal(await db.message.count({ where: { mailboxId: b.box.id } }), 0);

    assert.equal((await input("/mailboxes/current", { method: "DELETE", cookie: a.cookie })).status, 204);
    assert.equal((await input("/messages", { cookie: a.cookie })).status, 404);
    assert.equal(await db.intake.count({ where: { mailboxId: a.box.id } }), 0);
    assert.equal(await sendMail(a.box.address, null), 550);
  } finally {
    controller.abort();
    for (const item of [a, b].filter(Boolean)) await input("/mailboxes/current", { method: "DELETE", cookie: item.cookie }).catch(() => {});
    await db.$disconnect();
  }
});

test("admin autenticado, domínios, validade e rate limit de login", { timeout: 20_000 }, async () => {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;
  assert.ok(email && password, "Informe a conta de teste criada pelo seed.");
  const log = await input("/admin/login", { method: "POST", body: { email, password } });
  assert.equal(log.status, 200, await log.clone().text());
  const cookie = log.headers.get("set-cookie").split(";")[0];
  assert.equal((await input("/admin/dashboard", { cookie })).status, 200);
  const domains = await (await input("/admin/domains", { cookie })).json();
  assert.ok(domains.some((item) => item.domain === domain));
  const other = "qa-" + randomUUID().slice(0, 8) + ".test";
  const response = await input("/admin/domains", { method: "POST", cookie, body: { domain: other } });
  assert.equal(response.status, 200);
  const newDomain = await response.json();
  assert.equal(newDomain.status, "disabled");
  assert.equal((await input("/admin/domains/" + newDomain.id, { method: "PATCH", cookie,
    body: { status: "active", isDefault: true } })).status, 200);
  assert.equal((await (await input("/domains")).json())[0].domain, other);
  assert.equal((await input("/admin/domains/" + newDomain.id, { method: "DELETE", cookie })).status, 200);
  const original = await (await input("/admin/dashboard", { cookie })).json();
  const changed = await input("/admin/settings", { method: "POST", cookie, body: { ttlHours: 2 } });
  assert.equal((await changed.json()).ttlHours, 2);
  const probe = await create();
  assert.ok(Math.abs(Date.parse(probe.box.expiresAt) - Date.now() - 7200000) < 20000);
  await input("/mailboxes/current", { method: "DELETE", cookie: probe.cookie });
  await input("/admin/settings", { method: "POST", cookie, body: { ttlHours: original.ttlHours } });
  assert.equal((await input("/admin/logout", { method: "POST", cookie })).status, 204);
  assert.equal((await input("/admin/dashboard", { cookie })).status, 401);
  let limited = false;
  for (let i = 0; i < 6; i++) {
    const failure = await input("/admin/login", { method: "POST", body: { email, password: "wrong-password" } });
    assert.ok([401, 429].includes(failure.status));
    if (failure.status === 429) limited = true;
  }
  assert.ok(limited);
});
