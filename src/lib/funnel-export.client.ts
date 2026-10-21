import type { FlowNode, Funnel } from "./funnel-model";
import { edgeHandles } from "./funnel-connections";
import { flowExportLayout } from "./funnel-sharing";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

type Port = { x: number; y: number; dx: number; dy: number };
function port(node: FlowNode, handle: string): Port {
  if (handle === "top") return { x: node.x + node.width / 2, y: node.y, dx: 0, dy: -1 };
  if (handle === "bottom")
    return { x: node.x + node.width / 2, y: node.y + node.height, dx: 0, dy: 1 };
  if (handle === "left") return { x: node.x, y: node.y + node.height / 2, dx: -1, dy: 0 };
  return { x: node.x + node.width, y: node.y + node.height / 2, dx: 1, dy: 0 };
}

function lines(ctx: CanvasRenderingContext2D, value: string, width: number, limit: number) {
  const result: string[] = [];
  for (const paragraph of value.slice(0, 6000).split("\n")) {
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      for (const piece of ctx.measureText(word).width > width ? Array.from(word) : [word]) {
        const next = current ? `${current}${piece === word ? " " : ""}${piece}` : piece;
        if (ctx.measureText(next).width > width && current) {
          result.push(current);
          current = piece;
        } else current = next;
        if (result.length >= limit) break;
      }
      if (result.length >= limit) break;
    }
    if (result.length >= limit) break;
    result.push(current);
  }
  if (result.length >= limit && result.join(" ").length < value.length) {
    let last = result[limit - 1] ?? "";
    while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    result[limit - 1] = `${last}…`;
  }
  return result.slice(0, limit);
}

function textBlock(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  width: number,
  size: number,
  maxLines: number,
  centered = false,
  bold = false,
) {
  if (!value || width < 1 || maxLines < 1) return 0;
  ctx.font = `${bold ? "700" : "400"} ${size}px Arial, sans-serif`;
  ctx.textBaseline = "top";
  ctx.textAlign = centered ? "center" : "left";
  const wrapped = lines(ctx, value, width, maxLines);
  wrapped.forEach((line, index) =>
    ctx.fillText(line, centered ? x + width / 2 : x, y + index * size * 1.25),
  );
  return wrapped.length * size * 1.25;
}

