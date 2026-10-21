import { createFluxoHot } from "./fluxo-hot.ts";

export type FlowNodeKind =
  | "source"
  | "page"
  | "telegram"
  | "offer"
  | "decision"
  | "text"
  | "image"
  | "end";

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
  appearance?: "default" | "label" | "solid" | "telegram" | "account" | "brand";
  platform?: "tiktok" | "instagram" | "x" | "telegram" | "privacy";
  displayLabel?: string;
  background?: string;
  textColor?: string;
  imageFit?: "cover" | "contain";
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
  sourceHandle?: string;
  targetHandle?: string;
};
export type Funnel = {
  id: string;
  name: string;
  description: string;
  direction?: "horizontal" | "vertical";
  theme?: "dark" | "light";
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
  return [createFluxoHot()];
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

export const FUNNEL_STORAGE_KEY = "00duhot:funnel-flow-workspace:v2";
export const HOT_PRESET_KEY = "00duhot:fluxo-hot:reference-v1";

export function saveFunnelWorkspace(storage: Pick<Storage, "setItem">, funnels: Funnel[]): void {
  storage.setItem(FUNNEL_STORAGE_KEY, JSON.stringify(funnels));
}

export function loadFunnelWorkspace(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">): {
  funnels: Funnel[];
  replaced: boolean;
} {
  if (storage.getItem(HOT_PRESET_KEY) !== "installed") {
    const funnels = createStarterFunnels();
    storage.setItem(FUNNEL_STORAGE_KEY, JSON.stringify(funnels));
    storage.removeItem("00duhot:funnel-workspace:v1");
    storage.setItem(HOT_PRESET_KEY, "installed");
    return { funnels, replaced: true };
  }
  const saved = storage.getItem(FUNNEL_STORAGE_KEY);
  return {
    funnels: saved ? normalizeFunnels(JSON.parse(saved)) : createStarterFunnels(),
    replaced: false,
  };
}
