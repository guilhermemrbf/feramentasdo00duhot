import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Code2,
  ChevronDown,
  CircleHelp,
  CirclePlus,
  Expand,
  Maximize2,
  Minimize2,
  FileImage,
  GitBranch,
  Hand,
  ImagePlus,
  Link2,
  LayoutGrid,
  MousePointer2,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Share2,
  Shapes,
  Sparkles,
  StickyNote,
  Trash2,
  Type,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canConnect } from "@/lib/funnel-connections";
import { FunnelCanvas, type FunnelCanvasApi, type AddAt } from "@/components/FunnelCanvas";
import { FunnelSizePanel } from "@/components/FunnelSizePanel";
import { FunnelShareDialog } from "@/components/FunnelShareDialog";
import { resizeFlowNodes, type SizeAdjustment } from "@/lib/funnel-sizing";
import { AppShell } from "@/components/AppShell";
import { arrangeFunnelForReading, findFreeNodePosition } from "@/lib/funnel-layout";
import {
  createNewFunnel,
  createStarterFunnels,
  loadFunnelWorkspace,
  saveFunnelWorkspace,
  FUNNEL_STORAGE_KEY,
  type FlowEdge,
  type FlowNode,
  type FlowNodeKind,
  type Funnel,
} from "@/lib/funnel-model";

export const Route = createFileRoute("/funil")({
  head: () => ({
    meta: [
      { title: "Funil — 00duHot" },
      { name: "description", content: "Desenhe, conecte e edite cada etapa do seu funil." },
    ],
  }),
  component: FunilPage,
});

const STORAGE_KEY = FUNNEL_STORAGE_KEY;
const IMAGE_DB = "00duhot-funnel-media";
const IMAGE_STORE = "images";
const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const kinds: Array<{
  kind: FlowNodeKind;
  label: string;
  icon: typeof Shapes;
  defaultTitle: string;
}> = [
  { kind: "page", label: "Etapa", icon: Shapes, defaultTitle: "Nova etapa" },
  { kind: "text", label: "Texto", icon: Type, defaultTitle: "Nova anotação" },
  { kind: "image", label: "Imagem", icon: ImagePlus, defaultTitle: "Nova imagem" },
  { kind: "decision", label: "Decisão", icon: CircleHelp, defaultTitle: "Ponto de decisão" },
  { kind: "end", label: "Final", icon: Check, defaultTitle: "Resultado final" },
];

const kindStyles: Record<FlowNodeKind, { color: string; label: string; icon: typeof Shapes }> = {
  source: { color: "sky", label: "Entrada", icon: ArrowUpRight },
  page: { color: "blue", label: "Etapa", icon: Shapes },
  telegram: { color: "cyan", label: "Canal", icon: Link2 },
  offer: { color: "amber", label: "Oferta", icon: Sparkles },
  decision: { color: "violet", label: "Decisão", icon: CircleHelp },
  text: { color: "slate", label: "Texto", icon: StickyNote },
  image: { color: "pink", label: "Imagem", icon: FileImage },
  end: { color: "emerald", label: "Resultado", icon: Check },
};

function openImageDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IMAGE_STORE))
        request.result.createObjectStore(IMAGE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveImage(key: string, file: File) {
  const database = await openImageDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE, "readwrite");
    transaction.objectStore(IMAGE_STORE).put(file, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function getImage(key: string): Promise<Blob | undefined> {
  const database = await openImageDatabase();
  const value = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = database.transaction(IMAGE_STORE, "readonly").objectStore(IMAGE_STORE).get(key);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return value;
}

async function removeImage(key: string) {
  try {
    const database = await openImageDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(IMAGE_STORE, "readwrite");
      transaction.objectStore(IMAGE_STORE).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  } catch {
    // The workspace remains usable if browser media storage is unavailable.
  }
}

async function readWorkspace(): Promise<Funnel[]> {
  try {
    const workspace = loadFunnelWorkspace(window.localStorage);
    if (workspace.replaced) {
      try {
        const database = await openImageDatabase();
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction(IMAGE_STORE, "readwrite");
          transaction.objectStore(IMAGE_STORE).clear();
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });
        database.close();
      } catch {
        /* Old media must not prevent loading the new workspace. */
      }
    }
    return workspace.funnels;
  } catch {
    return createStarterFunnels();
  }
}

function makeNode(kind: FlowNodeKind, title: string, x: number, y: number): FlowNode {
  return {
    id: createId("node"),
    kind,
    title,
    description: "",
    body: "",
    x,
    y,
    width: 320,
    height: kind === "image" ? 320 : kind === "text" ? 220 : 240,
  };
}

function getFlowBounds(nodes: FlowNode[]) {
  if (!nodes.length) return { left: 0, top: 0, right: 1200, bottom: 800 };
  return nodes.reduce(
    (bounds, item) => ({
      left: Math.min(bounds.left, item.x),
      top: Math.min(bounds.top, item.y),
      right: Math.max(bounds.right, item.x + item.width),
      bottom: Math.max(bounds.bottom, item.y + item.height),
    }),
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
  );
}

function FunnelPreview({ funnel }: { funnel: Funnel }) {
  const bounds = getFlowBounds(funnel.nodes);
  return (
    <svg
      viewBox={`${bounds.left - 70} ${bounds.top - 70} ${bounds.right - bounds.left + 140} ${bounds.bottom - bounds.top + 140}`}
      className="h-full w-full"
      aria-hidden="true"
      style={{ background: "#10141d" }}
    >
      {funnel.edges.map((edge) => {
        const from = funnel.nodes.find((item) => item.id === edge.from);
        const to = funnel.nodes.find((item) => item.id === edge.to);
        return from && to ? (
          <line
            key={edge.id}
            x1={from.x + from.width / 2}
            y1={from.y + from.height / 2}
            x2={to.x + to.width / 2}
            y2={to.y + to.height / 2}
            stroke="#7f8b9b"
            strokeWidth="10"
          />
        ) : null;
      })}
      {funnel.nodes
        .filter((item) => item.appearance !== "label")
        .map((item) => (
          <rect
            key={item.id}
            x={item.x}
            y={item.y}
            width={item.width}
            height={item.height}
            rx={item.appearance === "telegram" ? item.width / 2 : 4}
            fill={item.background ?? "#5688ff"}
            stroke="#7f8b9b"
            strokeWidth="3"
          />
        ))}
    </svg>
  );
}

