import { z } from "zod";
import type { FlowNode, Funnel } from "./funnel-model";

export const MAX_FLOW_CODE_BYTES = 24 * 1024 * 1024;
const text = z.string().max(100_000);
const id = z.string().min(1).max(200);
const color = z.string().regex(/^(#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|transparent)$/i);
const imageUrl = z
  .string()
  .max(MAX_FLOW_CODE_BYTES)
  .refine((value) => {
    if (!value) return true;
    if (/^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/i.test(value)) return true;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  });
const nodeSchema = z.object({
  id,
  kind: z.enum(["source", "page", "telegram", "offer", "decision", "text", "image", "end"]),
  title: text,
  description: text.default(""),
  body: text.default(""),
  x: z.number().finite().min(-1_000_000).max(1_000_000),
  y: z.number().finite().min(-1_000_000).max(1_000_000),
  width: z.number().finite().positive().max(16000),
  height: z.number().finite().positive().max(16000),
  appearance: z.enum(["default", "label", "solid", "telegram", "account", "brand"]).optional(),
  platform: z.enum(["tiktok", "instagram", "x", "telegram", "privacy"]).optional(),
  displayLabel: text.optional(),
  background: color.optional(),
  textColor: color.optional(),
  imageUrl: imageUrl.optional(),
  imageFit: z.enum(["cover", "contain"]).optional(),
});
const port = z.enum(["top", "right", "bottom", "left"]).optional();
const packageSchema = z.object({
  format: z.literal("00duhot-funnel"),
  version: z.literal(1),
  funnel: z.object({
    id,
    name: z.string().min(1).max(500),
    description: text,
    direction: z.enum(["horizontal", "vertical"]).optional(),
    theme: z.enum(["dark", "light"]).optional(),
    nodes: z.array(nodeSchema).max(2000),
    edges: z
      .array(
        z.object({
          id,
          from: id,
          to: id,
          label: text.optional(),
          sourceHandle: port,
          targetHandle: port,
        }),
      )
      .max(10000),
  }),
});

export function parseFunnelCode(code: string): Funnel {
  if (new TextEncoder().encode(code).length > MAX_FLOW_CODE_BYTES)
    throw new Error("O código excede o limite de 24 MB.");
  let value: unknown;
  try {
    value = JSON.parse(code);
  } catch {
    throw new Error("O código não é um JSON válido. Cole o código completo exportado pelo Funil.");
  }
  const result = packageSchema.safeParse(value);
  if (!result.success)
    throw new Error(
      "Código de fluxo inválido ou versão não suportada. Confira o arquivo exportado pelo Funil.",
    );
  const funnel = result.data.funnel;
  const ids = new Set(funnel.nodes.map((node) => node.id));
  if (
    ids.size !== funnel.nodes.length ||
    new Set(funnel.edges.map((edge) => edge.id)).size !== funnel.edges.length
  )
    throw new Error("O código contém identificadores repetidos.");
  if (funnel.edges.some((edge) => !ids.has(edge.from) || !ids.has(edge.to)))
    throw new Error("Uma conexão aponta para um elemento que não existe no código.");
  return funnel;
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192)
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

export async function createFunnelCode(
  funnel: Funnel,
  readImage: (key: string) => Promise<Blob | undefined>,
): Promise<string> {
  const nodes = await Promise.all(
    funnel.nodes.map(async ({ imageKey, ...node }) => {
      if (!imageKey) return node;
      const image = await readImage(imageKey);
      if (!image)
        throw new Error(
          `A imagem de “${node.title}” não está disponível. Envie a imagem novamente antes de exportar.`,
        );
      return { ...node, imageUrl: await blobToDataUrl(image) };
    }),
  );
  const code = JSON.stringify(
    { format: "00duhot-funnel", version: 1, funnel: { ...funnel, nodes } },
    null,
    2,
  );
  parseFunnelCode(code);
  return code;
}

export function flowFilename(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "fluxo"
  );
}

export function flowExportLayout(nodes: FlowNode[]) {
  if (!nodes.length)
    throw new Error("Adicione pelo menos um elemento antes de exportar a imagem ou o PDF.");
  const left = Math.min(...nodes.map((node) => node.x));
  const top = Math.min(...nodes.map((node) => node.y));
  const right = Math.max(...nodes.map((node) => node.x + node.width));
  const bottom = Math.max(...nodes.map((node) => node.y + node.height));
  const scale = Math.min(1, 5800 / (right - left), 5800 / (bottom - top));
  const width = Math.max(640, Math.ceil((right - left) * scale + 192));
  const height = Math.ceil((bottom - top) * scale + 302);
  return {
    width,
    height,
    scale,
    x: 96 - left * scale,
    y: 206 - top * scale,
    pixelRatio: Math.min(2, Math.sqrt(24_000_000 / (width * height))),
  };
}
