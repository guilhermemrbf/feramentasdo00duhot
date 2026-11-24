import { readMouseHotSettings } from "./mousehot-settings.ts";

const brasiliaHour = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "numeric",
  hourCycle: "h23",
});

type DashboardUser = {
  email?: string;
  user_metadata: Record<string, unknown>;
};

export function dashboardGreeting(now: Date, user: DashboardUser | null, isAdmin: boolean) {
  const hour = Number(brasiliaHour.format(now));
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const admin = isAdmin && user?.email?.toLowerCase() === "scaleupperformance@gmail.com";
  const metadata = user?.user_metadata;
  const profileName = [metadata?.given_name, metadata?.full_name, metadata?.name].find(
    (value): value is string => typeof value === "string" && value.trim() !== "",
  );
  const displayName = readMouseHotSettings(metadata).displayName;
  const firstName = (displayName || (admin ? "Guilherme" : profileName))?.trim().split(/\s+/)[0];
  return firstName ? `${greeting}, ${firstName}!` : `${greeting}!`;
}
