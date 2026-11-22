import { createFileRoute } from "@tanstack/react-router";
import { LaunchPage } from "@/components/access/LaunchPage";

const description =
  "Baixe e prepare mídia, analise perfis, planeje funis e agende Reels. A MouseHot reúne as ferramentas da sua operação de conteúdo.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MouseHot — sua operação digital em um só lugar" },
      { name: "description", content: description },
      { name: "page-type", content: "software" },
      { name: "site-kind", content: "software" },
      { property: "og:title", content: "MouseHot" },
      { property: "og:description", content: description },
      { property: "og:image", content: "https://mausehot.vercel.app/brand/compact.webp" },
    ],
  }),
  component: LaunchPage,
});
