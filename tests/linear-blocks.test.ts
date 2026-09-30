import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { admitFiles } from '../src/artifacts';
import { buildModel, entryGraph, type GraphNode, type GraphEdge } from '../src/model';
import { linearBlocks, blockExpanded, blockRoute } from '../src/linear-blocks';

const node = (id: string, changes: Partial<GraphNode> = {}): GraphNode => ({
  id,
  raw: {},
  operations: [],
  statements: [],
  title: `MOVE ${id}`,
  subtitle: '',
  kind: 'JUMP',
  open: false,
  contexts: 1,
  contextIndex: 1,
  siteIds: [],
  fileSiteIds: [],
  unit: 'program',
  paragraph: 'paragraph',
  ...changes,
});
const edge = (
  source: string,
  target: string,
  kind = 'JUMP',
  id = `${source}-${target}`,
): GraphEdge => ({
  id,
  source,
  target,
  kind,
  entry: 'main',
  raw: {},
});
const ids = (nodes: GraphNode[], edges: GraphEdge[], full?: GraphEdge[]) =>
  linearBlocks(nodes, edges, full).map((b) => b.nodes.map((n) => n.id));

describe('linear presentation blocks', () => {
  it('groups maximal sequences through entry and operations, ending at a decision', () => {
    const nodes = [
      node('entry', { kind: 'ENTRY' }),
      node('a'),
      node('b'),
      node('c'),
      node('branch', { kind: 'BRANCH' }),
      node('call', { kind: 'INVOKE', siteIds: ['call'] }),
      node('exit', { kind: 'RETURN' }),
    ];
    const edges = [
      edge('entry', 'a', 'ENTRY'),
      edge('a', 'b'),
      edge('b', 'c'),
      edge('c', 'branch'),
      edge('branch', 'call', 'BRANCH_TRUE'),
      edge('branch', 'exit', 'BRANCH_FALSE'),
      edge('call', 'exit', 'INVOKE_NORMAL'),
    ];
    expect(ids(nodes, edges)).toEqual([['entry', 'a', 'b', 'c', 'branch']]);
    expect(linearBlocks(nodes, edges)[0].edges.map((e) => e.id)).toEqual([
      'entry-a',
      'a-b',
      'b-c',
      'c-branch',
    ]);
  });
  it('does not hide joins, parallel alternatives or branches removed by a scope', () => {
    const nodes = ['a', 'b', 'c', 'd', 'e'].map((id) => node(id));
    const full = [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd'), edge('d', 'e')];
    expect(ids(nodes, full)).toEqual([['d', 'e']]);
    expect(ids([nodes[0], nodes[1], nodes[3]], [full[0], full[2]], full)).toEqual([]);
    expect(
      ids(nodes.slice(0, 2), [edge('a', 'b', 'JUMP', 'one'), edge('a', 'b', 'JUMP', 'two')]),
    ).toEqual([]);
  });
  it.each([
    { kind: 'INVOKE' },
    { kind: 'RETURN' },
    { siteIds: ['call'] },
    { fileSiteIds: ['file'] },
    { paragraph: 'other' },
  ])('does not invent a boundary for an operation or paragraph: %j', (changes) => {
    expect(
      ids(
        [node('a'), node('b', changes), node('c')],
        [edge('a', 'b'), edge('b', 'c', 'INVOKE_NORMAL')],
      ),
    ).toEqual([['a', 'b', 'c']]);
  });
  it('keeps different units separate and terminates a group at an open control frontier', () => {
    expect(ids([node('a'), node('b', { unit: 'other' })], [edge('a', 'b')])).toEqual([]);
    expect(
      ids([node('a'), node('b', { open: true }), node('c')], [edge('a', 'b'), edge('b', 'c')]),
    ).toEqual([['a', 'b']]);
  });
  it('keeps both normal and exceptional alternatives, even when they reach the same node', () => {
    expect(
      ids(
        [node('a'), node('b')],
        [edge('a', 'b', 'INVOKE_NORMAL'), edge('a', 'b', 'EXCEPTION', 'exception')],
      ),
    ).toEqual([]);
  });
  it('retains the closing edge of cycles and never merges equal source titles across CFG contexts', () => {
    const nodes = ['a', 'b', 'a2', 'b2'].map((id) => node(id, { title: 'MOVE A TO B' }));
    const cycle = linearBlocks(nodes, [edge('a', 'b'), edge('b', 'a')]);
    expect(cycle.map((b) => b.nodes.map((n) => n.id))).toEqual([['a', 'b']]);
    expect(cycle[0].edges.map((e) => e.id)).toEqual(['a-b']);
    expect(ids(nodes, [edge('a', 'b'), edge('a2', 'b2')])).toEqual([
      ['a', 'b'],
      ['a2', 'b2'],
    ]);
  });
  it('uses hysteresis and always exposes selected/evidence members', () => {
    expect(blockExpanded(true, 139)).toBe(false);
    expect(blockExpanded(false, 160)).toBe(false);
    expect(blockExpanded(true, 160)).toBe(true);
    expect(blockExpanded(false, 181)).toBe(true);
    expect(blockExpanded(false, 1, true)).toBe(true);
  });
  it('connects existing directed routes through hidden card interiors without changing inputs', () => {
    const parts = [
      [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: -20, z: 0 },
      ],
      [
        { x: 10, y: -100, z: 0 },
        { x: 10, y: -120, z: 0 },
      ],
    ];
    const before = JSON.stringify(parts);
    const points = blockRoute(parts);
    expect(points[0]).toEqual(parts[0][0]);
    expect(points.at(-1)).toEqual(parts[1].at(-1));
    expect(points.every((p, i) => !i || p.x === points[i - 1].x || p.y === points[i - 1].y)).toBe(
      true,
    );
    expect(JSON.stringify(parts)).toBe(before);
  });
});

for (const example of ['order-router', 'large', 'perform', 'goto', 'carddemo-coactupc']) {
  it(`preserves the original control and identities in ${example}`, async () => {
    const raw = gunzipSync(
      readFileSync(new URL(`../public/examples/${example}.json.gz`, import.meta.url)),
    ).toString();
    const model = buildModel(await admitFiles({ 'bundle.json': raw }));
    const scope = entryGraph(model, model.entries[0].id);
    const before = JSON.stringify({ nodes: scope.nodes.map((n) => n.raw), edges: scope.edges });
    const blocks = linearBlocks(scope.nodes, scope.edges, model.edges);
    const members = new Set(blocks.flatMap((b) => b.nodes.map((n) => n.id)));
    const internal = new Set(blocks.flatMap((b) => b.edges.map((e) => e.id)));
    expect(members.size).toBe(blocks.reduce((sum, b) => sum + b.nodes.length, 0));
    expect(internal.size).toBe(members.size - blocks.length);
    for (const block of blocks) {
      for (let i = 0; i < block.edges.length; i++) {
        expect(block.edges[i].source).toBe(block.nodes[i].id);
        expect(block.edges[i].target).toBe(block.nodes[i + 1].id);
        expect(scope.edges.filter((e) => e.source === block.nodes[i].id)).toHaveLength(1);
        expect(scope.edges.filter((e) => e.target === block.nodes[i + 1].id)).toHaveLength(1);
      }
    }
    expect(JSON.stringify({ nodes: scope.nodes.map((n) => n.raw), edges: scope.edges })).toBe(
      before,
    );
    expect(blocks.length).toBeGreaterThan(0);
    console.log(
      `${example}: ${scope.nodes.length} nós, ${blocks.length} blocos, ${members.size} membros; ${scope.nodes.length - members.size + blocks.length} caixas`,
    );
  }, 15000);
}
