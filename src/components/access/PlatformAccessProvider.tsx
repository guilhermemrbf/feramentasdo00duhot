import type { User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { platformRpc, rpcData } from "@/lib/platform-access-client";
import { type AccessStatus, type PlatformAccess } from "@/lib/platform-access";

type AccessContext = {
  user: User | null;
  status: AccessStatus | null;
  isLoading: boolean;
  isError: boolean;
  expiresAt: string | null;
  offsetMs: number;
  refresh: () => Promise<void>;
};

const Context = createContext<AccessContext | undefined>(undefined);

export function usePlatformAccess() {
  const access = useContext(Context);
  if (!access) throw new Error("PlatformAccessProvider is missing");
  return access;
}

export function PlatformAccessProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [authFailed, setAuthFailed] = useState(false);
  const [expiredAt, setExpiredAt] = useState<string>();
  const userId = user?.id;
  const query = useQuery({
    queryKey: ["platform-access", userId],
    enabled: !!userId,
    queryFn: async () => {
      const startedAt = Date.now();
      const data = await rpcData(platformRpc.rpc("platform_access_status"));
      if (!data?.status) throw new Error("Não foi possível confirmar seu acesso.");
      const offsetMs = Date.parse(data.server_now) - (startedAt + Date.now()) / 2;
      return { ...data, offsetMs };
    },
    retry: false,
    refetchInterval: (entry) => {
      const state = entry.state.data?.status;
      return state && state !== "approved" && state !== "admin" ? 12_000 : 30_000;
    },
  });

  useEffect(() => {
    try {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
      return () => data.subscription.unsubscribe();
    } catch {
      setAuthFailed(true);
      setUser(null);
    }
  }, []);

  const data: (PlatformAccess & { offsetMs: number }) | undefined = query.data;
  const expiresAt = data?.trial_expires_at ?? null;
  const offsetMs = data?.offsetMs ?? 0;

  useEffect(() => {
    if (data?.status !== "trial" || !expiresAt) return;
    const expiryTimer = window.setTimeout(
      () => {
        setExpiredAt(expiresAt);
        void queryClient.invalidateQueries({ queryKey: ["platform-access", userId] });
      },
      Math.max(0, Date.parse(expiresAt) - Date.now() - offsetMs),
    );
    return () => window.clearTimeout(expiryTimer);
  }, [data?.status, expiresAt, offsetMs, queryClient, userId]);

  const status =
    data?.status === "trial" && expiredAt === expiresAt ? "expired" : (data?.status ?? null);
  return (
    <Context.Provider
      value={{
        user: user ?? null,
        status,
        expiresAt,
        offsetMs,
        isLoading: user === undefined || (!!user && query.isPending),
        isError: authFailed || query.isError,
        refresh: async () => {
          await queryClient.invalidateQueries({ queryKey: ["platform-access", userId] });
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
