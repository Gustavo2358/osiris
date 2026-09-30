import type { GraphEdge, GraphNode } from './model';
import type { Point3D } from './graph3d';

// Presentation groups only: every member and transition keeps its published identity.
export type LinearBlock = { id: string; nodes: GraphNode[]; edges: GraphEdge[] };
export const BLOCK_EXPAND_PX = 180;
export const BLOCK_COLLAPSE_PX = 140;

export function linearBlocks(
  nodes: GraphNode[],
  edges: GraphEdge[],
  fullEdges: GraphEdge[] = edges,
): LinearBlock[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const entries = new Set(edges.map((e) => e.entry));
  const incoming = new Map<string, GraphEdge[]>();
  const outgoing = new Map<string, GraphEdge[]>();
  for (const edge of fullEdges) {
    if (!entries.has(edge.entry)) continue;
    const inputs = incoming.get(edge.target) ?? [];
    inputs.push(edge);
    incoming.set(edge.target, inputs);
    const outputs = outgoing.get(edge.source) ?? [];
    outputs.push(edge);
    outgoing.set(edge.source, outputs);
  }
  const next = new Map<string, GraphEdge>();
  const previous = new Set<string>();
  for (const edge of edges) {
    const a = byId.get(edge.source),
      b = byId.get(edge.target);
    if (
      !a ||
      !b ||
      a === b ||
      a.open ||
      a.unit !== b.unit ||
      outgoing.get(a.id)?.length !== 1 ||
      incoming.get(b.id)?.length !== 1
    )
      continue;
    next.set(a.id, edge);
    previous.add(b.id);
  }
  const visited = new Set<string>();
  const blocks: LinearBlock[] = [];
  const collect = (head: GraphNode) => {
    if (visited.has(head.id) || !next.has(head.id)) return;
    const members = [head],
      internal: GraphEdge[] = [];
    visited.add(head.id);
    let current = head;
    while (next.has(current.id)) {
      const edge = next.get(current.id)!;
      if (visited.has(edge.target)) break;
      current = byId.get(edge.target)!;
      members.push(current);
      internal.push(edge);
      visited.add(current.id);
    }
    if (members.length > 1)
      blocks.push({ id: `linear:${head.id}`, nodes: members, edges: internal });
  };
  for (const head of nodes) if (!previous.has(head.id)) collect(head);
  // Preserve the closing edge of a pure cycle as a self-loop on the summary.
  for (const head of nodes) collect(head);
  return blocks;
}

export function blockExpanded(expanded: boolean, pixels: number, forced = false) {
  if (forced) return true;
  return expanded ? pixels >= BLOCK_COLLAPSE_PX : pixels > BLOCK_EXPAND_PX;
}

// Concatenate existing directed routes through hidden card interiors. This is
// geometry for the block's outgoing edge, not a new transition in the model.
export function blockRoute(parts: Point3D[][]): Point3D[] {
  const result: Point3D[] = [];
  for (const part of parts) {
    for (const p of part) {
      const last = result.at(-1);
      if (last?.x === p.x && last.y === p.y && last.z === p.z) continue;
      if (last && last.x !== p.x && last.y !== p.y) result.push({ x: last.x, y: p.y, z: 0 });
      result.push({ ...p });
    }
  }
  return result;
}
