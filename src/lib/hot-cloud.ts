import { z } from "zod";
import type { HotProxy, ProfileKind } from "./hot-profiles";

export type CloudProfile = {
  id: string;
  kind: ProfileKind;
  name: string;
  tags: string[];
  notes: string;
  proxy_id: string | null;
  viewport: { width: number; height: number };
  created_at: string;
  updated_at: string;
};
export type CloudSession = {
  id: string;
  profile_id: string;
  kind: ProfileKind;
  status: "starting" | "running" | "stopping" | "stopped" | "attention";
  created_at: string;
  error: string | null;
};
export type CloudSetup = {
  access: boolean;
  auth: boolean;
  storage: boolean;
  encryption: boolean;
  browser: boolean;
  android: boolean;
};
export type CloudWorkspace = {
  profiles: CloudProfile[];
  proxies: HotProxy[];
  sessions: CloudSession[];
};
export type CloudViewer =
  | { kind: "browser"; url: string }
  | { kind: "android"; address: string; token: string };
export const cloudActive = (session?: CloudSession) => !!session && session.status !== "stopped";
export const cloudLabel = (session?: CloudSession) =>
  ({
    starting: "Preparando na nuvem",
    running: "Em execução",
    stopping: "Encerrando",
    attention: "Verificar sessão",
    stopped: "Disponível",
  })[session?.status ?? "stopped"];

const id = z.string().uuid();
export const cloudProfileSchema = z.object({
  kind: z.enum(["browser", "android"]),
  name: z.string().trim().min(1).max(80),
  tags: z.array(z.string().trim().min(1).max(30)).max(10),
  notes: z.string().max(2000),
  proxy_id: id.nullable(),
  viewport: z.object({
    width: z.number().int().min(640).max(1920),
    height: z.number().int().min(480).max(1080),
  }),
});
export const cloudProxySchema = z.object({
  name: z.string().trim().min(1).max(80),
  protocol: z.enum(["http", "https", "socks5"]),
  host: z
    .string()
    .trim()
    .min(1)
    .max(253)
    .refine(
      (value) => /^[a-z0-9.-]+$/i.test(value) && !value.includes(".."),
      "Use um host ou IPv4, sem protocolo ou credenciais.",
    ),
  port: z.number().int().min(1).max(65535),
  username: z.string().max(200),
  password: z.string().max(1000),
  clearPassword: z.boolean(),
});
export const cloudCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("workspace") }),
  z.object({ action: z.literal("save-profile"), id: id.optional(), profile: cloudProfileSchema }),
  z.object({ action: z.literal("save-proxy"), id: id.optional(), proxy: cloudProxySchema }),
  z.object({ action: z.literal("delete-profile"), id }),
  z.object({ action: z.literal("delete-proxy"), id }),
  z.object({ action: z.literal("start"), id, acceptEphemeralAndroid: z.boolean().default(false) }),
  z.object({ action: z.literal("stop"), id }),
  z.object({ action: z.literal("viewer"), id }),
  z.object({ action: z.literal("sync"), id }),
  z.object({ action: z.literal("navigate"), id, url: z.string().url().max(2000) }),
]);
export type CloudCommand = z.input<typeof cloudCommandSchema>;
export type CloudReply = { ok: true; data: string } | { ok: false; error: string };
