import { createFileRoute } from "@tanstack/react-router";
import { SalesDashboard } from "@/components/sales/SalesDashboard";

export const Route = createFileRoute("/vendas/")({
  head: () => ({ meta: [{ title: "Dashboard · ScaleHot | MouseHot" }] }),
  component: SalesDashboard,
});
