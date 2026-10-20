export type FlowNodeKind =
  "source" | "page" | "telegram" | "offer" | "decision" | "text" | "image" | "end";

export type FlowNode = {
  id: string;
  kind: FlowNodeKind;
  title: string;
  description: string;
  body: string;
  imageUrl?: string;
  imageKey?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FlowEdge = { id: string; from: string; to: string; label?: string };
export type Funnel = {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
};

const node = (
  id: string,
  kind: FlowNodeKind,
  title: string,
  description: string,
  x: number,
  y: number,
  body = "",
): FlowNode => ({ id, kind, title, description, body, x, y, width: 250, height: 188 });

export function createStarterFunnels(): Funnel[] {
  const nodes = [
    node(
      "organic-tiktok",
      "source",
      "Contas TikTok",
      "Conteúdo orgânico e perfis de entrada.",
      64,
      100,
      "Contas 02 · 04 · 06 · 08 · 10",
    ),
    node(
      "organic-instagram",
      "source",
      "Contas Instagram",
      "Reels, Stories e mensagens diretas.",
      64,
      320,
      "Contas 01 · 03 · 05 · 07 · 09 · 10",
    ),
    node(
      "organic-x",
      "source",
      "Contas X / Twitter",
      "Distribuição e descoberta orgânica.",
      64,
      540,
      "Perfis e publicações",
    ),
    node(
      "bio-link",
      "page",
      "Link na bio, Stories e DM",
      "Pontos de entrada para o próximo passo.",
      360,
      320,
    ),
    node("bio-site", "page", "Bio / site", "Página central com os caminhos do funil.", 656, 320),
    node(
      "privacy",
      "page",
      "Página Privacy",
      "Página de inscrição e assinatura.",
      952,
      148,
      "Assinante pago · acesso inicial",
    ),
    node(
      "telegram-organic",
      "telegram",
      "Telegram orgânico",
      "Canal de relacionamento e distribuição.",
      952,
      480,
    ),
    node(
      "paid-models",
      "source",
      "Campanhas modelos",
      "Tráfego pago segmentado por campanha.",
      656,
      900,
      "Anúncios e criativos por modelo",
    ),
    node(
      "paid-leaks",
      "source",
      "Campanhas vazados",
      "Campanhas de aquisição para a oferta.",
      952,
      1130,
      "Anúncios · públicos · criativos",
    ),
    node(
      "telegram-paid",
      "telegram",
      "Telegram pago",
      "Entrada para o fluxo de tráfego pago.",
      1248,
      920,
    ),
    node("subscription", "offer", "Assinante pago", "Primeira conversão da jornada.", 1248, 148),
    node("upsells", "offer", "UP 01 + UP 02", "Ofertas adicionais após a compra.", 1248, 360),
    node(
      "retention",
      "decision",
      "Entraves / LTV",
      "Relacionamento, retenção e valor do cliente.",
      1248,
      588,
    ),
    node(
      "main-offer",
      "offer",
      "Oferta matadora",
      "Oferta principal com o material gratuito.",
      1544,
      420,
      "Defina promessa, bônus e chamada para ação.",
    ),
    node(
      "group",
      "telegram",
      "Grupo liberado",
      "Comunidade e continuidade do relacionamento.",
      1840,
      420,
    ),
    node(
      "front",
      "page",
      "Front vazados",
      "Oferta de entrada e apresentação do produto.",
      2136,
      420,
    ),
    node(
      "paid-upsell",
      "offer",
      "Assinatura + upsells",
      "Assinatura paga e ofertas UP 01 / UP 02.",
      2432,
      420,
    ),
    node(
      "delivery",
      "end",
      "Entrega + LTV",
      "Entrega do produto e próxima etapa do cliente.",
      2728,
      420,
    ),
  ];
  const edges: FlowEdge[] = [
    { id: "e-tiktok-bio", from: "organic-tiktok", to: "bio-link" },
    { id: "e-instagram-bio", from: "organic-instagram", to: "bio-link" },
    { id: "e-x-bio", from: "organic-x", to: "bio-link" },
    { id: "e-link-site", from: "bio-link", to: "bio-site" },
    { id: "e-site-privacy", from: "bio-site", to: "privacy" },
    { id: "e-site-telegram", from: "bio-site", to: "telegram-organic" },
    { id: "e-privacy-subscription", from: "privacy", to: "subscription" },
    { id: "e-subscription-upsells", from: "subscription", to: "upsells" },
    { id: "e-telegram-upsells", from: "telegram-organic", to: "upsells" },
    { id: "e-upsells-retention", from: "upsells", to: "retention" },
    { id: "e-retention-offer", from: "retention", to: "main-offer" },
    { id: "e-offer-group", from: "main-offer", to: "group" },
    { id: "e-group-front", from: "group", to: "front" },
    { id: "e-front-upsell", from: "front", to: "paid-upsell" },
    { id: "e-upsell-delivery", from: "paid-upsell", to: "delivery" },
    { id: "e-models-telegram", from: "paid-models", to: "telegram-paid" },
    { id: "e-leaks-telegram", from: "paid-leaks", to: "telegram-paid" },
    { id: "e-paid-offer", from: "telegram-paid", to: "main-offer", label: "tráfego pago" },
  ];
  return [
    {
      id: "funnel-01",
      name: "Funil 01",
      description:
        "Jornada completa do primeiro contato até a entrega, retenção e valor do cliente.",
      nodes,
      edges,
    },
  ];
}

export function createNewFunnel(name: string, id = `funnel-${Date.now().toString(36)}`): Funnel {
  const source = node(
    `${id}-source`,
    "source",
    "Ponto de entrada",
    "Como as pessoas chegam ao funil.",
    120,
    280,
  );
  const finish = node(
    `${id}-end`,
    "end",
    "Próxima etapa",
    "Descreva o resultado ou destino.",
    540,
    280,
  );
  return {
    id,
    name,
    description: "Descreva o objetivo deste funil.",
    nodes: [source, finish],
    edges: [{ id: `${id}-edge-1`, from: source.id, to: finish.id }],
  };
}

function isNodeKind(value: unknown): value is FlowNodeKind {
  return (
    value === "source" ||
    value === "page" ||
    value === "telegram" ||
    value === "offer" ||
    value === "decision" ||
    value === "text" ||
    value === "image" ||
    value === "end"
  );
}

function isFunnel(value: unknown): value is Funnel {
  if (!value || typeof value !== "object") return false;
  const funnel = value as Partial<Funnel>;
  return (
    typeof funnel.id === "string" &&
    typeof funnel.name === "string" &&
    typeof funnel.description === "string" &&
    Array.isArray(funnel.nodes) &&
    Array.isArray(funnel.edges) &&
    funnel.nodes.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        isNodeKind(item.kind) &&
        typeof item.title === "string" &&
        typeof item.x === "number" &&
        typeof item.y === "number" &&
        typeof item.width === "number" &&
        typeof item.height === "number",
    ) &&
    funnel.edges.every(
      (edge) =>
        edge &&
        typeof edge.id === "string" &&
        typeof edge.from === "string" &&
        typeof edge.to === "string",
    )
  );
}

