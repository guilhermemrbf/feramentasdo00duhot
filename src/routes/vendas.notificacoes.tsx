import { createFileRoute } from "@tanstack/react-router";
import { SalesPageHeader } from "@/components/sales/SalesLayout";
import { SalesNotifications } from "@/components/sales/SalesNotifications";

export const Route = createFileRoute("/vendas/notificacoes")({
  head: () => ({ meta: [{ title: "Notificações | MouseHot" }] }),
  component: () => (
    <>
      <SalesPageHeader title="Notificações" subtitle="Ative os alertas de venda no seu celular." />
      <SalesNotifications />
    </>
  ),
});
