export type InstagramConnectionProfile = {
  instagramUserId: string;
  username: string;
  name: string | null;
  pictureUrl: string | null;
};

export class InstagramConnectionError extends Error {
  readonly reason:
    | "network"
    | "authorization_invalid"
    | "permission_missing"
    | "profile_unavailable"
    | "invalid_response";
  constructor(reason: InstagramConnectionError["reason"]) {
    const messages = {
      network:
        "A Meta não respondeu agora. Sua conexão foi preservada; tente verificar novamente mais tarde.",
      authorization_invalid:
        "A Meta não considera mais esta autorização válida. Reconecte esta conta.",
      permission_missing:
        "A Meta não liberou o acesso necessário. Reconecte e confira as permissões do aplicativo.",
      profile_unavailable: "A Meta não disponibilizou os dados desta conta nesta consulta.",
      invalid_response: "A Meta não retornou uma identificação válida para esta conta.",
    };
    super(messages[reason]);
    this.reason = reason;
  }
}

export function instagramProfilePicture(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
    if (
      !["fbcdn.net", "cdninstagram.com", "instagram.com", "facebook.com"].some(
        (host) => url.hostname === host || url.hostname.endsWith("." + host),
      )
    )
      return null;
    if (
      [...url.searchParams.keys()].some((key) =>
        /^(access_token|token|client_secret|code|state)$/i.test(key),
      )
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Read only the authorized profile from the official Graph host. */
export async function readInstagramConnectionProfile(
  input: { instagramUserId: string; accessToken: string; graphBaseUrl: string },
  request: typeof fetch = fetch,
  basicOnly = false,
): Promise<InstagramConnectionProfile> {
  if (
    !/^\d+$/.test(input.instagramUserId) ||
    !/^https:\/\/graph\.(facebook|instagram)\.com\/v\d+\.\d+$/.test(input.graphBaseUrl)
  )
    throw new InstagramConnectionError("invalid_response");
  const url = new URL(input.graphBaseUrl + "/" + input.instagramUserId);
  url.searchParams.set(
    "fields",
    basicOnly ? "id,username" : "id,username,name,profile_picture_url",
  );
  let response: Response;
  try {
    response = await request(url, {
      headers: { Authorization: "Bearer " + input.accessToken },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
  } catch {
    throw new InstagramConnectionError("network");
  }
  const body = (await response.json().catch(() => null)) as {
    id?: unknown;
    username?: unknown;
    name?: unknown;
    profile_picture_url?: unknown;
    error?: { code?: number };
  } | null;
  if (!response.ok || body?.error) {
    if (response.status === 401 || [190, 102].includes(body?.error?.code ?? 0))
      throw new InstagramConnectionError("authorization_invalid");
    // Optional profile fields must not invalidate a working publishing grant.
    // Retry once with identity only; no retries for invalid tokens or transport errors.
    if (!basicOnly && [100, 10, 200].includes(body?.error?.code ?? 0))
      return readInstagramConnectionProfile(input, request, true);
    if (response.status === 403 || [10, 200].includes(body?.error?.code ?? 0))
      throw new InstagramConnectionError("permission_missing");
    if (response.status === 429 || response.status >= 500)
      throw new InstagramConnectionError("network");
    throw new InstagramConnectionError("profile_unavailable");
  }
  if (
    body?.id !== input.instagramUserId ||
    typeof body.username !== "string" ||
    !/^[a-zA-Z0-9._]{1,30}$/.test(body.username)
  )
    throw new InstagramConnectionError("invalid_response");
  return {
    instagramUserId: body.id,
    username: body.username,
    name: typeof body.name === "string" ? body.name.slice(0, 255) : null,
    pictureUrl: instagramProfilePicture(body.profile_picture_url),
  };
}
