import { randomBytes } from "node:crypto";
import { hashSalesKey, limitedJson, salesKeyMatches, salesService } from "@/lib/sales.server";
import { parseTrackingRequest, trackingToken } from "./attribution";

const sourceIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reply(status: number, body: object) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function receiveTrackingRequest(request: Request, sourceId: string) {
  const secret = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!sourceIdPattern.test(sourceId) || !secret || !trackingToken.test(secret)) {
    return reply(401, { error: "unauthorized" });
  }
  const { data: source, error } = await salesService
    .from("sales_tracking_sources")
    .select("origin,secret_hash")
    .eq("id", sourceId)
    .eq("active", true)
    .maybeSingle();
  if (error) return reply(503, { error: "tracking_unavailable" });
  if (!source || !salesKeyMatches(secret, source.secret_hash))
    return reply(401, { error: "unauthorized" });

  const body = await limitedJson(request, 8192);
  if (body.error) return reply(body.error, { error: "invalid_body" });
  const action = parseTrackingRequest(body.value, source.origin);
  if (!action) return reply(422, { error: "invalid_tracking_request" });

  if (action.action === "click") {
    const clickToken = randomBytes(32).toString("base64url");
    const captured = await salesService.rpc("sales_tracking_capture", {
      p_source: sourceId,
      p_secret: source.secret_hash,
      p_token: hashSalesKey(clickToken),
      p_utm_source: action.source,
      p_utm_medium: action.medium,
      p_utm_campaign: action.campaign,
      p_campaign_id: action.campaignId,
      p_ad_id: action.adId,
    });
    if (captured.error) return reply(503, { error: "tracking_unavailable" });
    if (!captured.data) return reply(401, { error: "unauthorized" });
    return reply(201, { clickToken });
  }

  const bound = await salesService.rpc("sales_tracking_bind", {
    p_source: sourceId,
    p_secret: source.secret_hash,
    p_token: hashSalesKey(action.clickToken),
    p_external_id: action.externalId,
  });
  if (bound.error) return reply(503, { error: "tracking_unavailable" });
  switch (bound.data) {
    case "bound":
      return reply(200, { status: "bound" });
    case "conflict":
      return reply(409, { error: "order_already_bound" });
    case "invalid_click":
      return reply(422, { error: "invalid_or_expired_click" });
    default:
      return reply(401, { error: "unauthorized" });
  }
}
