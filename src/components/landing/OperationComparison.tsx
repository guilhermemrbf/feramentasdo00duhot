import {
  Activity,
  ArrowUpRight,
  ChartNoAxesCombined,
  Equal,
  Film,
  GitBranch,
  Instagram,
  MonitorSmartphone,
  Plus,
  Send,
} from "lucide-react";
import { BRAND_MARK, BRAND_NAME, BRAND_SLOGAN } from "@/lib/brand";
import { Reveal } from "./fx";

const fronts = [
  {
    id: "anuncios",
    icon: ChartNoAxesCombined,
    name: "Tráfego pago",
    market: [],
    tool: "Relatórios de Meta Ads e Google Ads",
    benefit:
      "Consulte o desempenho das contas conectadas e acompanhe vendas e faturamento no mesmo painel.",
  },
  {
    id: "atribuicao",
    icon: Activity,
    name: "Traqueamento",
    market: [
      {
        name: "Utmify",
        logo: "utmify.png",
        summary: "Traqueamento de vendas",
        url: "https://utmify.com.br/",
        description: "Traqueamento de vendas pela origem registrada nos links de campanha (UTMs).",
      },
      {
        name: "Keitaro",
        logo: "keitaro.png",
        summary: "Rastreamento e atribuição",
        url: "https://keitaro.io/en/",
        description: "Rastreamento de tráfego, atribuição de conversões e desempenho de anúncios.",
      },
    ],
    tool: "Traqueamento avançado",
    benefit:
      "Conecte o meio de pagamento, relacione cliques a vendas confirmadas e veja a receita por campanha, incluindo o que ainda está sem atribuição.",
  },
  {
    id: "publicacao",
    icon: Instagram,
    name: "Operação orgânica",
    market: [
      {
        name: "ScaleReels",
        logo: "scalereels.webp",
        summary: "Reels e Stories",
        url: "https://scalereels.com.br/",
        description: "Publicação de Reels e Stories em múltiplas contas do Instagram.",
      },
      {
        name: "Metricool",
        logo: "metricool.png",
        summary: "Calendário social",
        url: "https://metricool.com/planner/",
        description: "Calendário de conteúdo e publicação em diferentes redes sociais.",
      },
    ],
    tool: "Automatic Post para Instagram",
    benefit:
      "Separe bibliotecas por perfil, importe Reels do Google Drive e programe a publicação automática de Reels. Para Stories, prepare a prévia e use o lembrete para publicar no Instagram.",
  },
  {
    id: "canais",
    icon: Send,
    name: "Telegram",
    market: [
      {
        name: "Telegram",
        logo: "telegram.png",
        summary: "Gestão de canais",
        url: "https://telegram.org/faq",
        description: "Publicação e administração de canais no próprio aplicativo.",
      },
      {
        name: "TGStudio",
        logo: "tgstudio.png",
        summary: "Publicação em canais",
        url: "https://tgstudio.app/en/features/scheduler",
        description: "Agendamento de publicações para vários canais.",
      },
    ],
    tool: "Telegram Sync",
    benefit:
      "Revise e atualize links em publicações de canais que você administra, com prévia das alterações e cópia de segurança local.",
  },
  {
    id: "midia",
    icon: Film,
    name: "Ferramentas de mídia",
    market: [
      {
        name: "ExifTool",
        logo: "exiftool.png",
        summary: "Edição de metadados",
        url: "https://github.com/exiftool/exiftool",
        description: "Leitura e edição de metadados em vários formatos de arquivo.",
      },
      {
        name: "4K Video Downloader",
        logo: "4k-download.svg",
        summary: "Download de vídeos",
        url: "https://www.4kdownload.com/products/videodownloader-42",
        description: "Download de vídeos de plataformas compatíveis.",
      },
    ],
    tool: "Download, edição em lote e links de mídia",
    benefit:
      "Baixe mídias autorizadas do Instagram e TikTok pela extensão. No navegador, limpe metadados em lote, prepare criativos e gere prévias. Gere também links públicos de mídia pelo Image Links.",
  },
  {
    id: "dispositivos",
    icon: MonitorSmartphone,
    name: "Celulares",
    market: [
      {
        name: "GeeLark",
        logo: "geelark.webp",
        summary: "Celulares na nuvem",
        url: "https://www.geelark.com/",
        description: "Gerenciamento de ambientes com celulares virtuais na nuvem.",
      },
    ],
    tool: "Fazenda de Celulares",
    benefit:
      "Conecte iPhones físicos compatíveis por USB ao Windows e selecione o aparelho que deseja visualizar e operar. A janela mostra um aparelho por vez.",
  },
] as const;

