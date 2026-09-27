import { it, expect } from 'vitest';
// The bundled Node build computes locally; there is no native Worker to terminate.
import ELK from 'elkjs/lib/elk.bundled.js';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { admitFiles } from '../src/artifacts';
import { buildModel } from '../src/model';
import { planarLayout, type LayoutInput, type PlanarLayout } from '../src/planar-layout';
import { CARD_WIDTH, CARD_HEIGHT } from '../src/graph-dimensions';
import { pointOnRoute, routeLength } from '../src/routed-link';

function check(input: LayoutInput, layout: PlanarLayout) {
  expect(layout.nodes.map((n) => n.id).sort()).toEqual([...input.nodes].sort());
  expect(layout.routes.map((e) => e.id).sort()).toEqual(input.links.map((e) => e.id).sort());
  expect(layout.nodes.every((n) => n.z === 0 && Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(
    true,
  );
  for (const a of layout.nodes)
    for (const b of layout.nodes) {
      if (a.id >= b.id) continue;
      expect(Math.abs(a.x - b.x) >= CARD_WIDTH || Math.abs(a.y - b.y) >= CARD_HEIGHT).toBe(true);
    }
  const nodes = new Map(layout.nodes.map((n) => [n.id, n]));
  const links = new Map(input.links.map((e) => [e.id, e]));
  for (const route of layout.routes) {
    const edge = links.get(route.id)!;
    for (const [p, id] of [
      [route.points[0], edge.source],
      [route.points.at(-1)!, edge.target],
    ] as const) {
      const n = nodes.get(id)!;
      const dx = Math.abs(p.x - n.x),
        dy = Math.abs(p.y - n.y);
      // Routed endpoints touch the correct card boundary, including back edges and self loops.
      expect(
        (Math.abs(dx - CARD_WIDTH / 2) < 1e-6 && dy <= CARD_HEIGHT / 2 + 1e-6) ||
          (Math.abs(dy - CARD_HEIGHT / 2) < 1e-6 && dx <= CARD_WIDTH / 2 + 1e-6),
      ).toBe(true);
    }
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1],
        b = route.points[i];
      expect(a.z).toBe(0);
      expect(b.z).toBe(0);
      expect(Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6).toBe(true);
    }
    const lengths = routeLength(route.points);
    expect(lengths.at(-1)).toBeGreaterThan(0);
    expect(pointOnRoute(route.points, lengths, 0)).toMatchObject(route.points[0]);
    expect(pointOnRoute(route.points, lengths, 1)).toMatchObject(route.points.at(-1)!);
  }
}
for (const example of ['order-router', 'cycle', 'perform', 'cics']) {
  it(`planar routes preserve ${example}, with nonoverlapping cards and directed orthogonal paths`, async () => {
    const raw = gunzipSync(
      readFileSync(new URL(`../public/examples/${example}.json.gz`, import.meta.url)),
    ).toString();
    const m = buildModel(await admitFiles({ 'bundle.json': raw }));
    const input = {
      nodes: m.nodes.map((n) => n.id),
      links: m.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    };
    const before = JSON.stringify(input);
    const elk = new ELK();
    const layout = await planarLayout(input, elk);
    check(input, layout);
    expect(JSON.stringify(input)).toBe(before);
    expect(await planarLayout(input, elk)).toEqual(layout);
  });
}
it('keeps parallel alternatives and self loops as separately routed edges', async () => {
  const input = {
    nodes: ['a', 'b', 'isolated'],
    links: [
      { id: 'true', source: 'a', target: 'b' },
      { id: 'false', source: 'a', target: 'b' },
      { id: 'loop', source: 'b', target: 'b' },
    ],
  };
  const elk = new ELK();
  const layout = await planarLayout(input, elk);
  check(input, layout);
  expect(layout.routes[0].points).not.toEqual(layout.routes[1].points);
});
it('particles traverse the corners rather than cutting across the orthogonal route', () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 20, z: 0 },
    { x: 60, y: 20, z: 0 },
  ];
  const lengths = routeLength(points);
  expect(pointOnRoute(points, lengths, 0.125)).toMatchObject({ x: 0, y: 10, z: 0 });
  expect(pointOnRoute(points, lengths, 0.25)).toMatchObject({ x: 0, y: 20, z: 0 });
  expect(pointOnRoute(points, lengths, 0.5)).toMatchObject({ x: 20, y: 20, z: 0 });
});
