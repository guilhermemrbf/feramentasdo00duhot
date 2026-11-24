import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import { readScaleHotOperation } from "@/lib/api/scalehot-operation.functions";
import { salesOverview } from "@/lib/api/sales.functions";
import { scaleHotDateRange } from "@/lib/scalehot-period";
import type { SalesPeriod } from "@/lib/sales-events";

export function useScaleHotOperation(period: Exclude<SalesPeriod, "all">, campaign?: string) {
  const { user, offsetMs } = usePlatformAccess();
  const read = useServerFn(readScaleHotOperation);
  const readSales = useServerFn(salesOverview);
  const range = scaleHotDateRange(period, new Date(Date.now() + offsetMs));
  const operation = useQuery({
    queryKey: ["scalehot-operation", user?.id, range, campaign],
    queryFn: () => read({ data: { range, campaign } }),
    enabled: Boolean(user),
    retry: false,
  });
  const sales = useQuery({
    queryKey: ["scalehot-operation-sales", user?.id, period],
    queryFn: () => readSales({ data: { days: 30, period, provider: null } }),
    enabled: Boolean(user),
  });
  return { operation, sales, range, user };
}
