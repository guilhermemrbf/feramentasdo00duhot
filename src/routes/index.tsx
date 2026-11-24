import { createFileRoute } from "@tanstack/react-router";
import { LaunchPage } from "@/components/access/LaunchPage";
import { BRAND_NAME, BRAND_SLOGAN } from "@/lib/brand";

const description =
  "Acompanhe campanhas e a origem das vendas, programe Reels por perfil e reúna ferramentas de mídia, Telegram e operação com celulares no Mousefy.";
const title = `${BRAND_NAME} — ${BRAND_SLOGAN}`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "page-type", content: "software" },
      { name: "site-kind", content: "software" },
      { property: "og:title", content: title },
      { property: "og:site_name", content: BRAND_NAME },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: description },
      { property: "og:image", content: "https://mausehot.vercel.app/brand/organic-mascot.webp" },
      { property: "og:image:alt", content: "Mascote Mousefy" },
    ],
  }),
  component: LaunchPage,
});