export function migrateLegacyFunnels(value: unknown): Funnel[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const migrated = value.flatMap((item): Funnel[] => {
    if (!item || typeof item !== "object") return [];
    const legacy = item as { id?: unknown; name?: unknown; steps?: unknown; cards?: unknown };
    if (
      typeof legacy.id !== "string" ||
      typeof legacy.name !== "string" ||
      !Array.isArray(legacy.steps)
    )
      return [];
    const steps = legacy.steps.filter(
      (step): step is string => typeof step === "string" && !!step.trim(),
    );
    if (!steps.length) return [];
    const cards =
      legacy.cards && typeof legacy.cards === "object"
        ? (legacy.cards as Record<string, unknown>)
        : {};
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    let previous: string | null = null;
    steps.forEach((step, stepIndex) => {
      const stepId = `migrated-${legacy.id}-step-${stepIndex}`;
      nodes.push(
        node(stepId, "page", step, "Etapa migrada do quadro anterior.", 96 + stepIndex * 360, 260),
      );
      if (previous)
        edges.push({ id: `migrated-edge-${legacy.id}-${stepIndex}`, from: previous, to: stepId });
      previous = stepId;
      const stepCards = Array.isArray(cards[step])
        ? (cards[step] as Array<{ id?: unknown; title?: unknown; description?: unknown }>)
        : [];
      stepCards.forEach((card, cardIndex) => {
        if (typeof card?.title !== "string") return;
        const cardId = typeof card.id === "string" ? card.id : `card-${stepIndex}-${cardIndex}`;
        const cardNode = node(
          `migrated-${legacy.id}-${cardId}`,
          "text",
          card.title,
          typeof card.description === "string" ? card.description : "",
          96 + stepIndex * 360,
          470 + cardIndex * 190,
        );
        nodes.push(cardNode);
        edges.push({
          id: `migrated-card-edge-${legacy.id}-${cardIndex}-${stepIndex}`,
          from: stepId,
          to: cardNode.id,
        });
      });
    });
    return [
      {
        id: legacy.id,
        name: legacy.name,
        description: "Quadro anterior convertido para um fluxo editável.",
        nodes,
        edges,
      },
    ];
  });
  return migrated.length ? migrated : null;
}

export function normalizeFunnels(value: unknown): Funnel[] {
  if (!Array.isArray(value)) return createStarterFunnels();
  if (value.length === 0) return [];
  const valid = value.filter(isFunnel);
  return valid.length ? valid : createStarterFunnels();
}
