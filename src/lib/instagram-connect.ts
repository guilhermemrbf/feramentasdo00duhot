type LoginWindow = {
  opener: unknown;
  closed: boolean;
  location: { href: string };
  close: () => void;
};

export async function openInstagramAuthorization(
  open: () => LoginWindow | null,
  authorize: () => Promise<{ authorizationUrl: string }>,
) {
  // Reserve the window during the click, before the asynchronous server request.
  const popup = open();
  if (!popup)
    throw new Error(
      "O navegador bloqueou a janela. Permita pop-ups deste site e clique em Conectar Conta novamente.",
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
      throw new Error("A janela foi fechada. Clique em Conectar Conta para tentar novamente.");
    popup.location.href = url.href;
  } catch (error) {
    popup.close();
    throw error;
  }
}
