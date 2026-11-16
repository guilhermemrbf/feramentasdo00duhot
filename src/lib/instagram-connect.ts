type LoginWindow = {
  opener: unknown;
  closed: boolean;
  location: { href: string };
  close: () => void;
};

export const INSTAGRAM_CONNECTION_CHANNEL = "mausehot-instagram-connection";

export type InstagramConnectionAccount = {
  id: string;
  connection_status: string;
  last_verified_at?: string | null;
  instagram_user_id?: string;
};

/** A successful login must be reflected in the authenticated account query. */
export function findUpdatedInstagramAccount<T extends InstagramConnectionAccount>(
  current: readonly T[],
  before: readonly InstagramConnectionAccount[],
  confirmedInstagramIds: readonly string[] = [],
): T | undefined {
  const previous = new Map(before.map((account) => [account.id, account]));
  return current.find((account) => {
    if (account.connection_status !== "connected") return false;
    if (
      confirmedInstagramIds.length &&
      !confirmedInstagramIds.includes(account.instagram_user_id ?? "")
    )
      return false;
    const old = previous.get(account.id);
    return (
      !old ||
      old.connection_status !== "connected" ||
      (!!account.last_verified_at &&
        account.last_verified_at !== old.last_verified_at &&
        confirmedInstagramIds.includes(account.instagram_user_id ?? ""))
    );
  });
}

export async function openInstagramAuthorization(
  open: () => LoginWindow | null,
  authorize: () => Promise<{ authorizationUrl: string }>,
) {
  // Reserve the window during the click, before the asynchronous server request.
  const popup = open();
  if (!popup)
    throw new Error(
      "O navegador bloqueou a janela. Permita pop-ups deste site e clique em Conectar Instagram novamente.",
    );
  popup.opener = null;
  try {
    const { authorizationUrl } = await authorize();
    const url = new URL(authorizationUrl);
    if (
      url.protocol !== "https:" ||
      !["www.facebook.com", "www.instagram.com", "api.instagram.com"].includes(url.hostname)
    )
      throw new Error("A autorização retornou um endereço inválido.");
    if (popup.closed)
      throw new Error("A janela foi fechada. Clique em Conectar Instagram para tentar novamente.");
    popup.location.href = url.href;
    return popup;
  } catch (error) {
    popup.close();
    throw error;
  }
}
