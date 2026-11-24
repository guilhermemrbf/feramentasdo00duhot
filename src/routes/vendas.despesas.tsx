import { createFileRoute } from "@tanstack/react-router";
import { ScaleHotCosts } from "@/components/sales/ScaleHotCosts";

export const Route = createFileRoute("/vendas/despesas")({
  head: () => ({ meta: [{ title: "Despesas · ScaleHot | MouseHot" }] }),
  component: () => <ScaleHotCosts expenses />,
});
