import assert from "node:assert/strict";
import test from "node:test";
import { parseSaleEvent, SALES_CONNECTION_PROVIDERS } from "../src/lib/sales-events.ts";
import { validPushEndpoint } from "../src/lib/sales-push.ts";

test("offers new connections only for the three ScaleHot gateways", () => {
  assert.deepEqual([...SALES_CONNECTION_PROVIDERS], ["omegapay", "syncpay", "wiinpay"]);
});

test("adapts all eight checkout formats with explicit paid states", () => {
  const examples = {
    omegapay: { event: "TRANSACTION_PAID", transaction: { id: "a", amount: 99.9 } },
    syncpay: { data: { idtransaction: "b", status: "COMPLETED", amount: "99.90", client: {} } },
    wiinpay: { event: "payment.approved", data: { id: "c", amount: 99.9 } },
    hotmart: {
      event: "PURCHASE_APPROVED",
      data: { purchase: { transaction: "d", price: { value: 99.9, currency_value: "BRL" } } },
    },
    kiwify: {
      order_status: "paid",
      order_id: "e",
      Commissions: { charge_amount: 9990, currency: "BRL", my_commission: 9000 },
    },
    monetizze: { venda: { codigo: "f", status: "Finalizada", valor: "99.90" } },
    pepper: { event: "approved", transaction_id: "g", amount: 99.9 },
    custom: { status: "approved", transaction_id: "h", currency: "BRL", amount_cents: 9990 },
  };
  for (const [provider, payload] of Object.entries(examples)) {
    const result = parseSaleEvent(provider, payload);
    assert.equal(result.result, "event", provider);
    assert.equal(result.event.kind, "approved");
    assert.equal(result.event.amountCents, 9990);
    assert.equal(result.event.netCents, provider === "kiwify" ? 9000 : null);
  }
});

test("ignores pending, foreign currency and cash-out, rejects missing identifiers", () => {
  assert.equal(
    parseSaleEvent("syncpay", { status: "COMPLETED", type: "cash_out", id: "payout", amount: 90 })
      .result,
    "ignored",
  );
  assert.equal(
    parseSaleEvent("custom", {
      status: "pending",
      transaction_id: "a",
      currency: "BRL",
      amount_cents: 9990,
    }).result,
    "ignored",
  );
  assert.equal(
    parseSaleEvent("custom", {
      status: "approved",
      transaction_id: "a",
      currency: "USD",
      amount_cents: 9990,
    }).result,
    "ignored",
  );
  assert.equal(
    parseSaleEvent("custom", { status: "approved", price: 99, currency: "BRL" }).result,
    "invalid",
  );
  assert.equal(
    parseSaleEvent("hotmart", {
      event: "PURCHASE_APPROVED",
      data: { purchase: { price: { value: 99, currency_value: "BRL" } } },
    }).result,
    "invalid",
  );
  const refund = parseSaleEvent("custom", {
    status: "refunded",
    transaction_id: "a",
    currency: "BRL",
    amount_cents: 9990,
  });
  assert.equal(refund.event.kind, "reversed");
  assert.equal(refund.event.amountCents, 9990);
});

test("restricts push destinations to recognized HTTPS providers", () => {
  for (const url of [
    "https://fcm.googleapis.com/fcm/send/test",
    "https://web.push.apple.com/Qtest",
  ]) {
    assert.equal(validPushEndpoint(url), true);
  }
  for (const url of [
    "http://fcm.googleapis.com/test",
    "https://fcm.googleapis.com.evil.test/test",
    "https://fcm.googleapis.com:4430/test",
    "https://fcm.googleapis.com@127.0.0.1/test",
    "https://169.254.169.254/test",
    "https://evil.test/.push.apple.com/test",
  ]) {
    assert.equal(validPushEndpoint(url), false, url);
  }
});
