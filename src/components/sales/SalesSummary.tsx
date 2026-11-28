import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import { canExecuteTools } from "@/lib/platform-access";
import { salesOverview } from "@/lib/api/sales.functions";
import type { SalesPeriod, SalesProvider } from "@/lib/sales-events";

export function useSalesOverview(
  days: 7 | 30 | 90,
  provider: SalesProvider | null,
  period?: SalesPeriod,
) {
  const { user, status } = usePlatformAccess();
  const load = useServerFn(salesOverview);
  return useQuery({
    queryKey: ["sales-overview", user?.id, days, provider, period],
    queryFn: () => load({ data: { days, provider, period } }),
    enabled: Boolean(user) && canExecuteTools(status),
    refetchInterval: 15_000,
    retry: 1,
  });
}
