import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  CirclePlus,
  Expand,
  Maximize2,
  Minimize2,
  FileImage,
  GitBranch,
  ImagePlus,
  Instagram,
  Link2,
  MousePointer2,
  Music2,
  Move,
  Plus,
  Save,
  Send,
  Settings2,
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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { AppShell } from "@/components/AppShell";
import {
  createNewFunnel,
  createStarterFunnels,
  loadFunnelWorkspace,
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
const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

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
    width: kind === "image" ? 260 : 232,
    height: kind === "image" ? 228 : kind === "text" ? 184 : 156,
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

function ReferenceNodeContent({ node }: { node: FlowNode }) {
  if (node.appearance === "telegram")
    return (
      <div className="flex size-full items-center justify-center" title={node.title}>
        <Send className="size-[62%] -translate-x-0.5" fill="currentColor" strokeWidth={1} />
        <span className="sr-only">{node.title}</span>
      </div>
    );
  if (node.appearance === "account")
    return (
      <div
        title={node.title}
        className="flex size-full flex-col items-center justify-center gap-1 overflow-hidden px-0.5 py-1 text-center"
      >
        <span className="text-[17px] font-bold leading-5">{node.displayLabel || node.title}</span>
        {node.platform === "tiktok" ? (
          <Music2 className="size-6 shrink-0" />
        ) : node.platform === "instagram" ? (
          <Instagram className="size-6 shrink-0" />
        ) : node.platform === "x" ? (
          <b className="text-[23px]">X</b>
        ) : (
          <MousePointer2 className="size-4 shrink-0" />
        )}
        {node.description && (
          <span className="line-clamp-3 text-[9px] leading-3">{node.description}</span>
        )}
      </div>
    );
  if (node.appearance === "brand")
    return (
      <div className="flex size-full items-center justify-center overflow-hidden px-2">
        <h3 className="text-[58px] font-extrabold tracking-[-0.06em]">{node.title}</h3>
      </div>
    );
  if (node.appearance === "label")
    return (
      <div className="flex size-full items-center overflow-hidden px-2">
        <h3 className="text-[25px] font-bold">{node.title}</h3>
      </div>
    );
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 overflow-hidden px-4 py-2 text-center">
      <h3 className="whitespace-pre-wrap break-words text-[23px] font-semibold leading-[1.3]">
        {node.title}
      </h3>
      {node.description && <p className="text-[16px] leading-5">{node.description}</p>}
      {node.body && <p className="whitespace-pre-wrap text-[17px] leading-6">{node.body}</p>}
    </div>
  );
}

