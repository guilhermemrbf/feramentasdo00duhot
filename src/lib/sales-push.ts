export function validPushEndpoint(endpoint: string) {
  if (endpoint.length > 2048) return false;
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      url.pathname.length > 1 &&
      (["fcm.googleapis.com", "updates.push.services.mozilla.com"].includes(url.hostname) ||
        url.hostname.endsWith(".push.apple.com") ||
        url.hostname.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}
