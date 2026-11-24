import { createFileRoute } from "@tanstack/react-router";
import { LaunchPage } from "@/components/access/LaunchPage";

const description =
  "Organize sua operação na MouseHot. Prepare conteúdo, agende Reels e acompanhe a origem das vendas com rastreamento avançado.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MouseHot — sua operação digital em um só lugar" },
      { name: "description", content: description },
      { name: "page-type", content: "software" },
      { name: "site-kind", content: "software" },
      { property: "og:title", content: "MouseHot — operação orgânica em escala" },
      { property: "og:description", content: description },
      { property: "og:image", content: "https://mausehot.vercel.app/brand/organic-mascot.webp" },
    ],
    links: [{ rel: "icon", type: "image/png", href: "/brand/organic-favicon.png" }],
  }),
  component: LaunchPage,
});
