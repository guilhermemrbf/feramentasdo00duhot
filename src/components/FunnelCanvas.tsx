import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Handle,
  Position,
  ConnectionMode,
  MarkerType,
  NodeResizer,
  NodeToolbar,
  applyNodeChanges,
  applyEdgeChanges,
  useStore,
  type Node,
  type Edge,
  type NodeProps,
  type NodeChange,
  type EdgeChange,
  type ReactFlowInstance,
  type XYPosition,
} from "@xyflow/react";
import { ImagePlus, Instagram, Music2, Plus, Send, Shapes, StickyNote, X } from "lucide-react";
import { canConnect, edgeHandles } from "@/lib/funnel-connections";
import type { FlowEdge, FlowNode, FlowNodeKind, Funnel } from "@/lib/funnel-model";
import "@xyflow/react/dist/style.css";
import "./funnel-canvas.css";

type CanvasNode = Node<
  {
    node: FlowNode;
    image?: string;
    onResize: (id: string, patch: Partial<FlowNode>) => void;
    onNext: (id: string) => void;
    onImage: (node: FlowNode, file: File) => void;
  },
  "funnel"
>;
export type FunnelCanvasApi = ReactFlowInstance<CanvasNode, Edge>;
export type AddAt = { position?: XYPosition; from?: string; sourceHandle?: string };
type Props = {
  funnel: Funnel;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  imageSources: Record<string, string>;
  onSelect: (nodeId: string | null, edgeId: string | null) => void;
  onUpdateNode: (id: string, patch: Partial<FlowNode>) => void;
  onConnect: (edge: Omit<FlowEdge, "id">) => void;
  onAdd: (kind: FlowNodeKind, title: string, at?: AddAt) => FlowNode | undefined;
  onImage: (node: FlowNode, file: File) => void;
  onReconnect: (id: string, edge: Omit<FlowEdge, "id">) => void;
  onReady: (api: FunnelCanvasApi) => void;
  onZoom: (zoom: number) => void;
  onNavigate: () => void;
  onFocus: (id: string) => void;
  initialViewport?: { x: number; y: number; zoom: number };
};
const quickKinds = [
  { kind: "page" as const, title: "Novo bloco", label: "Bloco", Icon: Shapes },
  { kind: "text" as const, title: "Nova anotação", label: "Texto", Icon: StickyNote },
  { kind: "image" as const, title: "Nova imagem", label: "Imagem", Icon: ImagePlus },
];
const ports = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
];

