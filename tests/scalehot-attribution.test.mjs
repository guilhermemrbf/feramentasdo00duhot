import assert from "node:assert/strict";
import test from "node:test";
import { parseTrackingRequest, trackingOrigin } from "../src/lib/tracking/attribution.ts";

test("accepts a verified HTTPS origin only", () => {
  assert.equal(trackingOrigin("https://Loja.Example/"), "https://loja.example");
  for (const input of [
    "http://loja.example",
    "https://loja.example@another.example",
    "https://loja.example/other",
    "https://loja.example/?x=1",
    "https://loja.example/#",
  ])
    assert.equal(trackingOrigin(input), null, input);
});

test("collects supported campaign tags from the configured origin", () => {
  assert.deepEqual(
    parseTrackingRequest(
      {
        action: "click",
        landingUrl:
          "https://loja.example/oferta?utm_source=meta&utm_campaign=launch&mh_ad_id=123&email=private",
        advertisingConsent: true,
      },
      "https://loja.example",
    ),
    {
      action: "click",
      source: "meta",
      medium: null,
      campaign: "launch",
      campaignId: null,
      adId: "123",
    },
  );
  const payload = {
    action: "click",
    landingUrl: "https://another.example/?utm_source=meta",
    advertisingConsent: true,
  };
  assert.equal(parseTrackingRequest(payload, "https://loja.example"), null);
  assert.equal(
    parseTrackingRequest(
      {
        ...payload,
        advertisingConsent: false,
        landingUrl: "https://loja.example/?utm_source=meta",
      },
      "https://loja.example",
    ),
    null,
  );
  assert.equal(
    parseTrackingRequest(
      { ...payload, landingUrl: "https://loja.example/?utm_source=a&utm_source=b" },
      "https://loja.example",
    ),
    null,
  );
});

test("requires an opaque token and exact gateway order identifier for binding", () => {
  const clickToken = "a".repeat(43);
  assert.deepEqual(
    parseTrackingRequest(
      { action: "bind", clickToken, externalId: "order-1" },
      "https://loja.example",
    ),
    { action: "bind", clickToken, externalId: "order-1" },
  );
  assert.equal(
    parseTrackingRequest(
      { action: "bind", clickToken: "forged", externalId: "order-1" },
      "https://loja.example",
    ),
    null,
  );
  assert.equal(
    parseTrackingRequest(
      { action: "bind", clickToken, externalId: " order-1" },
      "https://loja.example",
    ),
    null,
  );
});
