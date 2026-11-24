import { createFileRoute } from "@tanstack/react-router";
import { ScaleHotCosts } from "@/components/sales/ScaleHotCosts";

export const Route = createFileRoute("/vendas/taxas")({
  head: () => ({ meta: [{ title: "Taxas · Traqueamento avançado | Mousefy" }] }),
  component: ScaleHotCosts,
});
