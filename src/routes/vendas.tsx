import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SalesLayout } from "@/components/sales/SalesLayout";

export const Route = createFileRoute("/vendas")({
  component: () => (
    <SalesLayout>
      <Outlet />
    </SalesLayout>
  ),
});
