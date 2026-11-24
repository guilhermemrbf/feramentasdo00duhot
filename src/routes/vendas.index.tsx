import { createFileRoute } from "@tanstack/react-router";
import { ScaleHotOverview } from "@/components/sales/ScaleHotOverview";

export const Route = createFileRoute("/vendas/")({
  head: () => ({ meta: [{ title: "Dashboard · ScaleHot | MouseHot" }] }),
  component: ScaleHotOverview,
});