function FunilPage() {
  const [funnels, setFunnels] = useState<Funnel[]>(() => createStarterFunnels());
  const [hydrated, setHydrated] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingFit, setPendingFit] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [viewLabel, setViewLabel] = useState("Visão geral");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const selectedNodeId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;
  const setSelectedNodeId = useCallback(
    (id: string | null) => setSelectedNodeIds(id ? [id] : []),
    [],
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [sizeUndo, setSizeUndo] = useState<{
    funnelId: string;
    sizes: Map<string, Pick<FlowNode, "width" | "height" | "x" | "y">>;
  } | null>(null);
  const [zoom, setZoom] = useState(0.62);
  const [layoutUndo, setLayoutUndo] = useState<{
    funnelId: string;
    positions: Map<string, { x: number; y: number }>;
  } | null>(null);
  const [editingFunnelId, setEditingFunnelId] = useState<string | null>(null);
  const [deletingFunnelId, setDeletingFunnelId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [shareMode, setShareMode] = useState<"export" | "import" | null>(null);
  const [mouseMode, setMouseMode] = useState<"move" | "select">("move");
  const [saveError, setSaveError] = useState("");
  const [imageSources, setImageSources] = useState<Record<string, string>>({});
  const imageUrlsRef = useRef<Record<string, string>>({});
  const viewportRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const nativeFullscreenRef = useRef(false);
  const canvasRef = useRef<FunnelCanvasApi | null>(null);
  const fittedViewRef = useRef<{
    ids: string[] | null;
    label: string;
    reserveEditor?: boolean;
  } | null>(null);
  const savedViews = useRef<Record<string, { zoom: number; x: number; y: number }>>({});
  const active = funnels.find((item) => item.id === openId) ?? null;
  const nodeCount = active?.nodes.length ?? 0;
  const editingTarget = funnels.find((item) => item.id === editingFunnelId) ?? null;
  const deletingTarget = funnels.find((item) => item.id === deletingFunnelId) ?? null;
  const imageSignature = JSON.stringify(
    active?.nodes.flatMap((item) => (item.imageKey ? [item.imageKey] : [])) ?? [],
  );
  const selectedNode = active?.nodes.find((item) => item.id === selectedNodeId) ?? null;
  const selectedNodes = active?.nodes.filter((item) => selectedNodeIds.includes(item.id)) ?? [];
  const selectedEdge = active?.edges.find((item) => item.id === selectedEdgeId) ?? null;
  const sections = useMemo(() => {
    if (!active) return [];
    return [
      {
        id: "bio-site",
        label: "Orgânico",
        headings: ["section-organic", "tiktok-heading", "instagram-heading", "twitter-heading"],
      },
      {
        id: "telegram-paid-entry",
        label: "Tráfego pago",
        headings: ["section-paid", "models-heading", "leaks-heading"],
      },
      { id: "group-unlocked", label: "Grupo liberado", headings: [] },
    ]
      .filter((section) => active.nodes.some((item) => item.id === section.id))
      .map((section) => {
        const ids = new Set([section.id, ...section.headings]);
        const queue = [section.id];
        for (let index = 0; index < queue.length; index++) {
          for (const edge of active.edges) {
            const neighbor =
              edge.from === queue[index] ? edge.to : edge.to === queue[index] ? edge.from : null;
            if (neighbor && !ids.has(neighbor)) {
              ids.add(neighbor);
              queue.push(neighbor);
            }
          }
        }
        return { ...section, ids: [...ids] };
      });
  }, [active]);

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement === workspaceRef.current) {
      try {
        await document.exitFullscreen();
      } catch {
        /* Keep the workspace exit available. */
      }
    }
    nativeFullscreenRef.current = false;
    setFullscreen(false);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (fullscreen) {
      await exitFullscreen();
      return;
    }
    fittedViewRef.current = { ids: null, label: "Visão geral" };
    setFullscreen(true);
    try {
      await workspaceRef.current?.requestFullscreen();
      nativeFullscreenRef.current = document.fullscreenElement === workspaceRef.current;
    } catch {
      // Embedded browsers can still use the expanded workspace.
    }
  }, [fullscreen, exitFullscreen]);

  useEffect(() => {
    if (!active) {
      void exitFullscreen();
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F11") {
        event.preventDefault();
        void toggleFullscreen();
      }
      if (event.key === "Escape" && fullscreen) {
        event.preventDefault();
        void exitFullscreen();
      }
    };
    const onFullscreenChange = () => {
      if (nativeFullscreenRef.current && document.fullscreenElement !== workspaceRef.current) {
        nativeFullscreenRef.current = false;
        setFullscreen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [active, fullscreen, toggleFullscreen, exitFullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullscreen]);

  useEffect(() => {
    let cancelled = false;
    void readWorkspace().then((loaded) => {
      if (!cancelled) {
        setFunnels(loaded);
        setHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persistWorkspace = useCallback(
    (announce = false) => {
      if (!hydrated) return;
      try {
        saveFunnelWorkspace(window.localStorage, funnels);
        setSaveError("");
        if (announce)
          setNotice("Fluxo salvo neste navegador. Para compartilhar uma cópia, use Compartilhar.");
      } catch {
        setSaveError(
          "Não foi possível salvar neste navegador. Verifique o espaço de armazenamento disponível.",
        );
      }
    },
    [funnels, hydrated],
  );

  useEffect(() => {
    persistWorkspace();
  }, [persistWorkspace]);

  const registerImage = useCallback((key: string, blob: Blob) => {
    const previous = imageUrlsRef.current[key];
    if (previous) URL.revokeObjectURL(previous);
    imageUrlsRef.current[key] = URL.createObjectURL(blob);
    setImageSources({ ...imageUrlsRef.current });
  }, []);

  useEffect(() => {
    let disposed = false;
    const keys = JSON.parse(imageSignature) as string[];
    void Promise.all(
      keys.map(async (key) => {
        if (imageUrlsRef.current[key]) return;
        try {
          const blob = await getImage(key);
          if (blob && !disposed) registerImage(key, blob);
        } catch {
          setNotice(
            "Uma imagem local não pôde ser carregada. Você pode enviá-la novamente no editor.",
          );
        }
      }),
    );
    return () => {
      disposed = true;
    };
  }, [imageSignature, registerImage]);

  useEffect(
    () => () => {
      Object.values(imageUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      imageUrlsRef.current = {};
    },
    [],
  );

  const updateFunnel = useCallback(
    (updater: (funnel: Funnel) => Funnel) => {
      setFunnels((current) => current.map((item) => (item.id === openId ? updater(item) : item)));
    },
    [openId],
  );

  const updateNode = useCallback(
    (id: string, patch: Partial<FlowNode>) => {
      updateFunnel((funnel) => ({
        ...funnel,
        nodes: funnel.nodes.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      }));
    },
    [updateFunnel],
  );

  const selectNodes = useCallback((ids: string[]) => {
    if (ids.length) fittedViewRef.current = null;
    setSelectedNodeIds((current) =>
      current.length === ids.length && current.every((id) => ids.includes(id)) ? current : ids,
    );
    if (ids.length) setSelectedEdgeId(null);
  }, []);

  const moveNodes = useCallback(
    (positions: { id: string; x: number; y: number }[]) => {
      const moved = new Map(positions.map(({ id, x, y }) => [id, { x, y }]));
      updateFunnel((funnel) => ({
        ...funnel,
        nodes: funnel.nodes.map((node) =>
          moved.has(node.id) ? { ...node, ...moved.get(node.id) } : node,
        ),
      }));
    },
    [updateFunnel],
  );

  const resizeSelected = (adjustment: SizeAdjustment) => {
    if (!active || !selectedNodes.length) return;
    fittedViewRef.current = null;
    setSizeUndo({
      funnelId: active.id,
      sizes: new Map(
        selectedNodes.map(({ id, width, height, x, y }) => [id, { width, height, x, y }]),
      ),
    });
    updateFunnel((funnel) => ({
      ...funnel,
      nodes: resizeFlowNodes(funnel.nodes, selectedNodeIds, adjustment),
    }));
  };

  const undoSize = () => {
    if (!active || sizeUndo?.funnelId !== active.id) return;
    updateFunnel((funnel) => ({
      ...funnel,
      nodes: funnel.nodes.map((node) => ({ ...node, ...sizeUndo.sizes.get(node.id) })),
    }));
    setSizeUndo(null);
  };

  const organizeForReading = () => {
    if (!active || !viewportRef.current) return;
    const { width, height } = viewportRef.current.getBoundingClientRect();
    setLayoutUndo({
      funnelId: active.id,
      positions: new Map(active.nodes.map((node) => [node.id, { x: node.x, y: node.y }])),
    });
    const nodes = arrangeFunnelForReading(active, width, height);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    updateFunnel((funnel) => ({ ...funnel, nodes }));
    setPendingFit(true);
    setNotice("Blocos organizados para aproveitar a tela. Você pode desfazer a organização.");
  };

  const undoLayout = () => {
    if (!active || layoutUndo?.funnelId !== active.id) return;
    updateFunnel((funnel) => ({
      ...funnel,
      nodes: funnel.nodes.map((node) => ({ ...node, ...layoutUndo.positions.get(node.id) })),
    }));
    setLayoutUndo(null);
    setPendingFit(true);
    setNotice("Posições anteriores restauradas.");
  };

  const createFunnel = () => {
    if (openId && canvasRef.current) savedViews.current[openId] = canvasRef.current.getViewport();
    canvasRef.current = null;
    const funnel = createNewFunnel(`Funil ${String(funnels.length + 1).padStart(2, "0")}`);
    setFunnels((current) => [...current, funnel]);
    setOpenId(funnel.id);
    setMouseMode("move");
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setZoom(0.8);
    setPendingFit(true);
  };

  const deleteFunnel = (id: string) => {
    setDeletingFunnelId(id);
  };

  const confirmDeleteFunnel = (id: string) => {
    const funnel = funnels.find((item) => item.id === id);
    if (!funnel) return;
    funnel.nodes.forEach((item) => {
      if (item.imageKey) void removeImage(item.imageKey);
    });
    setFunnels((current) => current.filter((item) => item.id !== id));
    if (openId === id) setOpenId(null);
    setDeletingFunnelId(null);
  };

  const addNode = useCallback(
    (kind: FlowNodeKind, title: string, at?: AddAt) => {
      if (!active || !viewportRef.current) return;
      const rect = viewportRef.current.getBoundingClientRect();
      const center = at?.position ??
        canvasRef.current?.screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        }) ?? { x: 100, y: 100 };
      const item = makeNode(
        kind,
        title,
        Math.max(0, center.x - (at?.position ? 0 : 160)),
        Math.max(0, center.y - (at?.position ? 0 : 120)),
      );
      Object.assign(item, findFreeNodePosition(active.nodes, item, item.width, item.height));
      updateFunnel((funnel) => ({
        ...funnel,
        nodes: [...funnel.nodes, item],
        edges:
          at?.from && funnel.nodes.some((node) => node.id === at.from)
            ? [
                ...funnel.edges,
                {
                  id: createId("edge"),
                  from: at.from,
                  to: item.id,
                  sourceHandle: at.sourceHandle,
                  targetHandle:
                    at.sourceHandle === "bottom"
                      ? "top"
                      : at.sourceHandle === "top"
                        ? "bottom"
                        : at.sourceHandle === "left"
                          ? "right"
                          : "left",
                },
              ]
            : funnel.edges,
      }));
      fittedViewRef.current = null;
      setSelectedNodeId(item.id);
      setSelectedEdgeId(null);
      void canvasRef.current?.setCenter(
        item.x +
          item.width / 2 +
          (rect.width >= 640 ? 175 / Math.max(0.65, Math.min(canvasRef.current.getZoom(), 1)) : 0),
        item.y + item.height / 2,
        {
          zoom: Math.max(0.65, Math.min(canvasRef.current.getZoom(), 1)),
          duration: 150,
        },
      );
      return item;
    },
    [active, updateFunnel, setSelectedNodeId],
  );

  const deleteNode = (id: string) => {
    const target = active?.nodes.find((item) => item.id === id);
    if (target?.imageKey) void removeImage(target.imageKey);
    updateFunnel((funnel) => ({
      ...funnel,
      nodes: funnel.nodes.filter((item) => item.id !== id),
      edges: funnel.edges.filter((edge) => edge.from !== id && edge.to !== id),
    }));
    setSelectedNodeId(null);
  };

  const deleteEdge = (id: string) => {
    updateFunnel((funnel) => ({ ...funnel, edges: funnel.edges.filter((edge) => edge.id !== id) }));
    setSelectedEdgeId(null);
  };

  const connectNodes = useCallback(
    (edge: Omit<FlowEdge, "id">) => {
      updateFunnel((funnel) =>
        canConnect(funnel, edge.from, edge.to)
          ? { ...funnel, edges: [...funnel.edges, { ...edge, id: createId("edge") }] }
          : funnel,
      );
    },
    [updateFunnel],
  );

  const reconnectNodes = useCallback(
    (id: string, edge: Omit<FlowEdge, "id">) => {
      updateFunnel((funnel) =>
        canConnect(
          { ...funnel, edges: funnel.edges.filter((item) => item.id !== id) },
          edge.from,
          edge.to,
        )
          ? {
              ...funnel,
              edges: funnel.edges.map((item) => (item.id === id ? { ...item, ...edge } : item)),
            }
          : funnel,
      );
    },
    [updateFunnel],
  );

  const openFunnel = (id: string) => {
    if (id === openId) return;
    if (openId && canvasRef.current) savedViews.current[openId] = canvasRef.current.getViewport();
    canvasRef.current = null;
    fittedViewRef.current = null;
    setOpenId(id);
    setMouseMode("move");
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setViewLabel("Visão geral");
  };

  const zoomAtCenter = (nextZoom: number) => {
    fittedViewRef.current = null;
    setViewLabel("Visão livre");
    void canvasRef.current?.zoomTo(Math.min(3, Math.max(0.04, nextZoom)), { duration: 120 });
  };

  const fitNodes = useCallback(
    (ids: string[] | null, label: string, reserveEditor = false) => {
      if (!canvasRef.current || !nodeCount) return;
      fittedViewRef.current = { ids, label, reserveEditor };
      setViewLabel(label);
      if (ids?.length && (ids.length === 1 || reserveEditor) && viewportRef.current) {
        const bounds = canvasRef.current.getNodesBounds(ids);
        const rect = viewportRef.current.getBoundingClientRect();
        const width = rect.width - (rect.width >= 640 ? 350 : 0);
        const scale = Math.max(
          0.04,
          Math.min(
            1.25,
            (width - 48) / Math.max(1, bounds.width),
            (rect.height - 100) / Math.max(1, bounds.height),
          ),
        );
        void canvasRef.current.setViewport(
          {
            zoom: scale,
            x: (width - bounds.width * scale) / 2 - bounds.x * scale,
            y: (rect.height - 60 - bounds.height * scale) / 2 - bounds.y * scale,
          },
          { duration: 180 },
        );
        return;
      }
      void canvasRef.current.fitView({
        nodes: ids?.map((id) => ({ id })),
        padding: 0.15,
        minZoom: 0.04,
        maxZoom: ids?.length === 1 ? 1.25 : 1,
        duration: 180,
      });
    },
    [nodeCount],
  );
  const fitFlow = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    fitNodes(null, "Visão geral");
  }, [fitNodes, setSelectedNodeId]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      const target = fittedViewRef.current;
      if (target) fitNodes(target.ids, target.label, target.reserveEditor);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fitNodes, openId, hydrated]);

  useEffect(() => {
    if (pendingFit && active) {
      fitFlow();
      setPendingFit(false);
    }
  }, [pendingFit, active, fitFlow]);

  useEffect(() => {
    if (!openId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).closest("input,textarea,select,[contenteditable=true]") ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (event.key === "0") {
        event.preventDefault();
        fitFlow();
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomAtCenter(zoom * 1.25);
      }
      if (event.key === "-") {
        event.preventDefault();
        zoomAtCenter(zoom / 1.25);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  const selectElement = useCallback(
    (nodeId: string | null, edgeId: string | null) => {
      fittedViewRef.current = null;
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(edgeId);
      const api = canvasRef.current;
      const rect = viewportRef.current?.getBoundingClientRect();
      const node = nodeId ? api?.getNode(nodeId) : null;
      if (!api || !rect || !node || rect.width < 640) return;
      const point = api.flowToScreenPosition(node.position);
      const dx = Math.min(0, rect.right - 350 - 24 - point.x - (node.width ?? 320) * api.getZoom());
      if (dx < 0) {
        const view = api.getViewport();
        void api.setViewport({ ...view, x: view.x + dx }, { duration: 150 });
      }
    },
    [setSelectedNodeId],
  );
  const focusElement = useCallback(
    (id: string) => {
      fitNodes([id], "Elemento ampliado");
    },
    [fitNodes],
  );
  const navigateCanvas = useCallback(() => {
    fittedViewRef.current = null;
    setViewLabel("Visão livre");
  }, []);
  const canvasReady = useCallback((api: FunnelCanvasApi) => {
    canvasRef.current = api;
  }, []);

  const handleImageFile = useCallback(
    async (item: FlowNode, file?: File) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setNotice("Escolha um arquivo de imagem.");
        return;
      }
      if (!file.size) {
        setNotice("A imagem está vazia. Selecione um arquivo válido do dispositivo.");
        return;
      }
      try {
        const preview = URL.createObjectURL(file);
        try {
          const probe = new Image();
          probe.src = preview;
          await probe.decode();
        } finally {
          URL.revokeObjectURL(preview);
        }
        await saveImage(item.id, file);
        registerImage(item.id, file);
        updateNode(item.id, {
          imageKey: item.id,
          imageUrl: "",
          width: Math.max(280, item.width),
          height: Math.max(320, item.height),
        });
        setNotice("Imagem adicionada ao cartão.");
      } catch {
        setNotice(
          "Não foi possível abrir ou salvar a imagem. Escolha um arquivo de imagem válido.",
        );
      }
    },
    [registerImage, updateNode],
  );

  const imageFor = (item: FlowNode) =>
    item.imageKey ? (imageSources[item.imageKey] ?? "") : (item.imageUrl ?? "");

  const importFunnel = async (source: Funnel) => {
    const id = createId("funnel");
    const ids = new Map(source.nodes.map((node) => [node.id, createId("node")]));
    const media: { key: string; file: File }[] = [];
    const nodes: FlowNode[] = [];
    for (const node of source.nodes) {
      const next = { ...node, id: ids.get(node.id)! };
      if (node.imageUrl?.startsWith("data:")) {
        try {
          const blob = await (await fetch(node.imageUrl)).blob();
          const preview = URL.createObjectURL(blob);
          try {
            const image = new Image();
            image.src = preview;
            await image.decode();
          } finally {
            URL.revokeObjectURL(preview);
          }
          media.push({
            key: next.id,
            file: new File([blob], `${next.id}.image`, { type: blob.type }),
          });
          next.imageKey = next.id;
          next.imageUrl = "";
        } catch {
          throw new Error(`A imagem de “${node.title}” é inválida. Nenhum projeto foi importado.`);
        }
      }
      nodes.push(next);
    }
    const imported: Funnel = {
      ...source,
      id,
      name: `${source.name.slice(0, 480)} (importado)`,
      nodes,
      edges: source.edges.map((edge) => ({
        ...edge,
        id: createId("edge"),
        from: ids.get(edge.from)!,
        to: ids.get(edge.to)!,
      })),
    };
    const written: string[] = [];
    try {
      for (const item of media) {
        await saveImage(item.key, item.file);
        written.push(item.key);
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...funnels, imported]));
    } catch {
      await Promise.all(written.map(removeImage));
      throw new Error(
        "Não há espaço para salvar o fluxo neste navegador. Nenhum projeto existente foi alterado.",
      );
    }
    media.forEach((item) => registerImage(item.key, item.file));
    if (active && canvasRef.current)
      savedViews.current[active.id] = canvasRef.current.getViewport();
    canvasRef.current = null;
    fittedViewRef.current = null;
    setFunnels((current) => [...current, imported]);
    setOpenId(id);
    setMouseMode("move");
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setPendingFit(true);
    setNotice("Fluxo importado como novo projeto. Seus outros funis foram preservados.");
  };

  const updateFunnelMetadata = (name: string, description: string) => {
    setFunnels((current) =>
      current.map((funnel) =>
        funnel.id === editingFunnelId
          ? { ...funnel, name: name.trim() || funnel.name, description }
          : funnel,
      ),
    );
    setEditingFunnelId(null);
  };

  if (!hydrated)
    return (
      <AppShell>
        <main
          aria-busy="true"
          className="flex min-h-[70vh] items-center justify-center gap-3 text-sm text-muted-foreground"
        >
          <GitBranch className="size-5 animate-pulse text-primary" />
          Carregando seus funis…
        </main>
      </AppShell>
    );

  return (
    <AppShell>
      <main className="min-h-screen bg-background">
        {saveError && (
          <div
            role="alert"
            className="border-b border-amber-500/30 bg-amber-500/10 px-5 py-3 text-xs text-amber-200"
          >
            {saveError}
          </div>
        )}
        <div
          ref={workspaceRef}
          data-fullscreen={fullscreen}
          className={
            fullscreen && active
              ? "fixed inset-0 z-[70] flex h-dvh w-full flex-col overflow-y-auto bg-background p-3 text-foreground"
              : "mx-auto flex min-h-screen max-w-[1920px] flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-5"
          }
        >
          {!active ? (
            <>
              <header className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                    <GitBranch className="size-5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.16em] text-primary">
                      ESPAÇO DE TRABALHO
                    </p>
                    <h1 className="font-display text-2xl font-bold tracking-tight">Meus funis</h1>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShareMode("import")}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10"
                  >
                    <Code2 className="size-4" />
                    Inserir código
                  </button>
                  <button
                    onClick={createFunnel}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground  transition hover:bg-primary/90"
                  >
                    <Plus className="size-4" /> Criar funil
                  </button>
                </div>
              </header>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <label htmlFor="funnel-project-search" className="text-xs text-muted-foreground">
                  Encontrar projeto
                </label>
                <input
                  id="funnel-project-search"
                  type="search"
                  value={projectSearch}
                  onChange={(event) => setProjectSearch(event.target.value)}
                  placeholder="Nome do funil"
                  className="workspace-input max-w-sm"
                />
                <span className="text-xs text-muted-foreground">
                  {
                    funnels.filter((funnel) =>
                      funnel.name
                        .toLocaleLowerCase("pt-BR")
                        .includes(projectSearch.toLocaleLowerCase("pt-BR")),
                    ).length
                  }{" "}
                  projetos
                </span>
              </div>
              <section
                className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                aria-label="Projetos de funil"
              >
                {funnels
                  .filter((funnel) =>
                    funnel.name
                      .toLocaleLowerCase("pt-BR")
                      .includes(projectSearch.toLocaleLowerCase("pt-BR")),
                  )
                  .map((funnel, index) => (
                    <article
                      key={funnel.id}
                      className="group overflow-hidden rounded-2xl border border-border bg-card/75 shadow-[0_16px_42px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 hover:border-primary/30"
                    >
                      <button
                        onClick={() => openFunnel(funnel.id)}
                        className="block h-40 w-full overflow-hidden border-b border-border/70 bg-[#10141d] p-4 text-left"
                        aria-label={`Prévia de ${funnel.name}`}
                      >
                        <FunnelPreview funnel={funnel} />
                      </button>
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-bold tracking-[0.14em] text-primary">
                              FLUXO {String(index + 1).padStart(2, "0")}
                            </p>
                            <h2 className="mt-1 font-display text-lg font-bold">{funnel.name}</h2>
                          </div>
                          <button
                            onClick={() => {
                              setEditingFunnelId(funnel.id);
                            }}
                            aria-label={`Editar nome e descrição de ${funnel.name}`}
                            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            <Settings2 className="size-4" />
                          </button>
                          <button
                            onClick={() => deleteFunnel(funnel.id)}
                            aria-label={`Excluir ${funnel.name}`}
                            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">
                          {funnel.description ||
                            "Adicione uma descrição para orientar seu projeto."}
                        </p>
                        <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
                          <div className="flex gap-3 text-[10px] text-muted-foreground">
                            <span>{funnel.nodes.length} elementos</span>
                            <span>{funnel.edges.length} conexões</span>
                          </div>
                          <button
                            onClick={() => openFunnel(funnel.id)}
                            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs font-semibold transition hover:border-primary/30 hover:bg-primary/5"
                          >
                            Abrir funil <ArrowRight className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                <button
                  onClick={createFunnel}
                  className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/25 text-sm font-semibold text-muted-foreground transition hover:border-primary/35 hover:bg-primary/5 hover:text-foreground"
                >
                  <CirclePlus className="size-7 text-primary" />
                  Novo projeto de funil
                </button>
              </section>
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-border/70 bg-card/35 p-4 text-xs leading-5 text-muted-foreground">
                <MousePointer2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <p>
                  Abra um funil para mover elementos, conectar etapas e editar o conteúdo. Os
                  projetos são salvos automaticamente neste navegador.
                </p>
              </div>
            </>
          ) : (
            <>
              <header className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    onClick={() => {
                      setOpenId(null);
                      setSelectedNodeId(null);
                      setSelectedEdgeId(null);
                    }}
                    aria-label="Voltar para meus funis"
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card hover:bg-secondary"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                    <GitBranch className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h1 className="truncate font-display text-lg font-bold">{active.name}</h1>
                      <button
                        onClick={() => setEditingFunnelId(active.id)}
                        aria-label="Editar nome e descrição do funil"
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Settings2 className="size-3.5" />
                      </button>
                    </div>
                    <p className="max-w-[560px] truncate text-[11px] text-muted-foreground">
                      {active.description || "Sem descrição"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => persistWorkspace(true)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-300/30 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/15 hover:bg-blue-400"
                  >
                    <Save className="size-5" />
                    Salvar fluxo
                  </button>
                  <button
                    onClick={() => setShareMode("export")}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500/25"
                  >
                    <Share2 className="size-5" />
                    Compartilhar
                  </button>
                  <button
                    onClick={() => setShareMode("import")}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
                  >
                    <Code2 className="size-5" />
                    Inserir código
                  </button>
                  <button
                    onClick={() => void toggleFullscreen()}
                    aria-keyshortcuts="F11"
                    aria-pressed={fullscreen}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/25"
                  >
                    {fullscreen ? (
                      <Minimize2 className="size-5" />
                    ) : (
                      <Maximize2 className="size-5" />
                    )}
                    {fullscreen ? "Sair da tela cheia" : "Tela cheia"}
                    <kbd className="rounded border border-white/15 px-1.5 py-0.5 text-xs">F11</kbd>
                  </button>
                  <div className="hidden items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-2 text-[10px] text-muted-foreground xl:flex">
                    <span
                      className={`size-2 rounded-full ${saveError ? "bg-amber-400" : "bg-emerald-400"}`}
                    />{" "}
                    {saveError
                      ? "Alterações aguardando gravação"
                      : "Salvo automaticamente neste navegador"}
                  </div>
                </div>
              </header>

              <div
                className={
                  fullscreen
                    ? "hidden"
                    : "mt-4 flex min-h-11 items-end gap-1 overflow-x-auto border-b border-border/80"
                }
                role="tablist"
                aria-label="Funis abertos"
              >
                {funnels.map((funnel) => (
                  <button
                    key={funnel.id}
                    role="tab"
                    aria-selected={funnel.id === active.id}
                    onClick={() => openFunnel(funnel.id)}
                    className={`h-10 max-w-[220px] min-w-[120px] truncate rounded-t-xl border border-b-0 px-4 text-xs font-semibold ${funnel.id === active.id ? "border-border bg-card text-foreground" : "border-transparent text-muted-foreground hover:bg-card/50"}`}
                  >
                    {funnel.name}
                  </button>
                ))}
                <button
                  onClick={createFunnel}
                  aria-label="Criar e abrir outro funil"
                  className="mb-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Plus className="size-4" />
                </button>
                <button
                  onClick={() => {
                    setOpenId(null);
                    setSelectedNodeId(null);
                    setSelectedEdgeId(null);
                  }}
                  className="mb-1 ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Meus funis <ChevronDown className="size-3" />
                </button>
              </div>

              <section
                className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/75 px-3 py-2.5 shadow-sm"
                aria-label="Ferramentas do fluxo"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 hidden text-[10px] font-bold tracking-[0.12em] text-muted-foreground sm:block">
                    ADICIONAR
                  </span>
                  {kinds.map(({ kind, label, icon: Icon, defaultTitle }) => (
                    <button
                      key={kind}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData(
                          "application/00duhot-node",
                          JSON.stringify({ kind, title: defaultTitle }),
                        );
                        event.dataTransfer.effectAllowed = "copy";
                      }}
                      title="Clique ou arraste para o quadro"
                      onClick={() => addNode(kind, defaultTitle)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background/70 px-3.5 py-2.5 text-sm font-semibold transition hover:border-primary/50 hover:bg-primary/10"
                    >
                      <Icon className="size-5 text-primary" />
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => zoomAtCenter(zoom / 1.25)}
                    aria-label="Diminuir zoom"
                    className="flex size-11 items-center justify-center rounded-xl border border-border text-slate-200 hover:bg-secondary hover:text-white"
                  >
                    <ZoomOut className="size-5" />
                  </button>
                  <button
                    onClick={() => zoomAtCenter(1)}
                    aria-label="Restaurar zoom em 100%"
                    className="min-h-11 min-w-16 rounded-xl px-2 py-2 text-center text-sm font-semibold tabular-nums text-slate-200 hover:bg-secondary"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    onClick={fitFlow}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/10 px-3.5 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500/20"
                  >
                    <Expand className="size-5" />
                    Ver tudo
                  </button>
                  <button
                    onClick={() => zoomAtCenter(zoom * 1.25)}
                    aria-label="Aumentar zoom"
                    className="flex size-11 items-center justify-center rounded-xl border border-border text-slate-200 hover:bg-secondary hover:text-white"
                  >
                    <ZoomIn className="size-5" />
                  </button>
                </div>
              </section>

              <nav
                aria-label="Navegar pelo fluxo"
                className="mt-2 flex shrink-0 flex-wrap items-center gap-2"
              >
                <div
                  role="group"
                  aria-label="Modo do mouse"
                  className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-600 bg-background p-1"
                >
                  <button
                    onClick={() => setMouseMode("move")}
                    aria-pressed={mouseMode === "move"}
                    title="Arraste o fundo com o botão esquerdo para mover o fluxo"
                    className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${mouseMode === "move" ? "bg-blue-500/25 text-blue-200 shadow-sm ring-1 ring-blue-400/40" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}
                  >
                    <Hand className="size-4" />
                    Mover
                  </button>
                  <button
                    onClick={() => setMouseMode("select")}
                    aria-pressed={mouseMode === "select"}
                    title="Arraste o botão esquerdo para selecionar vários elementos"
                    className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${mouseMode === "select" ? "bg-violet-500/25 text-violet-200 shadow-sm ring-1 ring-violet-400/40" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}
                  >
                    <MousePointer2 className="size-4" />
                    Selecionar
                  </button>
                </div>
                <button
                  onClick={organizeForReading}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500/20"
                >
                  <LayoutGrid className="size-4" />
                  Organizar para leitura
                </button>
                {layoutUndo?.funnelId === active.id && (
                  <button
                    onClick={undoLayout}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10"
                  >
                    <RotateCcw className="size-4" />
                    Desfazer organização
                  </button>
                )}
                <span className="mr-1 text-xs font-medium text-slate-400">Explorar</span>
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => {
                      setSelectedNodeId(null);
                      setSelectedEdgeId(null);
                      fitNodes(section.ids, section.label);
                    }}
                    aria-pressed={viewLabel === section.label}
                    className={`min-h-10 rounded-xl border px-4 py-2 text-sm font-semibold transition ${viewLabel === section.label ? "border-blue-400/50 bg-blue-500/20 text-blue-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
                  >
                    {section.label}
                  </button>
                ))}
                {selectedNode && (
                  <button
                    onClick={() => fitNodes([selectedNode.id], selectedNode.title)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-400/40 px-4 py-2 text-sm font-semibold text-blue-200"
                  >
                    <ZoomIn className="size-4" />
                    Ampliar elemento
                  </button>
                )}
                <button
                  onClick={() => selectNodes(active.nodes.map((node) => node.id))}
                  className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10"
                >
                  Selecionar todos
                </button>
                <span className="ml-auto hidden text-xs text-slate-400 sm:block">
                  {mouseMode === "move"
                    ? "Arraste: mover · Shift + arraste: selecionar"
                    : "Arraste: selecionar · Espaço + arraste: mover"}{" "}
                  · Roda: zoom
                </span>
              </nav>

              {notice && (
                <div
                  role="status"
                  className="mt-2 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground"
                >
                  <span>{notice}</span>
                  <button onClick={() => setNotice("")} aria-label="Fechar aviso">
                    <X className="size-3.5" />
                  </button>
                </div>
              )}

              <div
                style={{ backgroundColor: "#0d1119" }}
                className={`relative mt-3 flex overflow-clip rounded-2xl border border-border shadow-[0_20px_60px_rgba(0,0,0,0.2)] ${fullscreen ? "min-h-[220px] flex-1" : "h-[calc(100dvh-295px)] min-h-[500px] flex-none"}`}
              >
                <div ref={viewportRef} className="relative min-w-0 flex-1 overflow-hidden">
                  <FunnelCanvas
                    key={active.id}
                    funnel={active}
                    mouseMode={mouseMode}
                    selectedNodeIds={selectedNodeIds}
                    selectedEdgeId={selectedEdgeId}
                    imageSources={imageSources}
                    onSelect={selectElement}
                    onSelectNodes={selectNodes}
                    onMoveNodes={moveNodes}
                    onUpdateNode={updateNode}
                    onConnect={connectNodes}
                    onAdd={addNode}
                    onImage={handleImageFile}
                    onReconnect={reconnectNodes}
                    onReady={canvasReady}
                    onZoom={setZoom}
                    onNavigate={navigateCanvas}
                    onFocus={focusElement}
                    initialViewport={savedViews.current[active.id]}
                  />
                  <button
                    type="button"
                    onClick={() => setShareMode("export")}
                    aria-haspopup="dialog"
                    aria-label="Compartilhar fluxo"
                    title="Compartilhar em PDF, imagem ou código"
                    className="absolute top-3 right-3 z-20 inline-flex min-h-12 items-center gap-3 rounded-xl border border-blue-300/40 bg-blue-600 px-4 py-3 text-left text-white shadow-lg shadow-black/30 transition hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
                  >
                    <Share2 aria-hidden="true" className="size-5 shrink-0" />
                    <span>
                      <span className="block text-sm font-bold">Compartilhar</span>
                      <span className="hidden text-[11px] text-blue-100 sm:block">
                        PDF, imagem e código
                      </span>
                    </span>
                  </button>
                </div>

                {selectedNodes.length > 1 && (
                  <aside
                    aria-label="Editar seleção"
                    className="absolute inset-y-0 right-0 z-30 flex w-full flex-col border-l border-slate-700 bg-[#141a25] shadow-2xl sm:w-[350px]"
                  >
                    <header className="flex items-start justify-between border-b border-slate-700 p-4">
                      <div>
                        <h2 className="font-semibold text-white">
                          {selectedNodes.length} elementos selecionados
                        </h2>
                        <p className="mt-1 text-xs text-slate-400">
                          As alterações são salvas automaticamente.
                        </p>
                      </div>
                      <button
                        onClick={() => selectNodes([])}
                        aria-label="Limpar seleção"
                        className="rounded-lg p-2 text-slate-400 hover:bg-white/10"
                      >
                        <X className="size-4" />
                      </button>
                    </header>
                    <div className="flex-1 space-y-4 overflow-y-auto p-4">
                      <button
                        onClick={() => fitNodes(selectedNodeIds, "Seleção ampliada", true)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-400/40 px-3 py-3 text-sm font-semibold text-blue-200 hover:bg-blue-500/15"
                      >
                        <ZoomIn className="size-4" />
                        Ampliar seleção
                      </button>
                      <p className="text-xs leading-5 text-slate-300">
                        Arraste um dos blocos selecionados para mover todos juntos. Use Ctrl ou ⌘ +
                        clique para incluir ou retirar elementos.
                      </p>
                      <FunnelSizePanel
                        key={selectedNodeIds.slice().sort().join(",")}
                        nodes={selectedNodes}
                        onResize={resizeSelected}
                        onUndo={undoSize}
                        canUndo={sizeUndo?.funnelId === active.id}
                      />
                      <details className="rounded-xl border border-slate-700 p-3 text-xs text-slate-300">
                        <summary className="cursor-pointer font-semibold">
                          Elementos na seleção ({selectedNodes.length})
                        </summary>
                        <ul className="mt-2 space-y-2">
                          {selectedNodes.map((node) => (
                            <li key={node.id} className="flex items-center justify-between gap-3">
                              <span className="truncate">{node.title}</span>
                              <span className="shrink-0 text-slate-400">
                                {node.width} × {node.height}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </div>
                    <button
                      onClick={() => selectNodes([])}
                      className="m-4 rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-400"
                    >
                      Concluir seleção
                    </button>
                  </aside>
                )}
                {(selectedNode || selectedEdge) && (
                  <aside
                    className="absolute inset-y-0 right-0 z-30 flex w-full flex-col border-l border-slate-700 bg-[#141a25] shadow-2xl sm:w-[350px]"
                    aria-label={selectedNode ? "Editar elemento" : "Editar conexão"}
                  >
                    <div className="flex items-start justify-between border-b border-slate-700 px-4 py-4">
                      <div>
                        <p className="text-[9px] font-bold tracking-[0.15em] text-blue-300">
                          {selectedNode ? "ELEMENTO DO FLUXO" : "CONEXÃO DO FLUXO"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          As mudanças são salvas automaticamente.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedNodeId(null);
                          setSelectedEdgeId(null);
                        }}
                        aria-label="Fechar editor"
                        className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    {selectedNode && (
                      <div className="flex-1 space-y-4 overflow-y-auto p-4">
                        <label className="block text-[11px] font-semibold text-slate-300">
                          Tipo
                          <select
                            value={selectedNode.kind}
                            onChange={(event) =>
                              updateNode(selectedNode.id, {
                                kind: event.target.value as FlowNodeKind,
                              })
                            }
                            className="mt-1.5 w-full rounded-lg border border-slate-600 bg-background px-3 py-2.5 text-xs text-white outline-none focus:border-blue-400"
                          >
                            {Object.entries(kindStyles).map(([kind, style]) => (
                              <option key={kind} value={kind}>
                                {style.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-[11px] font-semibold text-slate-300">
                          Visual do elemento
                          <select
                            value={selectedNode.appearance ?? "default"}
                            onChange={(event) =>
                              updateNode(selectedNode.id, {
                                appearance: event.target.value as FlowNode["appearance"],
                              })
                            }
                            className="mt-1.5 w-full rounded-lg border border-slate-600 bg-background px-3 py-2.5 text-xs text-white outline-none focus:border-blue-400"
                          >
                            <option value="default">Cartão com detalhes</option>
                            <option value="solid">Bloco colorido</option>
                            <option value="label">Título de seção</option>
                            <option value="telegram">Telegram</option>
                            <option value="account">Conta ou campanha</option>
                            <option value="brand">Marca em texto</option>
                          </select>
                        </label>
                        <fieldset className="space-y-2">
                          <legend className="mb-2 text-xs font-semibold text-slate-300">
                            Cores rápidas
                          </legend>
                          <div className="flex flex-wrap gap-2">
                            {[
                              ["Azul", "#2563eb", "#ffffff"],
                              ["Verde", "#22c55e", "#102018"],
                              ["Roxo", "#7c3aed", "#ffffff"],
                              ["Rosa", "#db2777", "#ffffff"],
                              ["Amarelo", "#facc15", "#17202a"],
                              ["Vermelho", "#dc2626", "#ffffff"],
                              ["Escuro", "#172337", "#e2e8f0"],
                              ["Claro", "#f1f5f9", "#17202a"],
                            ].map(([name, background, textColor]) => (
                              <button
                                key={name}
                                aria-label={`Usar cor ${name}`}
                                title={name}
                                onClick={() =>
                                  updateNode(selectedNode.id, { background, textColor })
                                }
                                className="size-8 rounded-lg border-2 border-white/25 transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-blue-300"
                                style={{ background }}
                              />
                            ))}
                          </div>
                        </fieldset>
                        {selectedNode && (
                          <div className="grid grid-cols-2 gap-3">
                            <label className="text-[11px] font-semibold text-slate-300">
                              Cor de fundo
                              <input
                                type="color"
                                value={
                                  selectedNode.background?.startsWith("#")
                                    ? selectedNode.background
                                    : "#172337"
                                }
                                onChange={(event) =>
                                  updateNode(selectedNode.id, { background: event.target.value })
                                }
                                className="mt-1.5 h-8 w-full rounded border border-slate-600 bg-transparent"
                              />
                            </label>
                            <label className="text-[11px] font-semibold text-slate-300">
                              Cor do texto
                              <input
                                type="color"
                                value={selectedNode.textColor ?? "#e2e8f0"}
                                onChange={(event) =>
                                  updateNode(selectedNode.id, { textColor: event.target.value })
                                }
                                className="mt-1.5 h-8 w-full rounded border border-slate-600 bg-transparent"
                              />
                            </label>
                          </div>
                        )}
                        {selectedNode.appearance === "account" && (
                          <>
                            <label className="block text-[11px] font-semibold text-slate-300">
                              Número ou rótulo curto
                              <input
                                value={selectedNode.displayLabel ?? ""}
                                onChange={(event) =>
                                  updateNode(selectedNode.id, { displayLabel: event.target.value })
                                }
                                className="mt-1.5 w-full rounded-lg border border-slate-600 bg-background px-3 py-2.5 text-xs text-white"
                              />
                            </label>
                            <label className="block text-[11px] font-semibold text-slate-300">
                              Ícone
                              <select
                                value={selectedNode.platform ?? ""}
                                onChange={(event) =>
                                  updateNode(selectedNode.id, {
                                    platform:
                                      (event.target.value as FlowNode["platform"]) || undefined,
                                  })
                                }
                                className="mt-1.5 w-full rounded-lg border border-slate-600 bg-background px-3 py-2.5 text-xs text-white"
                              >
                                <option value="">Campanha</option>
                                <option value="tiktok">TikTok</option>
                                <option value="instagram">Instagram</option>
                                <option value="x">X / Twitter</option>
                              </select>
                            </label>
                          </>
                        )}
                        <label className="block text-[11px] font-semibold text-slate-300">
                          Título
                          <input
                            value={selectedNode.title}
                            onChange={(event) =>
                              updateNode(selectedNode.id, { title: event.target.value })
                            }
                            placeholder="Nome deste ponto"
                            className="mt-1.5 w-full rounded-lg border border-slate-600 bg-background px-3 py-2.5 text-xs text-white outline-none focus:border-blue-400"
                          />
                        </label>
                        <label className="block text-[11px] font-semibold text-slate-300">
                          Descrição
                          <textarea
                            value={selectedNode.description}
                            onChange={(event) =>
                              updateNode(selectedNode.id, { description: event.target.value })
                            }
                            rows={3}
                            placeholder="Explique a função desta etapa"
                            className="mt-1.5 w-full resize-y rounded-lg border border-slate-600 bg-background px-3 py-2.5 text-xs leading-5 text-white outline-none focus:border-blue-400"
                          />
                        </label>
                        {selectedNode && (
                          <label className="block text-[11px] font-semibold text-slate-300">
                            Texto e anotações
                            <textarea
                              value={selectedNode.body}
                              onChange={(event) =>
                                updateNode(selectedNode.id, { body: event.target.value })
                              }
                              rows={5}
                              placeholder="Adicione informações, links ou próximos passos"
                              className="mt-1.5 w-full resize-y rounded-lg border border-slate-600 bg-background px-3 py-2.5 text-xs leading-5 text-white outline-none focus:border-blue-400"
                            />
                          </label>
                        )}
                        {selectedNode && (
                          <div className="space-y-3">
                            <label className="block text-[11px] font-semibold text-slate-300">
                              Link da imagem
                              <input
                                value={selectedNode.imageUrl ?? ""}
                                onChange={(event) => {
                                  if (selectedNode.imageKey) {
                                    void removeImage(selectedNode.imageKey);
                                    const prior = imageUrlsRef.current[selectedNode.imageKey];
                                    if (prior) URL.revokeObjectURL(prior);
                                    delete imageUrlsRef.current[selectedNode.imageKey];
                                    setImageSources({ ...imageUrlsRef.current });
                                  }
                                  updateNode(selectedNode.id, {
                                    imageUrl: event.target.value,
                                    imageKey: undefined,
                                    width: Math.max(280, selectedNode.width),
                                    height: Math.max(320, selectedNode.height),
                                  });
                                }}
                                placeholder="https://..."
                                className="mt-1.5 w-full rounded-lg border border-slate-600 bg-background px-3 py-2.5 text-xs text-white outline-none focus:border-blue-400"
                              />
                            </label>
                            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-600 px-3 py-3 text-xs font-semibold text-slate-300 transition hover:border-blue-400 hover:bg-blue-400/5">
                              <Upload className="size-4 text-blue-300" />
                              Enviar imagem do dispositivo
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(event) => {
                                  void handleImageFile(selectedNode, event.target.files?.[0]);
                                  event.currentTarget.value = "";
                                }}
                                className="sr-only"
                              />
                            </label>
                            {imageFor(selectedNode) && (
                              <div className="flex items-center gap-2">
                                <label className="flex-1 text-xs text-slate-300">
                                  Exibição da imagem
                                  <select
                                    aria-label="Exibição da imagem"
                                    value={selectedNode.imageFit ?? "cover"}
                                    onChange={(event) =>
                                      updateNode(selectedNode.id, {
                                        imageFit: event.target.value as "cover" | "contain",
                                      })
                                    }
                                    className="mt-1 block w-full rounded-lg border border-slate-600 bg-background p-2"
                                  >
                                    <option value="cover">Preencher</option>
                                    <option value="contain">Imagem inteira</option>
                                  </select>
                                </label>
                                <button
                                  onClick={() => {
                                    if (selectedNode.imageKey)
                                      void removeImage(selectedNode.imageKey);
                                    updateNode(selectedNode.id, {
                                      imageKey: undefined,
                                      imageUrl: "",
                                    });
                                  }}
                                  className="mt-4 rounded-lg px-2 py-2 text-xs text-rose-300 hover:bg-rose-500/10"
                                >
                                  Remover imagem
                                </button>
                              </div>
                            )}
                            {imageFor(selectedNode) && (
                              <img
                                src={imageFor(selectedNode)}
                                alt={selectedNode.title}
                                className="max-h-48 w-full rounded-lg border border-slate-700 object-contain"
                              />
                            )}
                          </div>
                        )}
                        <FunnelSizePanel
                          key={selectedNode.id}
                          nodes={[selectedNode]}
                          onResize={resizeSelected}
                          onUndo={undoSize}
                          canUndo={sizeUndo?.funnelId === active.id}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[10px] text-slate-400">
                            Posição X
                            <input
                              type="number"
                              value={Math.round(selectedNode.x)}
                              onChange={(event) =>
                                updateNode(selectedNode.id, {
                                  x: Math.max(0, Number(event.target.value)),
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-600 bg-background px-2.5 py-2 text-xs text-white"
                            />
                          </label>
                          <label className="text-[10px] text-slate-400">
                            Posição Y
                            <input
                              type="number"
                              value={Math.round(selectedNode.y)}
                              onChange={(event) =>
                                updateNode(selectedNode.id, {
                                  y: Math.max(0, Number(event.target.value)),
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-600 bg-background px-2.5 py-2 text-xs text-white"
                            />
                          </label>
                        </div>
                      </div>
                    )}
                    {selectedEdge && (
                      <div className="flex-1 space-y-4 p-4">
                        <p className="text-xs leading-5 text-slate-300">
                          Conexão entre{" "}
                          <b>{active.nodes.find((item) => item.id === selectedEdge.from)?.title}</b>{" "}
                          e <b>{active.nodes.find((item) => item.id === selectedEdge.to)?.title}</b>
                          .
                        </p>
                        <label className="block text-[11px] font-semibold text-slate-300">
                          Rótulo opcional
                          <input
                            value={selectedEdge.label ?? ""}
                            onChange={(event) =>
                              updateFunnel((funnel) => ({
                                ...funnel,
                                edges: funnel.edges.map((item) =>
                                  item.id === selectedEdge.id
                                    ? { ...item, label: event.target.value }
                                    : item,
                                ),
                              }))
                            }
                            placeholder="Ex.: se assinou, seguir para..."
                            className="mt-1.5 w-full rounded-lg border border-slate-600 bg-background px-3 py-2.5 text-xs text-white outline-none focus:border-blue-400"
                          />
                        </label>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-slate-700 p-4">
                      <button
                        onClick={() =>
                          selectedNode
                            ? deleteNode(selectedNode.id)
                            : selectedEdge && deleteEdge(selectedEdge.id)
                        }
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-400/10"
                      >
                        <Trash2 className="size-3.5" />
                        Excluir {selectedNode ? "elemento" : "conexão"}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedNodeId(null);
                          setSelectedEdgeId(null);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-400"
                      >
                        <Check className="size-3.5" />
                        Concluir
                      </button>
                    </div>
                  </aside>
                )}
              </div>
              <footer
                className={
                  fullscreen
                    ? "hidden"
                    : "flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs text-muted-foreground/70"
                }
              >
                <span>
                  Mover: arraste o fundo para navegar. Selecionar: arraste sobre os elementos.
                  Clique em um bloco para editar. Use a roda para zoom.
                </span>
                <button
                  onClick={() => {
                    setOpenId(null);
                    setSelectedNodeId(null);
                    setSelectedEdgeId(null);
                  }}
                  className="font-semibold hover:text-foreground"
                >
                  Voltar aos projetos
                </button>
              </footer>
            </>
          )}
          {shareMode && (
            <FunnelShareDialog
              key={`${active?.id ?? "workspace"}-${shareMode}`}
              funnel={active}
              initialMode={shareMode}
              canvas={() => viewportRef.current}
              readImage={getImage}
              onImport={importFunnel}
              onClose={() => setShareMode(null)}
            />
          )}
          {editingTarget && (
            <FunnelDetailsDialog
              key={editingTarget.id}
              funnel={editingTarget}
              onClose={() => setEditingFunnelId(null)}
              onSave={updateFunnelMetadata}
            />
          )}
          {deletingTarget && (
            <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <section
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-funnel-title"
                aria-describedby="delete-funnel-description"
                className="w-full max-w-md rounded-2xl border border-slate-600 bg-[#141a25] p-5 text-slate-200 shadow-2xl"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    setDeletingFunnelId(null);
                  }
                  if (event.key === "Tab") {
                    event.preventDefault();
                    const buttons = event.currentTarget.querySelectorAll("button");
                    (document.activeElement === buttons[0] ? buttons[1] : buttons[0])?.focus();
                  }
                }}
              >
                <h2 id="delete-funnel-title" className="text-lg font-bold text-white">
                  Excluir este funil?
                </h2>
                <p id="delete-funnel-description" className="mt-3 text-sm leading-6 text-slate-400">
                  “{deletingTarget.name}” e seus {deletingTarget.nodes.length} elementos serão
                  excluídos deste navegador.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    autoFocus
                    onClick={() => setDeletingFunnelId(null)}
                    className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => confirmDeleteFunnel(deletingTarget.id)}
                    className="rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400"
                  >
                    Excluir funil
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}

function FunnelDetailsDialog({
  funnel,
  onClose,
  onSave,
}: {
  funnel: Funnel;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
}) {
  const [name, setName] = useState(funnel.name);
  const [description, setDescription] = useState(funnel.description);
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="funnel-details-title"
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-[0.15em] text-primary">
              DETALHES DO PROJETO
            </p>
            <h2 id="funnel-details-title" className="mt-1 font-display text-xl font-bold">
              Edite seu funil
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>
        <label className="mt-6 block text-xs font-semibold">
          Nome do funil
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
            placeholder="Ex.: Lançamento de produto"
          />
        </label>
        <label className="mt-4 block text-xs font-semibold">
          Descrição
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            className="mt-2 w-full resize-y rounded-xl border border-input bg-background px-3 py-3 text-sm leading-6 outline-none focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
            placeholder="Qual é o objetivo deste fluxo?"
          />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2.5 text-xs font-semibold hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(name, description)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Save className="size-3.5" />
            Salvar detalhes
          </button>
        </div>
      </section>
    </div>
  );
}
