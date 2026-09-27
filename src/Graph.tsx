import { memo, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  type NodeProps,
  type EdgeProps,
  type Node,
  type Edge,
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
    Icon = icons[n.kind] ?? CornerDownRight;
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
      className={`graph-card ${n.siteIds.length ? 'call-card' : ''} ${n.kind === 'BRANCH' ? 'branch-card' : ''} ${n.raw.kind === 'ENTRY' ? 'entry-card' : ''} ${selected ? 'is-selected' : ''} ${data.dim ? 'dim' : ''}`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="card-meta">
        <span>
          <Icon size={13} />
          {n.siteIds.length
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
          <span>{n.siteIds.length ? `${data.candidates ?? 0} candidatos` : '→'}</span>
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
  focusIds?: Set<string>;
  witnessIds?: Set<string>;
  onReady?: () => void;
}) {
  const flow = useReactFlow();
  const [layout, setLayout] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null),
    [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setBusy(true);
    setError('');
    const elk = new ELK({ workerUrl: elkWorkerUrl });
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const ready = (data: { nodes: any[]; edges: any[] }) => {
      if (!active) return;
      const positions = new Map<string, any>(data.nodes.map((n: any) => [n.id, n])),
        routes = new Map<string, any>(data.edges.map((e: any) => [e.id, e]));
      setLayout({
        nodes: visibleNodes.map((n) => ({
          id: n.id,
          type: 'cobol',
          position: { x: positions.get(n.id)?.x ?? 0, y: positions.get(n.id)?.y ?? 0 },
          data: {
            node: n,
            onSelect,
            paragraph: model.paragraphs.find((p) => p.id === n.paragraph)?.title,
            candidates: model.sites
              .filter((s) => n.siteIds.includes(s.id))
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
                ? '#278778'
                : e.kind === 'BRANCH_FALSE'
                  ? '#b57d37'
                  : '#91a0b7',
          },
          style: {
            stroke:
              e.kind === 'BRANCH_TRUE'
                ? '#278778'
                : e.kind === 'BRANCH_FALSE'
                  ? '#b57d37'
                  : '#91a0b7',
            strokeWidth: 1.5,
            strokeDasharray: e.kind === 'OPAQUE_JUMP' ? '5 4' : undefined,
          },
        })),
      });
      setBusy(false);
      timer = setTimeout(() => {
        if (selected && positions.has(selected)) {
          const pt = positions.get(selected);
          void flow.setCenter(pt.x + 140, pt.y + 66, { zoom: 0.85, duration: 0 });
        } else if (visibleNodes.length > 30) {
          const first = visibleNodes.find((n) => n.raw.kind === 'ENTRY') ?? visibleNodes[0];
          const pt = positions.get(first?.id);
          if (pt) void flow.setCenter(pt.x + 140, pt.y + 240, { zoom: 0.85, duration: 0 });
        } else void flow.fitView({ padding: 0.15, minZoom: 0.3, maxZoom: 0.95 });
        onReady?.();
      }, 80);
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
      clearTimeout(timer);
    };
  }, [model, visibleNodes, visibleEdges]);
  useEffect(() => {
    if (!selected || busy || !layout) return;
    const n = layout.nodes.find((n) => n.id === selected);
    if (n)
      void flow.setCenter(n.position.x + 140, n.position.y + 66, {
        zoom: Math.max(0.75, flow.getZoom()),
        duration: 250,
      });
  }, [selected, layout, busy]);
  const graphNodes = (layout?.nodes ?? []).map((n) => ({
    ...n,
    selected: n.id === selected,
    data: {
      ...n.data,
      dim:
        (highlightCalls && !(n.data.node as GraphNode).siteIds.length) ||
        (focusIds && !focusIds.has(n.id)),
    },
  }));
  const graphEdges = (layout?.edges ?? []).map((e) => ({
    ...e,
    style: {
      ...e.style,
      strokeWidth: witnessIds?.has(e.id) ? 3 : e.style?.strokeWidth,
      stroke: witnessIds?.has(e.id) ? '#5869d7' : e.style?.stroke,
      opacity: witnessIds?.size && !witnessIds.has(e.id) ? 0.25 : 1,
    },
  }));
  return (
    <div
      className="graph-surface"
      aria-label="Grafo de controle"
      data-testid="graph"
      aria-busy={busy}
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
        onNodeClick={(_, n) => onSelect(n.id)}
        minZoom={0.025}
        maxZoom={2}
        onlyRenderVisibleElements
        fitView={false}
      >
        <Background color="#cbd3df" gap={22} size={1} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => ((n.data.node as GraphNode)?.siteIds.length ? '#6373d5' : '#b6c2d3')}
          maskColor="rgba(235,240,247,.72)"
        />
        <Controls showInteractive={false} />
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
          <i className="legend-branch" />
          Decisão
        </span>
        <span>Arraste para navegar · role para ampliar</span>
      </div>
    </div>
  );
}