const FunnelNode = memo(function FunnelNode({ data, selected, id }: NodeProps<CanvasNode>) {
  const node = data.node;
  const zoom = useStore((store) => Math.round(store.transform[2] * 10) / 10);
  const account = node.appearance === "account";
  const transparent = node.appearance === "label" || node.appearance === "brand";
  const custom = node.appearance && node.appearance !== "default";
  const foreground = node.textColor ?? (custom && !transparent ? "#17202a" : "#e2e8f0");
  const color =
    transparent &&
    (!node.background || node.background === "transparent") &&
    foreground === "#17202a"
      ? "#e2e8f0"
      : foreground;
  return (
    <article
      data-node-id={id}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        const file = event.dataTransfer.files[0];
        if (file) {
          event.preventDefault();
          event.stopPropagation();
          data.onImage(node, file);
        }
      }}
      className={`funnel-node ${selected ? "is-selected" : ""} ${zoom < 0.35 ? "is-compact" : ""}`}
      style={{
        background: node.background ?? (transparent ? "transparent" : "#172337"),
        color,
        borderRadius: node.appearance === "telegram" ? "50%" : custom ? 6 : 14,
        borderColor: transparent && !selected ? "transparent" : undefined,
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={32}
        minHeight={32}
        maxWidth={1600}
        maxHeight={1200}
        color="#60a5fa"
        onResizeEnd={(_, size) =>
          data.onResize(id, {
            width: Math.round(size.width),
            height: Math.round(size.height),
            x: size.x,
            y: size.y,
          })
        }
      />
      {ports.map((port) => (
        <Handle
          key={port.id}
          id={port.id}
          type="source"
          position={port.position}
          aria-label={`Conectar ${node.title}: ${port.id}`}
          title="Arraste para outro bloco"
          className="funnel-port"
          style={{
            width: Math.min(48, Math.max(16, 14 / Math.max(zoom, 0.1))),
            height: Math.min(48, Math.max(16, 14 / Math.max(zoom, 0.1))),
          }}
        />
      ))}
      {data.image ? (
        <div className="flex size-full flex-col overflow-hidden rounded-[inherit]">
          <img
            src={data.image}
            alt={node.title}
            draggable={false}
            className="min-h-0 flex-1"
            style={{ objectFit: node.imageFit ?? "cover" }}
          />
          <div className="shrink-0 space-y-1 px-4 py-3">
            <h3 className="text-xl font-bold leading-tight">{node.title}</h3>
            {node.description && (
              <p className="line-clamp-3 text-sm leading-5">{node.description}</p>
            )}
            {node.body && (
              <p className="line-clamp-3 whitespace-pre-wrap text-sm opacity-80">{node.body}</p>
            )}
          </div>
        </div>
      ) : node.appearance === "telegram" ? (
        <div className="flex size-full items-center justify-center" title={node.title}>
          <Send className="size-[60%]" fill="currentColor" strokeWidth={1} />
          <span className="sr-only">{node.title}</span>
        </div>
      ) : account ? (
        <div className="flex size-full flex-col items-center justify-center gap-1 overflow-hidden px-1 py-2">
          <b className="text-2xl">{node.displayLabel || node.title}</b>
          {node.platform === "instagram" ? (
            <Instagram className="size-7" />
          ) : node.platform === "tiktok" ? (
            <Music2 className="size-7" />
          ) : node.platform === "x" ? (
            <b className="text-2xl">X</b>
          ) : null}
          {zoom >= 0.5 && node.description && (
            <p className="line-clamp-3 text-center text-[10px]">{node.description}</p>
          )}
        </div>
      ) : transparent ? (
        <div className="flex size-full items-center overflow-hidden px-2">
          <h3
            style={{ fontSize: node.appearance === "brand" ? 54 : 36 }}
            className="font-extrabold leading-tight"
          >
            {node.title}
          </h3>
        </div>
      ) : (
        <div className="flex size-full flex-col justify-center gap-2 overflow-hidden px-4 py-3">
          {!custom && (
            <span className="text-[11px] font-bold uppercase tracking-widest opacity-60">
              {node.kind === "text"
                ? "Anotação"
                : node.kind === "image"
                  ? "Imagem"
                  : "Etapa do fluxo"}
            </span>
          )}
          <h3
            className={`whitespace-pre-wrap break-words font-bold leading-[1.2] ${custom ? "text-center text-[30px]" : "text-xl"}`}
          >
            {node.title}
          </h3>
          {node.description && (
            <p
              className={`line-clamp-4 whitespace-pre-wrap leading-snug ${custom ? "text-center text-base" : "text-sm"}`}
            >
              {node.description}
            </p>
          )}
          {node.body && (
            <p className="line-clamp-5 whitespace-pre-wrap text-sm leading-5 opacity-80">
              {node.body}
            </p>
          )}
          {node.kind === "image" && (
            <div className="flex min-h-12 flex-1 items-center justify-center rounded-lg border border-dashed border-current/25 opacity-50">
              <ImagePlus className="size-8" />
            </div>
          )}
        </div>
      )}
      <NodeToolbar isVisible={selected} position={Position.Bottom} offset={16}>
        <button
          onClick={(event) => {
            event.stopPropagation();
            data.onNext(id);
          }}
          className="nodrag nopan flex items-center gap-2 rounded-xl border border-blue-400/40 bg-[#172337] px-3 py-2 text-sm font-semibold text-blue-200 shadow-lg"
        >
          <Plus className="size-4" />
          Próximo bloco
        </button>
      </NodeToolbar>
    </article>
  );
});
const nodeTypes = { funnel: FunnelNode };

