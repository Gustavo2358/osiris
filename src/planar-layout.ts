import type { ELK, ElkNode } from 'elkjs/lib/elk-api.js';
import { CARD_WIDTH, CARD_HEIGHT } from './graph-dimensions';
import type { Point3D } from './graph3d';
export type LayoutInput = {
  nodes: string[];
  links: { id: string; source: string; target: string }[];
};
export type PlanarLayout = {
  nodes: (Point3D & { id: string })[];
  routes: { id: string; points: Point3D[] }[];
};

// Geometry only: ELK handles cycles and parallel edges without changing the published CFG.
export async function planarLayout(input: LayoutInput, elk: ELK): Promise<PlanarLayout> {
  if (!input.nodes.length) return { nodes: [], routes: [] };
  const result = await elk.layout<ElkNode>({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': '48',
      'elk.layered.spacing.nodeNodeBetweenLayers': '64',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.randomSeed': '1',
    },
    children: input.nodes.map((id) => ({ id, width: CARD_WIDTH, height: CARD_HEIGHT })),
    edges: input.links.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  });
  const point = (p: { x: number; y: number }): Point3D => ({
    x: p.x - (result.width ?? 0) / 2,
    y: (result.height ?? 0) / 2 - p.y,
    z: 0,
  });
  return {
    nodes: (result.children ?? []).map((n) => ({
      id: n.id,
      ...point({ x: n.x! + CARD_WIDTH / 2, y: n.y! + CARD_HEIGHT / 2 }),
    })),
    routes: (result.edges ?? []).map((e) => {
      // Our input uses binary edges; each published edge must have its own continuous section.
      if (e.sections?.length !== 1) throw new Error(`Rota ausente ou descontínua: ${e.id}`);
      const section = e.sections[0];
      return {
        id: e.id,
        points: [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map(point),
      };
    }),
  };
}
