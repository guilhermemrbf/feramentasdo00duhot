import type { FlowEdge, FlowNode, FlowNodeKind, Funnel } from "./funnel-model.ts";

export function createFluxoHot(): Funnel {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const add = (
    id: string,
    kind: FlowNodeKind,
    title: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options: Partial<FlowNode> = {},
  ) => {
    nodes.push({
      id,
      kind,
      title,
      description: "",
      body: "",
      x,
      y,
      width,
      height,
      appearance: "solid",
      background: "#ffffff",
      textColor: "#17202a",
      ...options,
    });
    return id;
  };
  const link = (from: string, to: string) => edges.push({ id: `${from}--${to}`, from, to });
  const label = (id: string, title: string, x: number, y: number, width: number) =>
    add(id, "text", title, x, y, width, 64, { appearance: "label", background: "transparent" });
  const band = (id: string, title: string, x: number, y: number, color: string, width = 280) =>
    add(id, "offer", title, x, y, width, 72, {
      background: color,
      textColor: color === "#6934d1" ? "#ffffff" : "#17202a",
    });
  const telegram = (id: string, title: string, x: number, y: number, size = 108) =>
    add(id, "telegram", title, x, y, size, size, {
      appearance: "telegram",
      platform: "telegram",
      background: "#2ca6d7",
      textColor: "#ffffff",
    });

  label("section-organic", "ORGÂNICO", 710, 40, 500);
  label("section-paid", "TRÁFEGO PAGO (ANÚNCIOS)", 2380, 40, 780);

  const sources = [
    { id: "tiktok", title: "Contas TikTok", platform: "tiktok" as const, x: 100 },
    { id: "instagram", title: "Contas Instagram", platform: "instagram" as const, x: 720 },
    { id: "twitter", title: "Contas X / Twitter", platform: "x" as const, x: 1340 },
  ];
  for (const source of sources) {
    label(`${source.id}-heading`, source.title, source.x, 180, 520);
    const destination = add(
      `${source.id}-links`,
      "page",
      "Link na bio, Stories e DM",
      source.x + 120,
      480,
      280,
      130,
      { background: "#c4d9ff", body: "Página de links / direct" },
    );
    for (let index = 0; index < 10; index++) {
      const number = String(index + 1).padStart(2, "0");
      const id = add(
        `${source.id}-${number}`,
        "source",
        `${source.title} ${number}`,
        source.x + index * 52,
        280,
        46,
        92,
        {
          appearance: "account",
          platform: source.platform,
          displayLabel: number,
          background: source.platform === "instagram" ? "#dc438c" : "#181818",
          textColor: "#ffffff",
        },
      );
      link(id, destination);
    }
  }

  add("bio-site", "page", "Bio / site", 780, 850, 400, 130, {
    background: "#f3edff",
    description: "Central de links",
  });
  sources.forEach((source) => link(`${source.id}-links`, "bio-site"));
  add("privacy", "page", "privacy", 400, 1130, 330, 90, {
    appearance: "brand",
    platform: "privacy",
    background: "transparent",
  });
  telegram("telegram-organic-entry", "Telegram — entrada orgânica", 1300, 1120, 120);
  link("bio-site", "privacy");
  link("bio-site", "telegram-organic-entry");

  band("privacy-subscription", "Assinante pago", 440, 1320, "#2bc650");
  band("privacy-up-01", "UP 01", 440, 1450, "#6934d1");
  telegram("telegram-privacy-after", "Telegram — pós-Privacy", 526, 1630);
  link("privacy", "privacy-subscription");
  link("privacy-subscription", "privacy-up-01");
  link("privacy-up-01", "telegram-privacy-after");

  band("organic-subscription", "Assinante pago", 1220, 1320, "#2bc650");
  band("organic-up-01", "UP 01", 1220, 1392, "#6934d1");
  band("organic-up-02", "UP 02", 1220, 1464, "#6934d1");
  telegram("telegram-organic-after", "Telegram — pós-upsells orgânicos", 1306, 1630);
  link("telegram-organic-entry", "organic-subscription");
  link("organic-subscription", "organic-up-01");
  link("organic-up-01", "organic-up-02");
  link("organic-up-02", "telegram-organic-after");

  add("organic-ltv", "end", "Entregáveis / LTV", 800, 1640, 280, 115, {
    background: "#c31613",
    textColor: "#ffffff",
  });
  telegram("telegram-organic-offer", "Telegram — oferta orgânica", 886, 1880);
  add(
    "organic-offer",
    "offer",
    "OFERTA MATADORA DE VAZADOS COM O RMKT GRÁTIS",
    720,
    2050,
    440,
    170,
    { background: "#ffe55b" },
  );
  link("telegram-privacy-after", "organic-ltv");
  link("telegram-organic-after", "organic-ltv");
  link("organic-ltv", "telegram-organic-offer");
  link("telegram-organic-offer", "organic-offer");

  const campaignGroups = [
    { id: "models", title: "Campanhas modelos", x: 2100, color: "#f3d3aa" },
    { id: "leaks", title: "Campanhas vazados", x: 2800, color: "#f8bdc7" },
  ];
  telegram("telegram-paid-entry", "Telegram — tráfego pago", 2630, 660, 200);
  for (const group of campaignGroups) {
    label(`${group.id}-heading`, group.title, group.x, 180, 600);
    for (let index = 0; index < 10; index++) {
      const number = String(index + 1).padStart(2, "0");
      const id = add(
        `${group.id}-${number}`,
        "source",
        `${group.title} ${number}`,
        group.x + index * 60,
        280,
        54,
        110,
        {
          appearance: "account",
          displayLabel: number,
          background: group.color,
          description: "Anúncio / criativo",
        },
      );
      link(id, "telegram-paid-entry");
    }
  }
  band("paid-subscription", "Assinante pago", 2590, 1060, "#2bc650");
  band("paid-up-01", "UP 01", 2590, 1132, "#6934d1");
  band("paid-up-02", "UP 02", 2590, 1204, "#6934d1");
  telegram("telegram-paid-after", "Telegram — pós-upsells pagos", 2686, 1350, 88);
  add("paid-ltv", "end", "Entregáveis / LTV", 2590, 1510, 280, 115, {
    background: "#c31613",
    textColor: "#ffffff",
  });
  add("paid-offer", "offer", "OFERTA MATADORA DE VAZADOS COM O RMKT GRÁTIS", 2510, 1740, 440, 170, {
    background: "#ffe55b",
  });
  link("telegram-paid-entry", "paid-subscription");
  link("paid-subscription", "paid-up-01");
  link("paid-up-01", "paid-up-02");
  link("paid-up-02", "telegram-paid-after");
  link("telegram-paid-after", "paid-ltv");
  link("paid-ltv", "paid-offer");

  add("group-unlocked", "source", "O GRUPO LIBERADO", 1610, 2400, 400, 125, {
    background: "#2bc650",
  });
  telegram("telegram-group", "Telegram — grupo liberado", 1750, 2610, 120);
  add("front-leaks", "page", "FRONT VAZADOS", 1610, 2820, 400, 130, {
    background: "#59615d",
    textColor: "#ffffff",
  });
  band("group-subscription", "Assinante pago", 1660, 3070, "#2bc650", 300);
  band("group-up-01", "UP 01", 1660, 3142, "#6934d1", 300);
  band("group-up-02", "UP 02", 1660, 3214, "#6934d1", 300);
  telegram("telegram-group-after", "Telegram — entrega do grupo", 1750, 3460, 120);
  add("group-delivery", "end", "ENTREGÁVEL + LTV", 1610, 3700, 400, 135, {
    background: "#59615d",
    textColor: "#ffffff",
  });
  link("group-unlocked", "telegram-group");
  link("telegram-group", "front-leaks");
  link("front-leaks", "group-subscription");
  link("group-subscription", "group-up-01");
  link("group-up-01", "group-up-02");
  link("group-up-02", "telegram-group-after");
  link("telegram-group-after", "group-delivery");

  return {
    id: "fluxo-hot",
    name: "Fluxo Hot",
    description:
      "Fluxo da referência: orgânico, tráfego pago e grupo liberado, com assinaturas, upsells, ofertas e entregáveis / LTV.",
    direction: "vertical",
    theme: "light",
    nodes,
    edges,
  };
}
