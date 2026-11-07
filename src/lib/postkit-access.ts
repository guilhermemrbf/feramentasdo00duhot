import type { Session } from "@supabase/supabase-js";

type DeviceAuth = {
  getSession: () => Promise<{ data: { session: Session | null }; error: unknown }>;
};
const pending = new WeakMap<DeviceAuth, Promise<Session | null>>();

/** Restore the Google-authenticated device session; never create an anonymous identity. */
export function getPostkitSession(auth: DeviceAuth): Promise<Session | null> {
  const previous = pending.get(auth);
  if (previous) return previous;
  const operation = (async () => {
    const restored = await auth.getSession();
    if (restored.error)
      throw new Error("Não foi possível recuperar o acesso deste navegador. Tente novamente.");
    return restored.data.session;
  })();
  pending.set(auth, operation);
  void operation.finally(() => pending.delete(auth)).catch(() => undefined);
  return operation;
}

export async function hashPostkitInvitation(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Convite inválido.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createPostkitInvitation() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { token, hash: await hashPostkitInvitation(token) };
}
