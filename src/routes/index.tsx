import { createFileRoute } from "@tanstack/react-router";
import { LaunchPage } from "@/components/access/LaunchPage";

const description =
  "Organize sua operação orgânica na MouseHot. Compare perfis, trate vídeos em lote, mantenha uma biblioteca por conta e agende Reels.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MouseHot — sua operação digital em um só lugar" },
      { name: "description", content: description },
      { name: "page-type", content: "software" },
      { name: "site-kind", content: "software" },
      { property: "og:title", content: "MouseHot — operação orgânica em escala" },
      { property: "og:description", content: description },
      { property: "og:image", content: "https://mausehot.vercel.app/brand/compact.webp" },
    ],
  }),
  component: LaunchPage,
});
