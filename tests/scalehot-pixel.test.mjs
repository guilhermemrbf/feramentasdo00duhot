import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  buildPurchase,
  parseMetaClick,
  parseSyncpayTransaction,
  unseal,
  seal,
  verifySyncpay,
} from "../src/lib/meta-ads/contract.ts";

const now = Date.parse("2026-11-23T15:00:00Z");
const reference = "f0c93a71-2d64-4b8e-9a10-5c7e3b21d908";
const event = {
  event: "transaction.updated",
  occurred_at: "2026-11-23T14:55:00Z",
  transaction: {
    reference_id: reference,
    status: "completed",
    origin: "checkout",
    currency: "BRL",
    amount: 349.9,
    net_amount: 327.61,
  },
};

test("validates the official Syncpay signature on the original bytes", async () => {
  const timestamp = Math.floor(now / 1000);
  const body = JSON.stringify(event, null, 2);
  const signature = createHmac("sha256", "secret")
    .update(timestamp + "." + body)
    .digest("hex");
  const header = "t=" + timestamp + ",v1=" + signature;
  assert.equal(await verifySyncpay(header, new TextEncoder().encode(body), "secret", now), true);
  assert.equal(
    await verifySyncpay(header, new TextEncoder().encode(body + " "), "secret", now),
    false,
  );
  assert.equal(
    await verifySyncpay(header, new TextEncoder().encode(body), "secret", now + 301000),
    false,
  );
});

test("extracts a confirmed BRL payment, skips pending and treats refunds separately", () => {
  assert.equal(
    parseSyncpayTransaction(
      { ...event, transaction: { ...event.transaction, origin: "cashout" } },
      now,
    ),
    null,
  );
  assert.deepEqual(parseSyncpayTransaction(event, now), {
    reference,
    type: "cashin",
    amount: 349.9,
    net: 327.61,
    occurredAt: "2026-11-23T14:55:00.000Z",
  });
  assert.equal(
    parseSyncpayTransaction(
      { ...event, transaction: { ...event.transaction, status: "pending" } },
      now,
    ),
    null,
  );
  assert.equal(
    parseSyncpayTransaction(
      { ...event, transaction: { ...event.transaction, currency: "USD" } },
      now,
    ),
    null,
  );
  assert.equal(
    parseSyncpayTransaction(
      { ...event, transaction: { ...event.transaction, status: "refunded" } },
      now,
    ).type,
    "refund",
  );
  assert.equal(
    parseSyncpayTransaction({ ...event, transaction: { ...event.transaction, status: "med" } }, now)
      .type,
    "dispute",
  );
});

test("accepts consented Meta campaign metadata on the configured origin", () => {
  const params =
    "?utm_source=meta&mh_campaign_id=253&mh_adset_id=827&mh_ad_id=447&fbclid=click1&email=test%40example.test";
  const url = "https://loja.example/oferta" + params;
  assert.deepEqual(parseMetaClick(url, "https://loja.example", true, now), {
    campaign: "253",
    adset: "827",
    ad: "447",
    fbc: "fb.1." + now + ".click1",
  });
  assert.equal(parseMetaClick(url, "https://other.example", true, now), null);
  assert.equal(parseMetaClick(url, "https://loja.example", false, now), null);
  assert.equal(parseMetaClick(url + "&mh_ad_id=333", "https://loja.example", true, now), null);
});

test("builds a stable Purchase without customer PII and rejects absent click ID", () => {
  const item = {
    id: reference,
    paid_at: event.occurred_at,
    source_url: "https://loja.example/checkout",
    fbc: "fb.1.1795445000000.click1",
    amount: 349.9,
  };
  assert.deepEqual(buildPurchase(item, now), {
    event_name: "Purchase",
    event_id: reference,
    event_time: 1795445700,
    action_source: "website",
    event_source_url: item.source_url,
    user_data: { fbc: item.fbc },
    custom_data: { currency: "BRL", value: 349.9 },
  });
  assert.equal(buildPurchase({ ...item, fbc: null }, now), null);
  assert.equal(buildPurchase(item, now + 8 * 86400000), null);
});

test("encryption ties keys to connection and purpose", async () => {
  const key = crypto.getRandomValues(new Uint8Array(32));
  const ciphertext = await seal("private-token", key, "connection:meta");
  assert.notEqual(ciphertext, "private-token");
  assert.equal(await unseal(ciphertext, key, "connection:meta"), "private-token");
  await assert.rejects(unseal(ciphertext, key, "connection:syncpay"));
});