function drawPlatform(ctx: CanvasRenderingContext2D, node: FlowNode, centerX: number, y: number) {
  if (node.platform === "instagram") {
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(centerX - 12, y, 24, 24, 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centerX, y + 12, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centerX + 7, y + 5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (node.platform === "tiktok" || node.platform === "x") {
    ctx.font = "700 28px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(node.platform === "tiktok" ? "♪" : "X", centerX, y);
  }
}

function drawNode(ctx: CanvasRenderingContext2D, node: FlowNode, image?: HTMLImageElement) {
  ctx.save();
  ctx.translate(node.x, node.y);
  const { width: w, height: h } = node;
  const transparent = node.appearance === "label" || node.appearance === "brand";
  const custom = !!node.appearance && node.appearance !== "default";
  const bg = node.background ?? (transparent ? "transparent" : "#172337");
  const fg = node.textColor ?? (custom && !transparent ? "#17202a" : "#e2e8f0");
  const color = transparent && bg === "transparent" && fg === "#17202a" ? "#e2e8f0" : fg;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, node.appearance === "telegram" ? Math.min(w, h) / 2 : custom ? 6 : 14);
  if (bg !== "transparent") {
    ctx.fillStyle = bg;
    ctx.fill();
  }
  if (!transparent) {
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.clip();
  ctx.fillStyle = color;
  if (image) {
    const captionH = Math.min(h * 0.55, 50 + (node.description ? 40 : 0) + (node.body ? 36 : 0));
    const imageH = Math.max(1, h - captionH);
    const ratio =
      node.imageFit === "contain"
        ? Math.min(w / image.naturalWidth, imageH / image.naturalHeight)
        : Math.max(w / image.naturalWidth, imageH / image.naturalHeight);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, imageH);
    ctx.clip();
    ctx.drawImage(
      image,
      (w - image.naturalWidth * ratio) / 2,
      (imageH - image.naturalHeight * ratio) / 2,
      image.naturalWidth * ratio,
      image.naturalHeight * ratio,
    );
    ctx.restore();
    let y = imageH + 10;
    y += textBlock(ctx, node.title, 16, y, w - 32, 20, 2, false, true) + 5;
    if (node.description)
      y += textBlock(
        ctx,
        node.description,
        16,
        y,
        w - 32,
        14,
        Math.max(0, Math.min(2, Math.floor((h - y) / 18))),
      );
    textBlock(ctx, node.body, 16, y + 3, w - 32, 14, Math.max(0, Math.floor((h - y - 8) / 18)));
  } else if (node.appearance === "telegram") {
    ctx.save();
    const size = Math.min(w, h) * 0.64;
    ctx.translate((w - size) / 2, (h - size) / 2);
    ctx.scale(size / 24, size / 24);
    ctx.beginPath();
    ctx.moveTo(2, 10);
    ctx.lineTo(22, 2);
    ctx.lineTo(15, 22);
    ctx.lineTo(10, 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = bg;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(10, 14);
    ctx.lineTo(22, 2);
    ctx.stroke();
    ctx.restore();
  } else if (node.appearance === "account") {
    textBlock(
      ctx,
      node.displayLabel || node.title,
      2,
      Math.max(5, h * 0.13),
      w - 4,
      24,
      1,
      true,
      true,
    );
    drawPlatform(ctx, node, w / 2, h * 0.42);
    if (node.description) textBlock(ctx, node.description, 3, h * 0.74, w - 6, 10, 3, true);
  } else if (transparent) {
    const size = node.appearance === "brand" ? 54 : 36;
    const wrapped = lines(
      Object.assign(ctx, { font: `700 ${size}px Arial, sans-serif` }),
      node.title,
      w - 16,
      Math.max(1, Math.floor(h / (size * 1.25))),
    );
    textBlock(
      ctx,
      node.title,
      8,
      Math.max(0, (h - wrapped.length * size * 1.25) / 2),
      w - 16,
      size,
      wrapped.length,
      false,
      true,
    );
  } else {
    const titleSize = custom ? 30 : 20;
    const textW = Math.max(1, w - 32);
    ctx.font = `700 ${titleSize}px Arial, sans-serif`;
    const titleCount = lines(
      ctx,
      node.title,
      textW,
      Math.max(1, Math.min(5, Math.floor((h - 20) / (titleSize * 1.25)))),
    ).length;
    const descriptionSize = custom ? 16 : 14;
    ctx.font = `400 ${descriptionSize}px Arial, sans-serif`;
    const descriptionCount = node.description ? lines(ctx, node.description, textW, 4).length : 0;
    const bodyCount = node.body ? 2 : 0;
    const total =
      titleCount * titleSize * 1.25 +
      (descriptionCount ? descriptionCount * descriptionSize * 1.25 + 8 : 0) +
      (bodyCount ? bodyCount * 17.5 + 8 : 0) +
      (custom ? 0 : 22);
    let y = Math.max(12, (h - total) / 2);
    if (!custom) {
      ctx.globalAlpha = 0.6;
      textBlock(
        ctx,
        node.kind === "text" ? "ANOTAÇÃO" : node.kind === "image" ? "IMAGEM" : "ETAPA DO FLUXO",
        16,
        y,
        textW,
        11,
        1,
        false,
        true,
      );
      ctx.globalAlpha = 1;
      y += 22;
    }
    y += textBlock(ctx, node.title, 16, y, textW, titleSize, titleCount, custom, true) + 8;
    if (node.description)
      y +=
        textBlock(
          ctx,
          node.description,
          16,
          y,
          textW,
          descriptionSize,
          Math.max(0, Math.min(4, Math.floor((h - y - 8) / (descriptionSize * 1.25)))),
          custom,
        ) + 8;
    ctx.globalAlpha = 0.8;
    textBlock(
      ctx,
      node.body,
      16,
      y,
      textW,
      14,
      Math.max(0, Math.min(5, Math.floor((h - y - 8) / 17.5))),
    );
  }
  ctx.restore();
}

/** Draw from the model so offscreen content, CSS and current zoom cannot hide parts of the export. */
export async function renderFunnelImage(
  funnel: Funnel,
  canvas: HTMLElement,
): Promise<HTMLCanvasElement> {
  const layout = flowExportLayout(funnel.nodes);
  const images = new Map<string, HTMLImageElement>();
  await Promise.all(
    funnel.nodes
      .filter((node) => node.imageKey || node.imageUrl)
      .map(async (node) => {
        const source =
          Array.from(canvas.querySelectorAll<HTMLImageElement>("[data-node-id] img")).find(
            (image) => image.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId === node.id,
          )?.src || node.imageUrl;
        if (!source)
          throw new Error(`A imagem de “${node.title}” ainda não carregou. Tente novamente.`);
        try {
          const response = await fetch(source, { signal: AbortSignal.timeout(15000) });
          if (!response.ok) throw new Error("image");
          const url = URL.createObjectURL(await response.blob());
          try {
            const image = new Image();
            image.src = url;
            await image.decode();
            images.set(node.id, image);
          } finally {
            URL.revokeObjectURL(url);
          }
        } catch {
          throw new Error(
            `Não foi possível incluir a imagem de “${node.title}”. Envie a imagem pelo dispositivo para exportá-la.`,
          );
        }
      }),
  );
  const image = document.createElement("canvas");
  image.width = Math.floor(layout.width * layout.pixelRatio);
  image.height = Math.floor(layout.height * layout.pixelRatio);
  const ctx = image.getContext("2d");
  if (!ctx) throw new Error("O navegador não conseguiu criar a imagem. Tente novamente.");
  ctx.scale(layout.pixelRatio, layout.pixelRatio);
  ctx.fillStyle = "#0d1119";
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.strokeStyle = "#263246";
  ctx.lineWidth = 1;
  const gap = Math.max(12, 80 * layout.scale);
  ctx.beginPath();
  for (let x = 0; x < layout.width; x += gap) {
    ctx.moveTo(x, 150);
    ctx.lineTo(x, layout.height);
  }
  for (let y = 150; y < layout.height; y += gap) {
    ctx.moveTo(0, y);
    ctx.lineTo(layout.width, y);
  }
  ctx.stroke();
  ctx.fillStyle = "#e2e8f0";
  textBlock(ctx, funnel.name, 48, 30, layout.width - 96, 32, 1, false, true);
  ctx.fillStyle = "#a9b9cc";
  textBlock(
    ctx,
    `${funnel.description ? `${funnel.description} · ` : ""}${funnel.nodes.length} elementos · ${funnel.edges.length} conexões`,
    48,
    78,
    layout.width - 96,
    16,
    2,
  );
  ctx.save();
  ctx.translate(layout.x, layout.y);
  ctx.scale(layout.scale, layout.scale);
  const nodes = new Map(funnel.nodes.map((node) => [node.id, node]));
  for (const edge of funnel.edges) {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) continue;
    const handles = edgeHandles(funnel, edge);
    const a = port(from, handles.sourceHandle);
    const b = port(to, handles.targetHandle);
    const distance = Math.min(90, Math.max(20, (Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) * 0.35));
    const c1 = { x: a.x + a.dx * distance, y: a.y + a.dy * distance };
    const c2 = { x: b.x + b.dx * distance, y: b.y + b.dy * distance };
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
    ctx.stroke();
    const angle = Math.atan2(b.y - c2.y, b.x - c2.x);
    ctx.fillStyle = "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - 8 * Math.cos(angle - 0.45), b.y - 8 * Math.sin(angle - 0.45));
    ctx.lineTo(b.x - 8 * Math.cos(angle + 0.45), b.y - 8 * Math.sin(angle + 0.45));
    ctx.closePath();
    ctx.fill();
    if (edge.label) {
      const mx = (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8;
      const my = (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8;
      ctx.font = "14px Arial, sans-serif";
      const label = lines(ctx, edge.label, 240, 1)[0];
      const width = ctx.measureText(label).width;
      ctx.fillStyle = "#172337";
      ctx.fillRect(mx - width / 2 - 8, my - 12, width + 16, 25);
      ctx.fillStyle = "#e2e8f0";
      textBlock(ctx, label, mx - width / 2, my - 8, width + 2, 14, 1);
    }
  }
  funnel.nodes.forEach((node) => drawNode(ctx, node, images.get(node.id)));
  ctx.restore();
  return image;
}

export async function exportFunnelFile(
  funnel: Funnel,
  canvas: HTMLElement,
  format: "png" | "pdf",
  filename: string,
) {
  const image = await renderFunnelImage(funnel, canvas);
  try {
    if (format === "png") {
      const blob = await new Promise<Blob>((resolve, reject) =>
        image.toBlob(
          (value) =>
            value ? resolve(value) : reject(new Error("Não foi possível gerar a imagem.")),
          "image/png",
        ),
      );
      downloadBlob(blob, `${filename}.png`);
    } else {
      const { jsPDF } = await import("jspdf");
      const ratio = 1440 / Math.max(image.width, image.height);
      const width = image.width * ratio;
      const height = image.height * ratio;
      const pdf = new jsPDF({
        orientation: width > height ? "landscape" : "portrait",
        unit: "pt",
        format: [width, height],
        compress: true,
      });
      pdf.setProperties({
        title: funnel.name,
        subject: funnel.description,
        creator: "00duHot - Funil",
      });
      pdf.addImage(image, "PNG", 0, 0, width, height, undefined, "FAST");
      downloadBlob(pdf.output("blob"), `${filename}.pdf`);
    }
  } finally {
    image.width = 0;
    image.height = 0;
  }
}
