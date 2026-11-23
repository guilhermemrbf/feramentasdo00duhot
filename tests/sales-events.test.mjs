import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSaleEvent,
  SALES_CONNECTION_PROVIDERS,
  salesDashboardAmounts,
} from "../src/lib/sales-events.ts";
import { validPushEndpoint } from "../src/lib/sales-push.ts";

test("offers new connections only for the three ScaleHot gateways", () => {
  assert.deepEqual([...SALES_CONNECTION_PROVIDERS], ["omegapay", "syncpay", "wiinpay"]);
});

test("OmegaPay uses producer currency, net commission and actual payment date", () => {
  const transaction = {
    id: "omega-test",
    amount: 100,
    commissionAmount: 88,
    originalAmount: 20,
    originalCurrency: "USD",
    currency: "BRL",
    createdAt: "2026-11-22T21:00:00Z",
    payedAt: "2026-11-23T15:00:00-03:00",
  };
  const parse = (overrides = {}, event = "TRANSACTION_PAID") =>
    parseSaleEvent("omegapay", { event, transaction: { ...transaction, ...overrides } });
  assert.deepEqual(parse().event, {
    externalId: "omega-test",
    kind: "approved",
    amountCents: 10000,
    netCents: 8800,
    occurredAt: "2026-11-23T18:00:00.000Z",
  });
  assert.equal(parse({ amount: null }).result, "invalid");
  assert.equal(parse({ commissionAmount: null }).event.netCents, null);
  assert.equal(parse({ commissionAmount: 101 }).event.netCents, null);
  assert.equal(parse({ commissionAmount: 0 }).event.netCents, 0);
  assert.equal(parse({}, "TRANSACTION_REFUNDED").event.occurredAt, null);
});

test("dashboard distinguishes gross sales from repasses, deductions and the result before costs", () => {
  const twoSales = {
    approved: 2,
    with_net: 2,
    gross_cents: 20000,
    reported_net_cents: 17600,
    reversed_cents: 0,
  };
  assert.deepEqual(salesDashboardAmounts(twoSales), {
    net: 17600,
    deductions: 2400,
    beforeCosts: 17600,
  });
  assert.deepEqual(salesDashboardAmounts({ ...twoSales, reversed_cents: 10000 }), {
    net: 17600,
    deductions: 2400,
    beforeCosts: 7600,
  });
  assert.deepEqual(salesDashboardAmounts({ ...twoSales, with_net: 1, reported_net_cents: 8800 }), {
    net: null,
    deductions: null,
    beforeCosts: null,
  });
  assert.equal(salesDashboardAmounts({ ...twoSales, reported_net_cents: 20000 }).deductions, 0);
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

test("SyncPay records completed API Pix from transaction.updated and uses the reference for deduplication", () => {
  const reference = "f0c93a71-2d64-4b8e-9a10-5c7e3b21d908";
  const transaction = {
    reference_id: reference,
    status: "completed",
    origin: "api",
    amount: 2,
    net_amount: 0.65,
    currency: "BRL",
    paid_at: "2026-11-23T21:04:25Z",
  };
  const payload = {
    event: "transaction.updated",
    event_id: "df3ac6a0-1659-4c41-8076-d9768ca3241c",
    occurred_at: "2026-11-23T21:04:26Z",
    transaction,
  };
  const parse = (values = {}, envelope = {}) =>
    parseSaleEvent("syncpay", {
      ...payload,
      ...envelope,
      transaction: { ...transaction, ...values },
    });
  assert.deepEqual(parse(), {
    result: "event",
    event: {
      externalId: reference,
      kind: "approved",
      amountCents: 200,
      netCents: 65,
      occurredAt: "2026-11-23T21:04:25.000Z",
    },
  });
  assert.equal(parse({ origin: "checkout" }).result, "event");
  assert.equal(parse({ origin: "payment_link" }).result, "event");
  assert.equal(parse({ origin: "cashout" }).result, "ignored");
  assert.equal(parse({ currency: "USD" }).result, "ignored");
  assert.equal(parse({ reference_id: null }).result, "invalid");
  assert.equal(parse({ status: "pending" }).result, "ignored");
  assert.equal(parse({}, { event: "transaction.created" }).result, "ignored");
  assert.equal(parse({}, { event: "cashout.updated", operation: "cashout" }).result, "ignored");
  assert.equal(
    parse({ status: "refunded", refunded_at: "2026-11-24T01:02:03Z" }).event.occurredAt,
    "2026-11-24T01:02:03.000Z",
  );
  assert.equal(parse({ status: "refunded" }).event.kind, "reversed");
  assert.equal(parse({ status: "chargeback" }).event.kind, "reversed");
  assert.deepEqual(parse({ status: "med", refunded_at: "2026-11-24T01:02:03Z" }), {
    result: "event",
    event: {
      externalId: reference,
      kind: "disputed",
      amountCents: 200,
      netCents: null,
      occurredAt: "2026-11-23T21:04:26.000Z",
    },
  });
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
