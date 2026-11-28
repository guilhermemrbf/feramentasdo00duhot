export type AccessStatus =
  | "admin"
  | "approved"
  | "trial"
  | "pending"
  | "denied"
  | "expired"
  | "unverified";

export type PlatformAccess = {
  status: AccessStatus;
  trial_expires_at: string | null;
  server_now: string;
};

const publicRoutes = new Set([
  "/",
  "/assinatura",
  "/convite",
  "/privacidade",
  "/exclusao-de-dados",
]);
export const trialRoutes = new Set([
  "/painel",
  "/ferramentas",
  "/limpar-metadados",
  "/gerar-preview",
  "/otimizar-criativos",
]);

export function isPublicRoute(path: string) {
  return publicRoutes.has(path);
}

export function accessForRoute(path: string, status: AccessStatus) {
  if (isPublicRoute(path)) return true;
  if (path === "/aprovacoes") return status === "admin";
  // The product remains explorable after sign-up. Mutating operations are
  // independently enforced by the server and database access policies.
  return true;
}

export function canExecuteTools(status: AccessStatus | null) {
  return status === "admin" || status === "approved";
}

export function secondsRemaining(expiresAt: string | null, now: number) {
  if (!expiresAt) return 0;
  const remaining = Date.parse(expiresAt) - now;
  return Number.isFinite(remaining) ? Math.max(0, Math.ceil(remaining / 1000)) : 0;
}

export function inviteFromHash(hash: string) {
  return /^#[a-f0-9]{64}$/.test(hash) ? hash.slice(1) : null;
}