function FunilPage() {
  const [funnels, setFunnels] = useState<Funnel[]>(() => createStarterFunnels());
  const [hydrated, setHydrated] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingFit, setPendingFit] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [viewLabel, setViewLabel] = useState("Visão geral");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectionStart, setConnectionStart] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.62);
  const [pan, setPan] = useState({ x: 28, y: 30 });
  const [dragPreview, setDragPreview] = useState<{ id: string; x: number; y: number } | null>(null);
  const [resizePreview, setResizePreview] = useState<{
    id: string;
    width: number;
    height: number;
  } | null>(null);
  const [moving, setMoving] = useState<{
    type: "node" | "canvas" | "resize";
    id?: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [editingFunnelId, setEditingFunnelId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const [imageSources, setImageSources] = useState<Record<string, string>>({});
  const imageUrlsRef = useRef<Record<string, string>>({});
  const viewportRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const nativeFullscreenRef = useRef(false);
  const nodeClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggedRef = useRef(false);
  const fittedViewRef = useRef<{ ids: string[] | null; label: string } | null>(null);
  const savedViews = useRef<Record<string, { zoom: number; pan: { x: number; y: number } }>>({});
  const active = funnels.find((item) => item.id === openId) ?? null;
  const nodeCount = active?.nodes.length ?? 0;
  const verticalFlow = active?.direction === "vertical";
  const editingTarget = funnels.find((item) => item.id === editingFunnelId) ?? null;
  const imageSignature = JSON.stringify(
    active?.nodes.flatMap((item) => (item.imageKey ? [item.imageKey] : [])) ?? [],
  );
  const selectedNode = active?.nodes.find((item) => item.id === selectedNodeId) ?? null;
  const selectedEdge = active?.edges.find((item) => item.id === selectedEdgeId) ?? null;
  const visualNodes = useMemo(
    () =>
      (active?.nodes ?? []).map((item) => ({
        ...item,
        ...(dragPreview?.id === item.id ? { x: dragPreview.x, y: dragPreview.y } : {}),
        ...(resizePreview?.id === item.id
          ? { width: resizePreview.width, height: resizePreview.height }
          : {}),
      })),
    [active?.nodes, dragPreview, resizePreview],
  );
  const bounds = useMemo(() => getFlowBounds(visualNodes), [visualNodes]);
  const hoveredNode = active?.nodes.find((item) => item.id === hoveredNodeId);
  const highlightedNodeId = hoveredNodeId ?? selectedNodeId;
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

  useEffect(() => {
    if (!hydrated) return;
    const save = () => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(funnels));
        setSaveError("");
      } catch {
        setSaveError(
          "Não foi possível salvar neste navegador. Verifique o espaço de armazenamento disponível.",
        );
      }
    };
    save();
  }, [funnels, hydrated]);

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
      if (nodeClickTimerRef.current) clearTimeout(nodeClickTimerRef.current);
      Object.values(imageUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const updateFunnel = useCallback(
    (updater: (funnel: Funnel) => Funnel) => {
      setFunnels((current) => current.map((item) => (item.id === openId ? updater(item) : item)));
    },
    [openId],
  );

  const updateNode = (id: string, patch: Partial<FlowNode>) => {
    updateFunnel((funnel) => ({
      ...funnel,
      nodes: funnel.nodes.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const createFunnel = () => {
    const funnel = createNewFunnel(`Funil ${String(funnels.length + 1).padStart(2, "0")}`);
    setFunnels((current) => [...current, funnel]);
    setOpenId(funnel.id);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setZoom(0.8);
    setPan({ x: 70, y: 40 });
  };

  const deleteFunnel = (id: string) => {
    const funnel = funnels.find((item) => item.id === id);
    if (!funnel || !window.confirm(`Excluir “${funnel.name}” e todos os elementos deste fluxo?`))
      return;
    funnel.nodes.forEach((item) => {
      if (item.imageKey) void removeImage(item.imageKey);
    });
    setFunnels((current) => current.filter((item) => item.id !== id));
    if (openId === id) setOpenId(null);
  };

  const addNode = (kind: FlowNodeKind, title: string) => {
    if (!active || !viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const centerX = (rect.width / 2 - pan.x) / zoom;
    const centerY = (rect.height / 2 - pan.y) / zoom;
    const offset = (active.nodes.length % 5) * 32;
    const item = makeNode(
      kind,
      title,
      Math.max(24, centerX - 116 + offset),
      Math.max(24, centerY - 78 + offset),
    );
    updateFunnel((funnel) => ({ ...funnel, nodes: [...funnel.nodes, item] }));
    setSelectedNodeId(item.id);
    setSelectedEdgeId(null);
    setConnectMode(false);
    setConnectionStart(null);
  };

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

  const connectNodes = (id: string) => {
    if (!active) return;
    if (!connectionStart) {
      setConnectionStart(id);
      setNotice("Agora escolha o ponto de destino para concluir a conexão.");
      return;
    }
    if (connectionStart === id) {
      setConnectionStart(null);
      return;
    }
    const exists = active.edges.some((edge) => edge.from === connectionStart && edge.to === id);
    if (exists) {
      setNotice("Esses pontos já estão conectados.");
      setConnectionStart(null);
      setConnectMode(false);
      return;
    }
    const edge: FlowEdge = { id: createId("edge"), from: connectionStart, to: id };
    updateFunnel((funnel) => ({ ...funnel, edges: [...funnel.edges, edge] }));
    setConnectionStart(null);
    setConnectMode(false);
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
    setNotice("Conexão adicionada ao fluxo.");
  };

  const openFunnel = (id: string) => {
    if (nodeClickTimerRef.current) clearTimeout(nodeClickTimerRef.current);
    fittedViewRef.current = null;
    setHoveredNodeId(null);
    setViewLabel("Visão livre");
    if (openId) savedViews.current[openId] = { zoom, pan };
    const view = savedViews.current[id] ?? { zoom: 0.62, pan: { x: 28, y: 30 } };
    setPendingFit(
      !savedViews.current[id] &&
        funnels.find((funnel) => funnel.id === id)?.direction === "vertical",
    );
    setZoom(view.zoom);
    setPan(view.pan);
    setOpenId(id);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setConnectMode(false);
    setConnectionStart(null);
  };

  const zoomAtCenter = (nextZoom: number) => {
    fittedViewRef.current = null;
    setViewLabel("Visão livre");
    const element = viewportRef.current;
    if (!element) {
      setZoom(Math.min(3, Math.max(0.04, nextZoom)));
      return;
    }
    const rect = element.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const worldX = (cx - pan.x) / zoom;
    const worldY = (cy - pan.y) / zoom;
    const bounded = Math.min(3, Math.max(0.04, nextZoom));
    setZoom(bounded);
    setPan({ x: cx - worldX * bounded, y: cy - worldY * bounded });
  };

  const fitNodes = useCallback(
    (ids: string[] | null, label: string) => {
      const element = viewportRef.current;
      if (!element || nodeCount === 0) return;
      const nodes = ids ? visualNodes.filter((item) => ids.includes(item.id)) : visualNodes;
      if (!nodes.length) return;
      const area = getFlowBounds(nodes);
      const rect = element.getBoundingClientRect();
      const contentWidth = area.right - area.left;
      const contentHeight = area.bottom - area.top;
      const fitted = Math.min(
        ids?.length === 1 ? 1.5 : 1,
        Math.max(
          0.01,
          Math.min((rect.width - 64) / contentWidth, (rect.height - 112) / contentHeight),
        ),
      );
      fittedViewRef.current = { ids, label };
      setViewLabel(label);
      setZoom(fitted);
      setPan({
        x: (rect.width - contentWidth * fitted) / 2 - area.left * fitted,
        y: 24 + (rect.height - 112 - contentHeight * fitted) / 2 - area.top * fitted,
      });
    },
    [nodeCount, visualNodes],
  );
  const fitFlow = useCallback(() => fitNodes(null, "Visão geral"), [fitNodes]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      const target = fittedViewRef.current;
      if (target) fitNodes(target.ids, target.label);
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

  const startMoveNode = (event: ReactPointerEvent<HTMLElement>, item: FlowNode) => {
    if (connectMode || (event.target as HTMLElement).closest("button,input,textarea,select"))
      return;
    event.preventDefault();
    event.stopPropagation();
    draggedRef.current = false;
    if (nodeClickTimerRef.current) clearTimeout(nodeClickTimerRef.current);
    event.currentTarget.setPointerCapture(event.pointerId);
    setMoving({
      type: "node",
      id: item.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: item.x,
      originY: item.y,
    });
    setDragPreview({ id: item.id, x: item.x, y: item.y });
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      (event.target as HTMLElement).closest("button,input,textarea,select,article")
    )
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    fittedViewRef.current = null;
    setViewLabel("Visão livre");
    setMoving({
      type: "canvas",
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!moving) return;
    const dx = event.clientX - moving.startX;
    const dy = event.clientY - moving.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) {
      draggedRef.current = true;
      fittedViewRef.current = null;
      setViewLabel("Visão livre");
    }
    if (moving.type === "canvas") setPan({ x: moving.originX + dx, y: moving.originY + dy });
    else if (moving.id && moving.type === "resize")
      setResizePreview({
        id: moving.id,
        width: Math.round(Math.min(1600, Math.max(32, moving.originX + dx / zoom))),
        height: Math.round(Math.min(1200, Math.max(32, moving.originY + dy / zoom))),
      });
    else if (moving.id)
      setDragPreview({
        id: moving.id,
        x: Math.max(0, moving.originX + dx / zoom),
        y: Math.max(0, moving.originY + dy / zoom),
      });
  };

  const finishPointerMove = () => {
    if (moving?.type === "node" && moving.id && dragPreview && draggedRef.current) {
      const { id, x, y } = dragPreview;
      updateNode(id, { x: Math.max(0, x), y: Math.max(0, y) });
    }
    if (moving?.type === "resize" && resizePreview)
      updateNode(resizePreview.id, { width: resizePreview.width, height: resizePreview.height });
    setMoving(null);
    setDragPreview(null);
    setResizePreview(null);
  };

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      fittedViewRef.current = null;
      setViewLabel("Visão livre");
      if (!event.ctrlKey && !event.metaKey) {
        setPan((current) => ({ x: current.x - event.deltaX, y: current.y - event.deltaY }));
        return;
      }
      const next = Math.min(3, Math.max(0.04, zoom * Math.exp(-event.deltaY * 0.002)));
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const worldX = (px - pan.x) / zoom;
      const worldY = (py - pan.y) / zoom;
      setZoom(next);
      setPan({ x: px - worldX * next, y: py - worldY * next });
    },
    [zoom, pan],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [handleWheel, openId, hydrated]);

  const handleImageFile = async (item: FlowNode, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("Escolha um arquivo de imagem.");
      return;
    }
    try {
      await saveImage(item.id, file);
      registerImage(item.id, file);
      updateNode(item.id, { imageKey: item.id, imageUrl: "" });
      setNotice("Imagem adicionada ao cartão.");
    } catch {
      setNotice("Não foi possível salvar a imagem neste navegador.");
    }
  };

  const imageFor = (item: FlowNode) =>
    item.imageKey ? (imageSources[item.imageKey] ?? "") : (item.imageUrl ?? "");

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
      <main className="min-h-screen bg-[radial-gradient(ellipse_at_70%_-20%,rgba(72,132,255,0.12),transparent_48%)]">
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
              ? "fixed inset-0 z-[70] flex h-dvh w-full flex-col overflow-y-auto bg-[#0d1119] p-3 text-foreground"
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
                <button
                  onClick={createFunnel}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition hover:bg-primary/90"
                >
                  <Plus className="size-4" /> Criar funil
                </button>
              </header>
              <section
                className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                aria-label="Projetos de funil"
              >
                {funnels.map((funnel, index) => (
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
                        {funnel.description || "Adicione uma descrição para orientar seu projeto."}
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
                      onClick={() => addNode(kind, defaultTitle)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background/70 px-3.5 py-2.5 text-sm font-semibold transition hover:border-primary/50 hover:bg-primary/10"
                    >
                      <Icon className="size-5 text-primary" />
                      {label}
                    </button>
                  ))}
                  <span className="mx-1 hidden h-6 w-px bg-border md:block" />
                  <button
                    onClick={() => {
                      setConnectMode((value) => !value);
                      setConnectionStart(null);
                      setSelectedNodeId(null);
                      setSelectedEdgeId(null);
                    }}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${connectMode ? "border-primary bg-primary/10 text-primary" : "border-border bg-background/70 hover:border-primary/30 hover:bg-primary/5"}`}
                  >
                    <Link2 className="size-5" />
                    {connectMode ? "Conexão ativa" : "Conectar"}
                  </button>
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
                <span className="ml-auto hidden text-xs text-slate-400 sm:block">
                  Duplo clique para ampliar · Esc para sair da tela cheia
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
                <div
                  ref={viewportRef}
                  className={`relative min-w-0 flex-1 overflow-clip touch-none ${connectMode ? "cursor-crosshair" : moving?.type === "canvas" ? "cursor-grabbing" : "cursor-grab"}`}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={finishPointerMove}
                  onPointerCancel={finishPointerMove}
                  onClick={(event) => {
                    if (event.target === event.currentTarget) {
                      setSelectedNodeId(null);
                      setSelectedEdgeId(null);
                    }
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage:
                        "linear-gradient(rgba(148,163,184,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.10) 1px, transparent 1px), radial-gradient(rgba(148,163,184,.28) 1px, transparent 1px)",
                      backgroundSize: `${Math.max(16, 80 * zoom)}px ${Math.max(16, 80 * zoom)}px`,
                      backgroundPosition: `${pan.x}px ${pan.y}px`,
                    }}
                  />
                  <div
                    className={`absolute left-0 top-0 ${moving ? "" : "motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out"}`}
                    style={{
                      width: Math.max(3600, bounds.right + 200),
                      height: Math.max(2100, bounds.bottom + 200),
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      transformOrigin: "0 0",
                    }}
                  >
                    <svg
                      className="absolute left-0 top-0 overflow-visible"
                      width={Math.max(3600, bounds.right + 200)}
                      height={Math.max(2100, bounds.bottom + 200)}
                      aria-label="Conexões do fluxo"
                      role="group"
                    >
                      <defs>
                        <marker
                          id="flow-arrow"
                          markerWidth="11"
                          markerHeight="11"
                          refX="8"
                          refY="5.5"
                          orient="auto"
                          markerUnits="strokeWidth"
                        >
                          <path
                            d="M1,1 L9,5.5 L1,10"
                            fill="none"
                            stroke="context-stroke"
                            strokeWidth="1.6"
                          />
                        </marker>
                      </defs>
                      {active.edges.map((edge) => {
                        const from = visualNodes.find((item) => item.id === edge.from);
                        const to = visualNodes.find((item) => item.id === edge.to);
                        if (!from || !to) return null;
                        const sameRow =
                          Math.abs(to.y + to.height / 2 - (from.y + from.height / 2)) <
                          Math.max(from.height, to.height) * 0.65;
                        const verticalConnection = verticalFlow && !sameRow;
                        const rightward = to.x + to.width / 2 >= from.x + from.width / 2;
                        const x1 = verticalConnection
                          ? from.x + from.width / 2
                          : from.x + (rightward ? from.width : 0);
                        const y1 = verticalConnection
                          ? from.y + from.height
                          : from.y + from.height / 2;
                        const x2 = verticalConnection
                          ? to.x + to.width / 2
                          : to.x + (rightward ? 0 : to.width);
                        const y2 = verticalConnection ? to.y : to.y + to.height / 2;
                        const curve = Math.max(
                          40,
                          Math.abs(verticalConnection ? y2 - y1 : x2 - x1) * 0.45,
                        );
                        const signedCurve = rightward ? curve : -curve;
                        const path = verticalConnection
                          ? `M ${x1} ${y1} C ${x1} ${y1 + curve}, ${x2} ${y2 - curve}, ${x2} ${y2}`
                          : `M ${x1} ${y1} C ${x1 + signedCurve} ${y1}, ${x2 - signedCurve} ${y2}, ${x2} ${y2}`;
                        const selected = selectedEdgeId === edge.id;
                        const highlighted =
                          selected ||
                          edge.from === highlightedNodeId ||
                          edge.to === highlightedNodeId;
                        return (
                          <g
                            key={edge.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`Editar conexão de ${from.title} para ${to.title}`}
                            onPointerDown={(event) => event.stopPropagation()}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                setSelectedEdgeId(edge.id);
                                setSelectedNodeId(null);
                              }
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedEdgeId(edge.id);
                              setSelectedNodeId(null);
                            }}
                            className="cursor-pointer"
                          >
                            <path d={path} fill="none" stroke="transparent" strokeWidth="20" />
                            <path
                              d={path}
                              fill="none"
                              stroke={highlighted ? "#70b5ff" : "#91a3bd"}
                              strokeWidth={highlighted ? "3" : "1.5"}
                              vectorEffect="non-scaling-stroke"
                              strokeOpacity={highlighted ? "1" : highlightedNodeId ? ".3" : ".8"}
                              strokeDasharray={highlighted ? "8 8" : undefined}
                              markerEnd="url(#flow-arrow)"
                            >
                              {highlighted && (
                                <animate
                                  attributeName="stroke-dashoffset"
                                  from="32"
                                  to="0"
                                  dur="1.2s"
                                  repeatCount="indefinite"
                                  className="motion-reduce:hidden"
                                />
                              )}
                            </path>
                            {edge.label && (
                              <text
                                x={(x1 + x2) / 2}
                                y={(y1 + y2) / 2 - 10}
                                fill="#aebbd0"
                                fontSize="12"
                                textAnchor="middle"
                              >
                                {edge.label}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>

                    {visualNodes.map((item) => {
                      const style = kindStyles[item.kind];
                      const Icon = style.icon;
                      const selected = selectedNodeId === item.id;
                      const customAppearance = item.appearance && item.appearance !== "default";
                      const image = imageFor(item);
                      return (
                        <article
                          key={item.id}
                          aria-label={`Elemento ${item.title || "sem título"}`}
                          data-node-id={item.id}
                          onMouseEnter={() => setHoveredNodeId(item.id)}
                          onMouseLeave={() => setHoveredNodeId(null)}
                          onDoubleClick={(event) => {
                            if ((event.target as HTMLElement).closest("button")) return;
                            event.stopPropagation();
                            if (nodeClickTimerRef.current) clearTimeout(nodeClickTimerRef.current);
                            if (!connectMode) {
                              setSelectedNodeId(item.id);
                              setSelectedEdgeId(null);
                              fitNodes([item.id], item.title);
                            }
                          }}
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return;
                            if (event.key === "Enter") {
                              if (connectMode) connectNodes(item.id);
                              else {
                                setSelectedNodeId(item.id);
                                setSelectedEdgeId(null);
                              }
                            }
                          }}
                          onPointerDown={(event) => startMoveNode(event, item)}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (connectMode) {
                              connectNodes(item.id);
                              return;
                            }
                            if (draggedRef.current) return;
                            if (nodeClickTimerRef.current) clearTimeout(nodeClickTimerRef.current);
                            nodeClickTimerRef.current = setTimeout(() => {
                              setSelectedNodeId(item.id);
                              setSelectedEdgeId(null);
                            }, 240);
                          }}
                          style={{
                            left: item.x,
                            top: item.y,
                            width: item.width,
                            height: item.height,
                            ...(customAppearance
                              ? {
                                  background: item.background ?? "#ffffff",
                                  color:
                                    (item.appearance === "label" || item.appearance === "brand") &&
                                    (!item.textColor || item.textColor === "#17202a")
                                      ? "#e2e8f0"
                                      : (item.textColor ?? "#17202a"),
                                  borderRadius:
                                    item.appearance === "telegram"
                                      ? "50%"
                                      : item.appearance === "account"
                                        ? 3
                                        : 0,
                                  boxShadow: selected
                                    ? "0 0 0 3px #60a5fa"
                                    : item.appearance === "label" || item.appearance === "brand"
                                      ? "none"
                                      : "0 5px 20px #0006",
                                  borderColor: selected
                                    ? "#60a5fa"
                                    : item.appearance === "label" || item.appearance === "brand"
                                      ? "transparent"
                                      : "#b2b7bd",
                                }
                              : {}),
                          }}
                          className={`group absolute z-10 flex flex-col overflow-visible rounded-xl border bg-[#171d29] text-left shadow-[0_10px_26px_rgba(0,0,0,0.35)] transition-[box-shadow,border-color] ${selected ? "border-blue-400 ring-2 ring-blue-400/25" : "border-slate-600/80 hover:border-slate-400"} ${connectionStart === item.id ? "ring-2 ring-emerald-400" : ""} ${connectMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`}
                        >
                          <button
                            aria-label={`Conectar para ${item.title}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (connectionStart) connectNodes(item.id);
                              else {
                                setNotice(
                                  "Escolha primeiro a saída de outro elemento ou use Conectar na barra de ferramentas.",
                                );
                              }
                            }}
                            className={`absolute z-20 size-3 rounded-full border-2 border-slate-400 ${verticalFlow ? "-top-[7px] left-1/2 -translate-x-1/2" : "-left-[7px] top-1/2 -translate-y-1/2"} ${connectMode ? "bg-emerald-400" : "bg-slate-500 opacity-0 group-hover:opacity-100"}`}
                          />
                          <button
                            aria-label={`Conectar a partir de ${item.title}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setConnectionStart(item.id);
                              setConnectMode(true);
                              setNotice("Agora escolha a entrada do próximo elemento.");
                            }}
                            className={`absolute z-20 size-3 rounded-full border-2 border-slate-400 ${verticalFlow ? "-bottom-[7px] left-1/2 -translate-x-1/2" : "-right-[7px] top-1/2 -translate-y-1/2"} ${connectMode ? "bg-emerald-400" : "bg-slate-500 opacity-0 group-hover:opacity-100"}`}
                          />
                          {customAppearance ? (
                            <ReferenceNodeContent node={item} />
                          ) : (
                            <>
                              <div
                                className={`flex items-center gap-2 rounded-t-[11px] border-b border-white/10 px-3 py-2 ${style.color === "sky" ? "bg-sky-500/20" : style.color === "blue" ? "bg-blue-500/20" : style.color === "cyan" ? "bg-cyan-500/20" : style.color === "amber" ? "bg-amber-500/20" : style.color === "violet" ? "bg-violet-500/20" : style.color === "pink" ? "bg-pink-500/20" : style.color === "emerald" ? "bg-emerald-500/20" : "bg-slate-500/15"}`}
                              >
                                <span
                                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${style.color === "sky" ? "bg-sky-400/20 text-sky-300" : style.color === "blue" ? "bg-blue-400/20 text-blue-300" : style.color === "cyan" ? "bg-cyan-400/20 text-cyan-300" : style.color === "amber" ? "bg-amber-400/20 text-amber-300" : style.color === "violet" ? "bg-violet-400/20 text-violet-300" : style.color === "pink" ? "bg-pink-400/20 text-pink-300" : style.color === "emerald" ? "bg-emerald-400/20 text-emerald-300" : "bg-slate-400/15 text-slate-300"}`}
                                >
                                  <Icon className="size-3.5" />
                                </span>
                                <span className="truncate text-[9px] font-bold uppercase tracking-[0.13em] text-slate-300">
                                  {style.label}
                                </span>
                                {selected && <Move className="ml-auto size-3.5 text-slate-500" />}
                              </div>
                              <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
                                <h3 className="line-clamp-2 shrink-0 text-[15px] font-bold leading-5 text-slate-100">
                                  {item.title || "Sem título"}
                                </h3>
                                {item.description && (
                                  <p className="mt-1 line-clamp-2 shrink-0 text-[12px] leading-4 text-slate-400">
                                    {item.description}
                                  </p>
                                )}
                                {item.body && (
                                  <p className="mt-2 min-h-0 overflow-hidden whitespace-pre-wrap rounded-md bg-black/20 p-2 text-[11px] leading-4 text-slate-300">
                                    {item.body}
                                  </p>
                                )}
                                {item.kind === "image" &&
                                  (image ? (
                                    <img
                                      src={image}
                                      alt={item.title}
                                      className="mt-2 min-h-0 w-full flex-1 rounded-md border border-white/10 object-contain"
                                      draggable={false}
                                    />
                                  ) : (
                                    <div className="mt-2 flex h-20 items-center justify-center rounded-md border border-dashed border-slate-600 text-slate-500">
                                      <ImagePlus className="size-5" />
                                    </div>
                                  ))}
                              </div>
                            </>
                          )}
                          <button
                            aria-label={`Redimensionar ${item.title}`}
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              event.currentTarget.setPointerCapture(event.pointerId);
                              setMoving({
                                type: "resize",
                                id: item.id,
                                startX: event.clientX,
                                startY: event.clientY,
                                originX: item.width,
                                originY: item.height,
                              });
                              setResizePreview({
                                id: item.id,
                                width: item.width,
                                height: item.height,
                              });
                            }}
                            className="absolute bottom-0 right-0 flex size-6 cursor-se-resize items-center justify-center text-slate-500 opacity-0 hover:text-blue-300 group-hover:opacity-100"
                          >
                            <Expand className="size-3 rotate-90" />
                          </button>
                        </article>
                      );
                    })}
                  </div>
                  {hoveredNode && !moving && (
                    <div className="pointer-events-none absolute left-4 top-4 z-20 max-w-[300px] rounded-xl border border-blue-400/30 bg-[#151e2d]/95 px-4 py-3 text-sm text-slate-100 shadow-xl backdrop-blur">
                      <p className="font-semibold">{hoveredNode.title}</p>
                      {(hoveredNode.description || hoveredNode.body) && (
                        <p className="mt-1 line-clamp-3 text-xs text-slate-300">
                          {hoveredNode.description || hoveredNode.body}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-blue-300">Duplo clique para ampliar</p>
                    </div>
                  )}
                  <div className="pointer-events-none absolute bottom-3 left-3 mr-3 flex max-w-[calc(100%-24px)] flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#111722]/90 px-3 py-2 text-xs text-slate-300 backdrop-blur md:max-w-[calc(100%-280px)]">
                    <Move className="size-4" />
                    Arraste para mover · Ctrl + roda para zoom · 0 para ver tudo
                    {connectMode && (
                      <span className="text-emerald-300">· Escolha dois pontos para conectar</span>
                    )}
                  </div>
                  <div className="absolute bottom-3 right-3 hidden w-[240px] overflow-hidden rounded-xl border border-white/15 bg-[#111722]/95 shadow-lg backdrop-blur md:block">
                    <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-300">
                      <span>MAPA DO FUNIL</span>
                      <button
                        onClick={fitFlow}
                        className="text-blue-300 hover:text-blue-200"
                        aria-label="Ajustar fluxo completo"
                      >
                        Ver tudo
                      </button>
                    </div>
                    <svg
                      viewBox={`${bounds.left - 70} ${bounds.top - 70} ${bounds.right - bounds.left + 140} ${bounds.bottom - bounds.top + 140}`}
                      preserveAspectRatio="none"
                      className="h-[110px] w-full cursor-pointer"
                      role="button"
                      aria-label="Minimapa: clique para navegar pelo fluxo"
                      tabIndex={0}
                      onPointerDown={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") fitFlow();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        fittedViewRef.current = null;
                        setViewLabel("Visão livre");
                        const rect = event.currentTarget.getBoundingClientRect();
                        const x =
                          bounds.left -
                          70 +
                          ((event.clientX - rect.left) / rect.width) *
                            (bounds.right - bounds.left + 140);
                        const y =
                          bounds.top -
                          70 +
                          ((event.clientY - rect.top) / rect.height) *
                            (bounds.bottom - bounds.top + 140);
                        setPan({
                          x: (viewportRef.current?.clientWidth ?? 800) / 2 - x * zoom,
                          y: (viewportRef.current?.clientHeight ?? 500) / 2 - y * zoom,
                        });
                      }}
                    >
                      {active.edges.map((edge) => {
                        const a = visualNodes.find((item) => item.id === edge.from);
                        const b = visualNodes.find((item) => item.id === edge.to);
                        return a && b ? (
                          <line
                            key={edge.id}
                            x1={a.x + a.width / 2}
                            y1={a.y + a.height / 2}
                            x2={b.x + b.width / 2}
                            y2={b.y + b.height / 2}
                            stroke="#586a84"
                            strokeWidth="9"
                          />
                        ) : null;
                      })}
                      {visualNodes.map((item) => (
                        <rect
                          key={item.id}
                          x={item.x}
                          y={item.y}
                          width={item.width}
                          height={item.height}
                          rx="14"
                          fill={
                            selectedNodeId === item.id
                              ? "#86b3ff"
                              : (item.background ??
                                (item.kind === "end"
                                  ? "#32bd87"
                                  : item.kind === "offer"
                                    ? "#bc963a"
                                    : "#3c648b"))
                          }
                        />
                      ))}
                      <rect
                        x={-pan.x / zoom}
                        y={-pan.y / zoom}
                        width={(viewportRef.current?.clientWidth ?? 800) / zoom}
                        height={(viewportRef.current?.clientHeight ?? 500) / zoom}
                        fill="rgba(112,156,255,.07)"
                        stroke="#8db9ff"
                        strokeWidth="10"
                      />
                    </svg>
                    <p className="px-2 py-1 text-[9px] tabular-nums text-slate-500">
                      {active.nodes.length} elementos · {active.edges.length} conexões
                    </p>
                  </div>
                </div>

                {(selectedNode || selectedEdge) && (
                  <aside
                    className="absolute inset-y-0 right-0 z-30 flex w-full flex-col border-l border-slate-700 bg-[#141a25] shadow-2xl sm:relative sm:w-[320px] sm:shrink-0"
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
                            className="mt-1.5 w-full rounded-lg border border-slate-600 bg-[#0d1119] px-3 py-2.5 text-xs text-white outline-none focus:border-blue-400"
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
                            className="mt-1.5 w-full rounded-lg border border-slate-600 bg-[#0d1119] px-3 py-2.5 text-xs text-white outline-none focus:border-blue-400"
                          >
                            <option value="default">Cartão com detalhes</option>
                            <option value="solid">Bloco colorido</option>
                            <option value="label">Título de seção</option>
                            <option value="telegram">Telegram</option>
                            <option value="account">Conta ou campanha</option>
                            <option value="brand">Marca em texto</option>
                          </select>
                        </label>
                        {selectedNode.appearance && selectedNode.appearance !== "default" && (
                          <div className="grid grid-cols-2 gap-3">
                            <label className="text-[11px] font-semibold text-slate-300">
                              Cor de fundo
                              <input
                                type="color"
                                value={
                                  selectedNode.background?.startsWith("#")
                                    ? selectedNode.background
                                    : "#ffffff"
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
                                value={selectedNode.textColor ?? "#17202a"}
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
                                className="mt-1.5 w-full rounded-lg border border-slate-600 bg-[#0d1119] px-3 py-2.5 text-xs text-white"
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
                                className="mt-1.5 w-full rounded-lg border border-slate-600 bg-[#0d1119] px-3 py-2.5 text-xs text-white"
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
                            className="mt-1.5 w-full rounded-lg border border-slate-600 bg-[#0d1119] px-3 py-2.5 text-xs text-white outline-none focus:border-blue-400"
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
                            className="mt-1.5 w-full resize-y rounded-lg border border-slate-600 bg-[#0d1119] px-3 py-2.5 text-xs leading-5 text-white outline-none focus:border-blue-400"
                          />
                        </label>
                        {selectedNode.kind !== "image" && (
                          <label className="block text-[11px] font-semibold text-slate-300">
                            Texto e anotações
                            <textarea
                              value={selectedNode.body}
                              onChange={(event) =>
                                updateNode(selectedNode.id, { body: event.target.value })
                              }
                              rows={5}
                              placeholder="Adicione informações, links ou próximos passos"
                              className="mt-1.5 w-full resize-y rounded-lg border border-slate-600 bg-[#0d1119] px-3 py-2.5 text-xs leading-5 text-white outline-none focus:border-blue-400"
                            />
                          </label>
                        )}
                        {selectedNode.kind === "image" && (
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
                                  });
                                }}
                                placeholder="https://..."
                                className="mt-1.5 w-full rounded-lg border border-slate-600 bg-[#0d1119] px-3 py-2.5 text-xs text-white outline-none focus:border-blue-400"
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
                              <img
                                src={imageFor(selectedNode)}
                                alt={selectedNode.title}
                                className="max-h-48 w-full rounded-lg border border-slate-700 object-contain"
                              />
                            )}
                          </div>
                        )}
                        <div className="rounded-xl border border-slate-700 bg-[#0d1119]/70 p-3">
                          <div className="mb-2 flex items-center justify-between text-[10px] font-semibold text-slate-300">
                            <span>Tamanho do elemento</span>
                            <span>
                              {selectedNode.width} × {selectedNode.height}
                            </span>
                          </div>
                          <label className="block text-[10px] text-slate-400">
                            Largura
                            <input
                              type="range"
                              min="32"
                              max="1600"
                              step="1"
                              value={selectedNode.width}
                              onChange={(event) =>
                                updateNode(selectedNode.id, { width: Number(event.target.value) })
                              }
                              className="mt-1 w-full accent-blue-400"
                            />
                          </label>
                          <label className="mt-3 block text-[10px] text-slate-400">
                            Altura
                            <input
                              type="range"
                              min="32"
                              max="1200"
                              step="1"
                              value={selectedNode.height}
                              onChange={(event) =>
                                updateNode(selectedNode.id, { height: Number(event.target.value) })
                              }
                              className="mt-1 w-full accent-blue-400"
                            />
                          </label>
                        </div>
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
                              className="mt-1 w-full rounded-lg border border-slate-600 bg-[#0d1119] px-2.5 py-2 text-xs text-white"
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
                              className="mt-1 w-full rounded-lg border border-slate-600 bg-[#0d1119] px-2.5 py-2 text-xs text-white"
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
                            className="mt-1.5 w-full rounded-lg border border-slate-600 bg-[#0d1119] px-3 py-2.5 text-xs text-white outline-none focus:border-blue-400"
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
                  Arraste elementos para organizar. Use “Conectar” e selecione dois pontos para
                  ligar etapas.
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
          {editingTarget && (
            <FunnelDetailsDialog
              key={editingTarget.id}
              funnel={editingTarget}
              onClose={() => setEditingFunnelId(null)}
              onSave={updateFunnelMetadata}
            />
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
