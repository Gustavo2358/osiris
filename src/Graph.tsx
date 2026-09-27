import { memo, useEffect, useState, useRef, type RefObject } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  ControlButton,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  type NodeProps,
  type EdgeProps,
  type Node,
  type Edge,
  type Viewport,
  MarkerType,
} from '@xyflow/react';
import {
  GitBranch,
  PhoneOutgoing,
  CornerDownRight,
  Play,
  CircleStop,
  Focus,
  LoaderCircle,
  FolderOpen,
} from 'lucide-react';
import ELK from 'elkjs/lib/elk-api.js';
import elkWorkerUrl from 'elkjs/lib/elk-worker.min.js?url';
import type { GraphNode, GraphEdge, Model } from './model';
import '@xyflow/react/dist/style.css';
const icons: Record<string, typeof GitBranch> = {
  BRANCH: GitBranch,
  INVOKE: PhoneOutgoing,
  ENTRY: Play,
  NORMAL_EXIT: CircleStop,
  HALT: CircleStop,
  RETURN: CornerDownRight,
};
const Card = memo(({ data, selected }: NodeProps) => {
  const n = data.node as GraphNode,
    Icon = n.fileSiteIds.length ? FolderOpen : (icons[n.kind] ?? CornerDownRight);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={n.title}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          (data.onSelect as (id: string) => void)(n.id);
        }
      }}
      className={`graph-card ${n.fileSiteIds.length ? 'file-card' : n.siteIds.length ? 'call-card' : ''} ${n.kind === 'BRANCH' ? 'branch-card' : ''} ${n.raw.kind === 'ENTRY' ? 'entry-card' : ''} ${selected ? 'is-selected' : ''} ${data.dim ? 'dim' : ''}`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="card-meta">
        <span>
          <Icon size={13} />
          {n.fileSiteIds.length
            ? 'ARQUIVO'
            : n.siteIds.length
              ? 'CHAMADA'
              : n.kind === 'BRANCH'
                ? 'DECISÃO'
                : n.raw.kind === 'ENTRY'
                  ? 'ENTRADA'
                  : (data.paragraph as string) || 'FLUXO'}
        </span>
        <span>{n.location ? `L${n.location.startLine}` : ''}</span>
      </div>
      <div className="card-title" title={n.title}>
        {n.title}
      </div>
      <div className="card-footer">
        <span>
          {n.contexts > 1
            ? `Contexto ${n.contextIndex}/${n.contexts}`
            : n.statements.length > 1
              ? `${n.statements.length} statements`
              : 'COBOL'}
        </span>
        {n.open ? (
          <span className="open-dot">controle aberto</span>
        ) : (
          <span>
            {n.fileSiteIds.length
              ? `${data.candidates ?? 0} valores possíveis`
              : n.siteIds.length
                ? `${data.candidates ?? 0} candidatos`
                : '→'}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
});
function RoutedEdge({
  id,
  data,
  markerEnd,
  style,
  label,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps) {
  const sections = (data?.sections ?? []) as any[];
  const path = sections.length
    ? sections
        .map((s) => {
          const points = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
          return points.map((p: any, i: number) => `${i ? 'L' : 'M'} ${p.x},${p.y}`).join(' ');
        })
        .join(' ')
    : `M${sourceX},${sourceY} L${targetX},${targetY}`;
  const section = sections[0];
  const point = section?.bendPoints?.[0] ?? section?.startPoint ?? { x: sourceX, y: sourceY };
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <span
            className="edge-label"
            style={{
              transform: `translate(-50%, -50%) translate(${point.x}px,${point.y + 22}px)`,
              color: style?.stroke,
            }}
          >
            {label}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
const nodeTypes = { cobol: Card },
  edgeTypes = { routed: RoutedEdge };
const labels: Record<string, string> = {
  BRANCH_TRUE: 'Sim',
  BRANCH_FALSE: 'Não',
  INVOKE_NORMAL: 'retorno',
  OPAQUE_JUMP: 'conhecido',
  RETURN: 'retorno',
};
export function Graph({
  model,
  visibleNodes,
  visibleEdges,
  selected,
  onSelect,
  highlightCalls,
  highlightFiles = false,
  viewportRef,
  restoreView,
  focusIds,
  witnessIds,
  onReady,
}: {
  model: Model;
  visibleNodes: GraphNode[];
  visibleEdges: GraphEdge[];
  selected?: string;
  onSelect: (id: string) => void;
  highlightCalls: boolean;
  highlightFiles?: boolean;
  viewportRef?: RefObject<Viewport | undefined>;
  restoreView?: { id: number; viewport: Viewport };
  focusIds?: Set<string>;
  witnessIds?: Set<string>;
  onReady?: () => void;
}) {
  const flow = useReactFlow();
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    let previous = { width: element.clientWidth, height: element.clientHeight };
    const observer = new ResizeObserver(([record]) => {
      const { width, height } = record.contentRect;
      if (previous.width && previous.height && width && height) {
        const view = flow.getViewport();
        void flow.setViewport(
          {
            ...view,
            x: view.x + (width - previous.width) / 2,
            y: view.y + (height - previous.height) / 2,
          },
          { duration: 0 },
        );
      }
      previous = { width, height };
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [flow]);
  const appliedRestore = useRef(0);
  const initializedModel = useRef<Model | undefined>(undefined);
  const [viewportReady, setViewportReady] = useState(false);
  const [layout, setLayout] = useState<{ nodes: Node[]; edges: Edge[]; input: GraphNode[] } | null>(
      null,
    ),
    [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setBusy(true);
    setViewportReady(false);
    setError('');
    const elk = new ELK({ workerUrl: elkWorkerUrl });
    let active = true;
    const ready = (data: { nodes: any[]; edges: any[] }) => {
      if (!active) return;
      const positions = new Map<string, any>(data.nodes.map((n: any) => [n.id, n])),
        routes = new Map<string, any>(data.edges.map((e: any) => [e.id, e]));
      setLayout({
        input: visibleNodes,
        nodes: visibleNodes.map((n) => ({
          id: n.id,
          type: 'cobol',
          position: { x: positions.get(n.id)?.x ?? 0, y: positions.get(n.id)?.y ?? 0 },
          data: {
            node: n,
            onSelect,
            paragraph: model.paragraphs.find((p) => p.id === n.paragraph)?.title,
            candidates: [...model.sites, ...model.fileSites]
              .filter((s) => n.siteIds.includes(s.id) || n.fileSiteIds.includes(s.id))
              .reduce((a, s) => a + s.candidates.length, 0),
          },
          width: 280,
          height: 132,
          ariaLabel: n.title,
        })),
        edges: visibleEdges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'routed',
          data: { ...routes.get(e.id) },
          label: labels[e.kind],
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color:
              e.kind === 'BRANCH_TRUE'
                ? '#65d9b4'
                : e.kind === 'BRANCH_FALSE'
                  ? '#ffc578'
                  : '#a6b8d1',
          },
          style: {
            stroke:
              e.kind === 'BRANCH_TRUE'
                ? '#65d9b4'
                : e.kind === 'BRANCH_FALSE'
                  ? '#ffc578'
                  : '#a6b8d1',
            strokeWidth: 1.5,
            strokeDasharray: e.kind === 'OPAQUE_JUMP' ? '5 4' : undefined,
          },
        })),
      });
      setBusy(false);
    };
    elk
      .layout({
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'DOWN',
          'elk.spacing.nodeNode': '60',
          'elk.layered.spacing.nodeNodeBetweenLayers': '70',
          'elk.edgeRouting': 'ORTHOGONAL',
          'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
        },
        children: visibleNodes.map((n) => ({ id: n.id, width: 280, height: 132 })),
        edges: visibleEdges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
      })
      .then((graph) => ready({ nodes: graph.children ?? [], edges: graph.edges ?? [] }))
      .catch((e) => {
        if (active) {
          setError(`Falha no layout: ${e.message}`);
          setBusy(false);
        }
      });
    return () => {
      active = false;
      elk.terminateWorker();
    };
  }, [model, visibleNodes, visibleEdges]);
  useEffect(() => {
    if (busy || !layout || layout.input !== visibleNodes) return;
    const timer = setTimeout(() => {
      const firstView = initializedModel.current !== model;
      initializedModel.current = model;
      if (restoreView && appliedRestore.current !== restoreView.id) {
        appliedRestore.current = restoreView.id;
        void flow.setViewport(restoreView.viewport, { duration: 0 });
      } else {
        const n = layout.nodes.find((n) => n.id === selected);
        if (n)
          void flow.setCenter(n.position.x + 140, n.position.y + 66, {
            zoom: firstView ? 0.85 : flow.getZoom(),
            duration: 0,
          });
        else if (visibleNodes.length > 30) {
          const first =
            layout.nodes.find((n) => (n.data.node as GraphNode).raw.kind === 'ENTRY') ??
            layout.nodes[0];
          if (first)
            void flow.setCenter(first.position.x + 140, first.position.y + 240, {
              zoom: 0.85,
              duration: 0,
            });
        } else void flow.fitView({ padding: 0.15, minZoom: 0.3, maxZoom: 0.95 });
      }
      setViewportReady(true);
      onReady?.();
    }, 80);
    return () => clearTimeout(timer);
  }, [selected, layout, busy, restoreView, visibleNodes]);
  const currentLayout = layout?.input === visibleNodes ? layout : null;
  const graphNodes = (currentLayout?.nodes ?? []).map((n) => ({
    ...n,
    selected: n.id === selected,
    data: {
      ...n.data,
      onSelect,
      dim:
        (highlightCalls && !(n.data.node as GraphNode).siteIds.length) ||
        (highlightFiles && !(n.data.node as GraphNode).fileSiteIds.length) ||
        (focusIds && !focusIds.has(n.id)),
    },
  }));
  const graphEdges = (currentLayout?.edges ?? []).map((e) => ({
    ...e,
    style: {
      ...e.style,
      strokeWidth: witnessIds?.has(e.id) ? 3 : e.style?.strokeWidth,
      stroke: witnessIds?.has(e.id) ? '#b6acff' : e.style?.stroke,
      opacity: witnessIds?.size && !witnessIds.has(e.id) ? 0.25 : 1,
    },
  }));
  return (
    <div
      ref={surface}
      className="graph-surface"
      aria-label="Grafo de controle"
      data-testid="graph"
      aria-busy={busy || !viewportReady || !currentLayout}
    >
      <ReactFlow
        nodes={graphNodes}
        edges={graphEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesFocusable={false}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        deleteKeyCode={null}
        onMove={(_, viewport) => {
          if (viewportRef) viewportRef.current = viewport;
        }}
        onInit={(instance) => {
          if (viewportRef) viewportRef.current = instance.getViewport();
        }}
        onNodeClick={(_, n) => onSelect(n.id)}
        minZoom={0.025}
        maxZoom={2}
        onlyRenderVisibleElements
        fitView={false}
        ariaLabelConfig={{
          'controls.zoomIn.ariaLabel': 'Aumentar zoom',
          'controls.zoomOut.ariaLabel': 'Diminuir zoom',
          'controls.fitView.ariaLabel': 'Enquadrar recorte',
          'controls.ariaLabel': 'Navegação do grafo',
          'minimap.ariaLabel': 'Minimapa do programa',
        }}
      >
        <Background color="#344255" gap={24} size={1} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) =>
            (n.data.node as GraphNode)?.fileSiteIds.length
              ? '#238a83'
              : (n.data.node as GraphNode)?.siteIds.length
                ? '#6373d5'
                : '#b6c2d3'
          }
          maskColor="rgba(12,22,37,.7)"
        />
        <Controls showInteractive={false}>
          <ControlButton
            aria-label="Centralizar seleção"
            title="Centralizar seleção"
            disabled={!selected || !currentLayout?.nodes.some((n) => n.id === selected)}
            onClick={() => {
              const n = currentLayout?.nodes.find((n) => n.id === selected);
              if (n)
                void flow.setCenter(n.position.x + 140, n.position.y + 66, {
                  zoom: flow.getZoom(),
                  duration: 0,
                });
            }}
          >
            <Focus size={16} />
          </ControlButton>
        </Controls>
      </ReactFlow>
      {busy && (
        <div className="layout-status" role="status">
          <LoaderCircle className="spin" size={16} /> Organizando {visibleNodes.length} trechos…
        </div>
      )}
      {error && (
        <div className="layout-status error" role="alert">
          {error}
        </div>
      )}
      {!busy && !visibleNodes.length && (
        <div className="graph-empty">
          <Focus />
          <h3>Nenhum caminho conhecido</h3>
          <p>O CFG não publica um caminho desta entrada até a seleção.</p>
        </div>
      )}
      <div className="graph-legend">
        <span>
          <i className="legend-flow" />
          Fluxo
        </span>
        <span>
          <i className="legend-call" />
          Chamada
        </span>
        <span>
          <i className="legend-file" />
          Arquivo
        </span>
        <span>
          <i className="legend-branch" />
          Decisão
        </span>
        <span>Arraste para navegar · role para ampliar</span>
      </div>
    </div>
  );
}