export function FunnelCanvas({
  funnel,
  selectedNodeId,
  selectedEdgeId,
  imageSources,
  onSelect,
  onUpdateNode,
  onConnect,
  onAdd,
  onImage,
  onReconnect,
  onReady,
  onZoom,
  onNavigate,
  onFocus,
  initialViewport,
}: Props) {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number; at: AddAt } | null>(null);
  const apiRef = useRef<FunnelCanvasApi | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const addNext = useCallback(
    (id: string) => {
      const source = funnel.nodes.find((node) => node.id === id);
      if (!source) return;
      const vertical = funnel.direction === "vertical";
      onAdd("page", "Novo bloco", {
        from: id,
        sourceHandle: vertical ? "bottom" : "right",
        position: {
          x: source.x + (vertical ? 0 : source.width + 150),
          y: source.y + (vertical ? source.height + 150 : 0),
        },
      });
    },
    [funnel.nodes, funnel.direction, onAdd],
  );

  useEffect(() => {
    setNodes((previous) =>
      funnel.nodes.map((node) => {
        const existing = previous.find((item) => item.id === node.id);
        return {
          ...existing,
          id: node.id,
          type: "funnel",
          position: existing?.dragging ? existing.position : { x: node.x, y: node.y },
          width: node.width,
          height: node.height,
          style: { width: node.width, height: node.height },
          selected: node.id === selectedNodeId,
          data: {
            node,
            image: node.imageKey ? imageSources[node.imageKey] : node.imageUrl,
            onResize: onUpdateNode,
            onNext: addNext,
            onImage,
          },
        };
      }),
    );
  }, [funnel.nodes, selectedNodeId, imageSources, onUpdateNode, addNext, onImage]);
  useEffect(() => {
    const focus = hovered ?? selectedNodeId;
    setEdges(
      funnel.edges.map((edge) => ({
        id: edge.id,
        source: edge.from,
        target: edge.to,
        ...edgeHandles(funnel, edge),
        label: edge.label,
        type: "default",
        selected: edge.id === selectedEdgeId,
        animated: edge.id === selectedEdgeId,
        style: {
          stroke:
            edge.id === selectedEdgeId || edge.from === focus || edge.to === focus
              ? "#79bcff"
              : "#889bb5",
          strokeWidth: edge.id === selectedEdgeId ? 3 : 1.5,
        },
        interactionWidth: 24,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#889bb5", width: 14, height: 14 },
        labelStyle: { fill: "#e2e8f0", fontSize: 14 },
        labelBgStyle: { fill: "#172337" },
      })),
    );
  }, [funnel, selectedNodeId, selectedEdgeId, hovered]);

  const openMenu = (clientX: number, clientY: number, from?: string, sourceHandle?: string) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const api = apiRef.current;
    if (!rect || !api) return;
    setMenu({
      x: Math.max(8, Math.min(clientX - rect.left, rect.width - 240)),
      y: Math.max(8, Math.min(clientY - rect.top, rect.height - 240)),
      at: { position: api.screenToFlowPosition({ x: clientX, y: clientY }), from, sourceHandle },
    });
  };
  return (
    <div
      ref={containerRef}
      className="funnel-canvas relative size-full"
      aria-label="Quadro interativo do funil"
      onDragOver={(event) => {
        if (
          event.dataTransfer.types.includes("application/00duhot-node") ||
          event.dataTransfer.types.includes("Files")
        ) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        const position = apiRef.current?.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        if (!position) return;
        const file = event.dataTransfer.files[0];
        if (file?.type.startsWith("image/")) {
          const node = onAdd("image", file.name, { position });
          if (node) onImage(node, file);
          return;
        }
        try {
          const payload = JSON.parse(event.dataTransfer.getData("application/00duhot-node"));
          if (
            ["page", "text", "image", "decision", "end"].includes(payload.kind) &&
            typeof payload.title === "string"
          )
            onAdd(payload.kind, payload.title, { position });
        } catch {
          /* Ignore unrelated drops. */
        }
      }}
    >
      <ReactFlow<CanvasNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode="dark"
        style={{ background: "#0d1119" }}
        onNodesChange={useCallback(
          (changes: NodeChange<CanvasNode>[]) =>
            setNodes((current) => applyNodeChanges(changes, current)),
          [],
        )}
        onEdgesChange={useCallback(
          (changes: EdgeChange[]) => setEdges((current) => applyEdgeChanges(changes, current)),
          [],
        )}
        onInit={(api) => {
          apiRef.current = api;
          onReady(api);
        }}
        defaultViewport={initialViewport}
        fitView={!initialViewport}
        fitViewOptions={{ padding: 0.15, maxZoom: 0.9 }}
        minZoom={0.04}
        maxZoom={3}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        panOnScroll={false}
        panOnDrag={[0, 1]}
        panActivationKeyCode="Space"
        selectionKeyCode="Shift"
        multiSelectionKeyCode={null}
        deleteKeyCode={null}
        nodeDragThreshold={5}
        connectionMode={ConnectionMode.Loose}
        connectOnClick
        connectionRadius={48}
        autoPanOnConnect
        autoPanOnNodeDrag
        isValidConnection={(connection) => canConnect(funnel, connection.source, connection.target)}
        onConnect={(connection) =>
          onConnect({
            from: connection.source,
            to: connection.target,
            sourceHandle: connection.sourceHandle ?? undefined,
            targetHandle: connection.targetHandle ?? undefined,
          })
        }
        onConnectStart={() => {
          setMenu(null);
          onSelect(null, null);
        }}
        onReconnect={(edge, connection) =>
          onReconnect(edge.id, {
            from: connection.source,
            to: connection.target,
            sourceHandle: connection.sourceHandle ?? undefined,
            targetHandle: connection.targetHandle ?? undefined,
          })
        }
        onConnectEnd={(event, state) => {
          if (state.isValid || !state.fromNode || state.toNode) return;
          const pointer = "changedTouches" in event ? event.changedTouches[0] : event;
          openMenu(
            pointer.clientX,
            pointer.clientY,
            state.fromNode.id,
            state.fromHandle?.id ?? undefined,
          );
        }}
        onNodeDragStop={(_, node) =>
          onUpdateNode(node.id, {
            x: Math.max(0, node.position.x),
            y: Math.max(0, node.position.y),
          })
        }
        onNodeClick={(_, node) => {
          setMenu(null);
          onSelect(node.id, null);
        }}
        onNodeDoubleClick={(_, node) => {
          onSelect(node.id, null);
          onFocus(node.id);
        }}
        onEdgeClick={(_, edge) => {
          setMenu(null);
          onSelect(null, edge.id);
        }}
        onNodeMouseEnter={(_, node) => setHovered(node.id)}
        onNodeMouseLeave={() => setHovered(null)}
        onPaneClick={(event) => {
          onSelect(null, null);
          setMenu(null);
          if (event.detail === 2) openMenu(event.clientX, event.clientY);
        }}
        onPaneContextMenu={(event) => {
          event.preventDefault();
          openMenu(event.clientX, event.clientY);
        }}
        onMoveStart={(event) => {
          if (event) {
            setMenu(null);
            onNavigate();
          }
        }}
        onMove={(_, viewport) => onZoom(viewport.zoom)}
        aria-label="Fluxo: arraste o fundo para navegar, use a roda para zoom e arraste os pontos para conectar"
      >
        <Background
          id="grid"
          variant={BackgroundVariant.Lines}
          gap={80}
          color="#263246"
          bgColor="transparent"
          lineWidth={1}
        />
        <Background
          id="dots"
          variant={BackgroundVariant.Dots}
          gap={20}
          color="#334155"
          bgColor="transparent"
          size={1}
        />
        <MiniMap<CanvasNode>
          pannable
          zoomable
          position="bottom-right"
          className="!h-[120px] !w-[190px] !rounded-xl !border !border-slate-700 !bg-[#111722] max-sm:!hidden"
          nodeColor={(node) => node.data.node.background ?? "#3c648b"}
          maskColor="#070d16b0"
          ariaLabel="Mapa do funil: arraste ou use a roda para navegar"
        />
      </ReactFlow>
      <div className="pointer-events-none absolute bottom-3 left-3 max-w-[calc(100%-24px)] rounded-xl border border-white/10 bg-[#111722]/90 px-3 py-2 text-xs text-slate-300 sm:max-w-[calc(100%-240px)]">
        Roda: zoom · Fundo: mover · Bloco: editar · Pontos: arraste para conectar
      </div>
      {menu && (
        <div
          role="dialog"
          aria-label="Adicionar ao fluxo"
          className="nodrag nopan absolute z-50 w-[230px] rounded-2xl border border-slate-600 bg-[#172337] p-3 shadow-2xl"
          style={{ left: menu.x, top: menu.y }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setMenu(null);
            }
          }}
        >
          <div className="mb-2 flex items-center justify-between text-sm font-bold text-white">
            <span>{menu.at.from ? "Próxima etapa" : "Adicionar ao fluxo"}</span>
            <button aria-label="Fechar adição rápida" onClick={() => setMenu(null)}>
              <X className="size-4" />
            </button>
          </div>
          {quickKinds.map(({ kind, title, label, Icon }) => (
            <button
              key={kind}
              autoFocus={kind === "page"}
              onClick={() => {
                onAdd(kind, title, menu.at);
                setMenu(null);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-200 hover:bg-blue-500/20"
            >
              <Icon className="size-5 text-blue-300" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
