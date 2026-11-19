import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/control-hub")({
  beforeLoad: () => {
    throw redirect({ to: "/fazenda-de-celulares", statusCode: 308 });
  },
});
