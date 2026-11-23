export const trackingToken = /^[A-Za-z0-9_-]{43}$/;

export function trackingOrigin(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password || url.href !== url.origin + "/")
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

const campaignParameters = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "mh_campaign_id",
  "mh_ad_id",
] as const;

export function parseTrackingRequest(input: unknown, origin: string) {
  if (!input || typeof input !== "object") return null;
  if ("action" in input && input.action === "bind") {
    if (
      !("clickToken" in input) ||
      typeof input.clickToken !== "string" ||
      !trackingToken.test(input.clickToken) ||
      !("externalId" in input) ||
      typeof input.externalId !== "string" ||
      !input.externalId ||
      input.externalId.length > 160 ||
      input.externalId !== input.externalId.trim() ||
      /[\u0000-\u001f\u007f]/.test(input.externalId)
    )
      return null;
    return { action: "bind" as const, clickToken: input.clickToken, externalId: input.externalId };
  }

  if (
    !("action" in input) ||
    input.action !== "click" ||
    !("advertisingConsent" in input) ||
    input.advertisingConsent !== true ||
    !("landingUrl" in input) ||
    typeof input.landingUrl !== "string" ||
    input.landingUrl.length > 4096
  )
    return null;

  try {
    const url = new URL(input.landingUrl);
    if (url.origin !== origin || url.username || url.password) return null;
    if (campaignParameters.some((key) => url.searchParams.getAll(key).length > 1)) return null;
    const [source, medium, campaign, campaignId, adId] = campaignParameters.map(
      (key) => url.searchParams.get(key)?.trim() || null,
    );
    if (!source && !campaignId && !adId) return null;
    if (
      [source, medium, campaign].some(
        (text) => text && (text.length > 120 || /[@\u0000-\u001f\u007f]/.test(text)),
      )
    )
      return null;
    if ([campaignId, adId].some((id) => id && !/^\d{1,32}$/.test(id))) return null;
    return { action: "click" as const, source, medium, campaign, campaignId, adId };
  } catch {
    return null;
  }
}
