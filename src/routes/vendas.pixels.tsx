import { createFileRoute } from "@tanstack/react-router";
import { SalesPageHeader } from "@/components/sales/SalesLayout";
import { PixelIntegrations } from "./vendas.conexoes";

export const Route = createFileRoute("/vendas/pixels")({
  head: () => ({ meta: [{ title: "Pixels · Traqueamento avançado | Mousefy" }] }),
  component: () => (
    <>
      <SalesPageHeader title="Pixels" subtitle="Configure os destinos de conversão da operação." />
      <PixelIntegrations />
    </>
  ),
});
