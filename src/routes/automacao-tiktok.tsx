import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/automacao-tiktok")({
  beforeLoad: () => {
    throw redirect({ to: "/automacao-instagram", statusCode: 301, replace: true });
  },
});
