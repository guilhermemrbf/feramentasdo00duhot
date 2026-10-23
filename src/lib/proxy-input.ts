/** Parse only proxy endpoints; do not accept website paths or query strings. */
export function parseProxyAddress(value: string) {
  const text = value.trim();
  if (!text || text.length > 1600) throw new Error("Informe o endereço do proxy.");
  const parts = !text.includes("://") ? text.match(/^([^:\s]+):(\d{1,5}):([^:]*):(.*)$/) : null;
  const address = parts
    ? `http://${encodeURIComponent(parts[3])}:${encodeURIComponent(parts[4])}@${parts[1]}:${parts[2]}`
    : text.includes("://")
      ? text
      : `http://${text}`;
  try {
    const url = new URL(address),
      protocol = url.protocol.slice(0, -1);
    if (
      !["http", "https", "socks5"].includes(protocol) ||
      !url.hostname ||
      (url.pathname && url.pathname !== "/") ||
      url.search ||
      url.hash
    )
      throw new Error();
    const username = decodeURIComponent(url.username),
      password = decodeURIComponent(url.password);
    if (
      username.includes(":") ||
      /[\r\n]/.test(username + password) ||
      username.length > 200 ||
      password.length > 1000
    )
      throw new Error();
    return {
      protocol: protocol as "http" | "https" | "socks5",
      host: url.hostname.replace(/^\[|\]$/g, ""),
      port: Number(url.port || (protocol === "https" ? 443 : protocol === "http" ? 80 : 1080)),
      username,
      password,
    };
  } catch {
    throw new Error(
      "Use protocolo://usuario:senha@host:porta, host:porta ou host:porta:usuario:senha, sem caminho ou parâmetros.",
    );
  }
}