const complementary = {
  target: "comparar-referencia-complementar",
  name: "The White Rabbit",
  logo: "white-rabbit.ico",
  summary: "Cloaking · referência",
  url: "https://help.thewhiterabbit.app/en/",
};

const marketCards = [
  ...fronts.flatMap(({ id, market }) =>
    market.map((brand) => ({ ...brand, target: `comparar-${id}` })),
  ),
  complementary,
];

export function OperationComparison() {
  return (
    <section id="frentes" className="operation-comparison" aria-labelledby="frentes-title">
      <div className="mx-auto max-w-[1240px] px-6">
        <Reveal className="operation-comparison-heading">
          <h2 id="frentes-title">
            O que sua operação usa separado, <span>o Mousefy reúne.</span>
          </h2>
          <p>
            Conheça as ferramentas de referência e veja o que você já pode fazer dentro do Mousefy.
          </p>
        </Reveal>

        <div className="operation-primary" role="group" aria-label="Marcas de referência e Mousefy">
          {marketCards.map(({ name, logo, summary, target }, index) => (
            <div key={name} className="operation-card">
              {index > 0 && <Plus className="operation-sign" size={21} aria-hidden="true" />}
              <a href={`#${target}`} className="operation-card-link" aria-label={name}>
                <img
                  src={`/brand/market/${logo}`}
                  width={44}
                  height={44}
                  alt=""
                  decoding="async"
                  fetchPriority="low"
                />
                <h3>{name}</h3>
                <p>{summary}</p>
              </a>
            </div>
          ))}
          <div className="operation-card operation-result">
            <Equal className="operation-sign" size={23} aria-hidden="true" />
            <img src={BRAND_MARK} alt="" width={44} height={44} />
            <h3>{BRAND_NAME}</h3>
            <p>{BRAND_SLOGAN}</p>
          </div>
        </div>

        <div className="operation-references" aria-labelledby="comparar-titulo">
          <h3 id="comparar-titulo">O que cada ferramenta faz</h3>
          <p>
            Referências independentes de mercado e os recursos disponíveis no Mousefy em cada
            frente.
          </p>
          <div className="operation-reference-list">
            {fronts.map(({ id, icon: Icon, name, market, tool, benefit }) => (
              <article
                key={id}
                id={`comparar-${id}`}
                aria-labelledby={`comparar-${id}-titulo`}
                className="operation-reference"
              >
                <header>
                  <Icon size={20} aria-hidden="true" />
                  <h4 id={`comparar-${id}-titulo`}>{name}</h4>
                </header>
                <dl className="operation-reference-columns">
                  {market.length > 0 && (
                    <div>
                      <dt>No mercado</dt>
                      <dd>
                        <ul>
                          {market.map(({ name: brand, url, description }) => (
                            <li key={brand}>
                              <a href={url} target="_blank" rel="noreferrer">
                                {brand} <ArrowUpRight size={13} aria-hidden="true" />
                              </a>
                              <p>{description}</p>
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  )}
                  <div className="operation-reference-product">
                    <dt>No Mousefy</dt>
                    <dd>
                      <strong>{tool}</strong>
                      <p>{benefit}</p>
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <aside id={complementary.target} className="operation-reference-extra">
            <h4>Referência complementar</h4>
            <p>
              <a href={complementary.url} target="_blank" rel="noreferrer">
                {complementary.name} <ArrowUpRight size={13} aria-hidden="true" />
              </a>{" "}
              atua na categoria de cloakers. O Mousefy oferece rastreamento e atribuição de vendas;
              cloaking está fora da oferta.
            </p>
          </aside>

          <div className="operation-reference-planning">
            <GitBranch size={22} aria-hidden="true" />
            <div>
              <h4>Planejamento e funis</h4>
              <p>
                Monte e visualize o caminho de uma campanha com o Funil visual. Use o Instagram
                Intelligence para organizar a análise de perfis.
              </p>
              <a href="#ferramentas">
                Conhecer as ferramentas <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
