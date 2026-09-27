import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { admitFiles, sha256, type Documents } from '../src/artifacts';
import {
  buildModel,
  canonical,
  idKey,
  cfgKey,
  pathsTo,
  sourceText,
  traverse,
  type Model,
  type GraphEdge,
} from '../src/model';
const bundle = (name = 'order-router') =>
  JSON.parse(
    gunzipSync(
      readFileSync(new URL(`../public/examples/${name}.json.gz`, import.meta.url)),
    ).toString(),
  );
async function docs(name = 'order-router') {
  return admitFiles({ 'bundle.json': JSON.stringify(bundle(name)) });
}
async function model(name = 'order-router') {
  return buildModel(await docs(name));
}
const index = JSON.parse(
  readFileSync(new URL('../public/examples/index.json', import.meta.url), 'utf8'),
);
describe('Real analyzer artifacts', () => {
  for (const ex of index)
    it(`preserves all published nodes, edges, links and candidates: ${ex.id}`, async () => {
      const m = await model(ex.id);
      expect(m.nodes).toHaveLength(ex.nodes);
      expect(m.edges).toHaveLength(ex.edges);
      expect(m.edges.map((e) => e.raw)).toEqual(m.documents.cfg.transitions);
      expect(m.fileSites.map((s) => s.raw)).toEqual(
        m.documents.dependencies!.fileDependencies?.sites ?? [],
      );
      expect(m.fileSites).toHaveLength(ex.fileSites ?? 0);
      expect(m.sites.filter((s) => !s.sourceOnly)).toHaveLength(ex.sites);
      for (const site of m.documents.dependencies!.sites) {
        const s = m.sites.find(
          (s) =>
            s.operation === idKey(site.operation, 'operation') &&
            s.entry === idKey(site.entry, 'entry'),
        )!;
        expect(s).toBeDefined();
        expect(s.candidates).toEqual(site.candidates);
        expect(s.raw).toEqual(site);
      }
      for (const link of m.documents.links!.statements) {
        const nodes = m.operationNodes.get(idKey(link.target, 'operation'));
        expect(nodes?.length).toBeGreaterThan(0);
        for (const id of nodes!)
          expect(
            m.nodeById
              .get(id)!
              .statements.some(
                (s) =>
                  s.id === link.source.handle && canonical(s.unit) === canonical(link.source.unit),
              ),
          ).toBe(true);
      }
      expect(m.documents.cfg.sourceKnowledge.publicationInventory).toBe('PARTIAL');
    });
  it('presents full COBOL tokens and paragraph names from source provenance', async () => {
    const m = await model();
    expect(m.nodes.some((n) => n.title === "CALL 'AUDITLOG'")).toBe(true);
    expect(m.nodes.some((n) => n.title === 'CALL WS-SERVICE')).toBe(true);
    expect(m.paragraphs.map((p) => p.title)).toContain('VALIDATE-ORDER.');
  });
  it('CALL literal candidate retains its actual producer and origin', async () => {
    const m = await model();
    const s = m.sites.find((s) => s.title === "CALL 'AUDITLOG'")!;
    expect(s.candidates.map((c) => c.referenceName)).toEqual(['AUDITLOG']);
    const support = s.candidates[0].supports[0];
    expect(support.kind).toBe('CALL_LITERAL');
    expect(idKey(support.producer, 'operation')).toBe(s.operation);
    expect(
      m.locations(support.origin).some((l) => l.file === 'ORDER-ROUTER.cbl' && l.startLine === 21),
    ).toBe(true);
  });
  it('CICS commands preserve LINK vs XCTL and its open control remainder', async () => {
    const m = await model('cics');
    expect(m.sites.map((s) => s.command).sort()).toEqual(['LINK', 'LINK', 'XCTL']);
    const s = m.sites.find((s) => s.command === 'XCTL')!;
    expect(s.candidates.map((c) => c.referenceName)).toEqual(['MENU']);
    expect(s.raw.openControlRemainder).toBe(true);
  });
  it('PERFORM repeated contexts stay distinct and do not gain return edges', async () => {
    const m = await model('perform');
    const copies = m.nodes.filter((n) => n.title === "MOVE 'PROGA' TO WS-A");
    expect(copies.length).toBeGreaterThanOrEqual(2);
    expect(new Set(copies.map((n) => n.id)).size).toBe(copies.length);
    expect(m.edges).toHaveLength(9);
    const calls = m.sites.sort(
      (a, b) => (a.statement?.location?.startLine ?? 0) - (b.statement?.location?.startLine ?? 0),
    );
    const first = pathsTo(m, m.entries[0].id, calls[0].nodeIds);
    expect(calls[1].nodeIds.some((id) => first.nodes.has(id))).toBe(false);
  });
  it('GO TO path includes real branch alternatives and no inferred source-order edge', async () => {
    const m = await model('goto'),
      result = pathsTo(m, m.entries[0].id, m.sites[0].nodeIds);
    expect(result.reachable).toBe(true);
    expect(result.edges.some((e) => e.kind === 'BRANCH_TRUE')).toBe(true);
    expect(result.edges.some((e) => e.kind === 'BRANCH_FALSE')).toBe(true);
    expect(result.nodes.has(m.nodes.find((n) => n.kind === 'NORMAL_EXIT')!.id)).toBe(false);
  });
  it('COPY statements use copybook provenance without matching a line in main', async () => {
    const m = await model('copy');
    expect(m.sites.some((s) => s.statement?.location?.file === 'CALLPART.cpy')).toBe(true);
    expect(m.sites.some((s) => s.title === "CALL 'AUDIT'")).toBe(true);
  });
  it('nested units retain independent same-spelling paragraphs and statement IDs', async () => {
    const m = await model('nested');
    expect(m.entries).toHaveLength(2);
    expect(new Set(m.statements.keys()).size).toBe(m.statements.size);
    for (const e of m.entries) {
      const site = m.sites.find((s) => s.entry === e.id)!;
      const other = m.sites.find((s) => s.entry !== e.id)!;
      expect(pathsTo(m, e.id, site.nodeIds).reachable).toBe(true);
      expect(pathsTo(m, e.id, other.nodeIds).reachable).toBe(false);
    }
  });
  it('large graph query finishes without enumerating exponentially many paths', async () => {
    const m = await model('large');
    expect(m.nodes).toHaveLength(503);
    const start = performance.now();
    for (const site of m.sites) {
      const result = pathsTo(m, m.entries[0].id, site.nodeIds);
      expect(result.reachable).toBe(true);
    }
    expect(performance.now() - start).toBeLessThan(5000);
  });
  it('dynamic targets preserve path-sensitive producer results and unknown remainders', async () => {
    const m = await model('goto');
    expect(m.sites[0].candidates.map((c) => c.referenceName).sort()).toEqual(['OTHER', 'PROGA']);
    expect(m.sites[0].raw.effectiveUnknownRemainder).toBe(true);
    const c = await model('cics');
    const dynamic = c.sites.find((s) => s.raw.targetKind === 'COMPUTED')!;
    expect(dynamic.candidates.map((c) => c.referenceName).sort()).toEqual(['DETAIL', 'SUMMARY']);
    expect(dynamic.candidates.every((c) => c.supports.length > 0)).toBe(true);
  });
  it('real GO TO loop has a finite backwards slice without a fabricated return', async () => {
    const m = await model('cycle');
    const r = pathsTo(m, m.entries[0].id, m.sites[0].nodeIds);
    expect(r.reachable).toBe(true);
    expect(r.edges.some((e) => e.kind === 'RETURN')).toBe(false);
    expect(r.nodes.size).toBeLessThanOrEqual(m.nodes.length);
    expect(r.edges.some((e) => e.kind === 'INVOKE_NORMAL')).toBe(true);
  });
  it('PERFORM UNTIL keeps real branch alternatives and the call after the loop', async () => {
    const m = await model('until');
    const r = pathsTo(m, m.entries[0].id, m.sites[0].nodeIds);
    expect(r.reachable).toBe(true);
    expect(r.edges.some((e) => e.kind === 'BRANCH_TRUE')).toBe(true);
    expect(r.edges.some((e) => e.kind === 'BRANCH_FALSE')).toBe(true);
  });
  it('does not interpret source lines, array order or opaque IDs to recover flow', async () => {
    const d = await docs();
    const before = buildModel(d);
    d.cfg.nodes.reverse();
    d.cfg.transitions.reverse();
    d.air.publication.units[0].sequences.reverse();
    d.sources = {};
    const after = buildModel(d);
    const a = pathsTo(before, before.entries[0].id, before.sites[0].nodeIds),
      b = pathsTo(after, after.entries[0].id, before.sites[0].nodeIds);
    expect([...a.nodes].sort()).toEqual([...b.nodes].sort());
    expect(a.edges.map((e) => JSON.stringify(e.raw)).sort()).toEqual(
      b.edges.map((e) => JSON.stringify(e.raw)).sort(),
    );
  });
});
describe('Admission and identity isolation', () => {
  it('never collapses local IDs across domains or owners', () => {
    const a = { publication: 'p', unit: 'u', localId: 'x' };
    expect(idKey(a, 'operation')).not.toBe(idKey(a, 'label'));
    expect(idKey({ ...a, unit: 'v' }, 'operation')).not.toBe(idKey(a, 'operation'));
    expect(idKey({ ...a, publication: 'q' }, 'operation')).not.toBe(idKey(a, 'operation'));
    expect(idKey({ ...a, owner: { kind: 'entry', localId: 'e' } }, 'operand')).not.toBe(
      idKey({ ...a, owner: { kind: 'operation', localId: 'e' } }, 'operand'),
    );
    expect(idKey({ domain: 'operation', ...a })).toBe(idKey(a, 'operation'));
  });
  it('rejects a mismatched publication', async () => {
    const b = bundle();
    const cfg = JSON.parse(b.artifacts['cfg.json']);
    cfg.publication.localId = 'wrong';
    b.artifacts['cfg.json'] = JSON.stringify(cfg);
    await expect(admitFiles({ 'x.json': JSON.stringify(b) })).rejects.toThrow(
      'publicações diferentes',
    );
  });
  it('rejects modified SP bytes even when local IDs look identical', async () => {
    const b = bundle();
    b.artifacts['sp.json'] += ' ';
    await expect(admitFiles({ 'x.json': JSON.stringify(b) })).rejects.toThrow('Hash');
  });
  it('rejects unknown CFG version', async () => {
    const b = bundle();
    const cfg = JSON.parse(b.artifacts['cfg.json']);
    cfg.schemaVersion = '99.0.0';
    b.artifacts['cfg.json'] = JSON.stringify(cfg);
    await expect(admitFiles({ 'x.json': JSON.stringify(b) })).rejects.toThrow('Versão');
  });
  it('rejects dangling edges and duplicate nodes', async () => {
    let d = await docs();
    d.cfg.transitions[0].to.ordinal = '999999';
    expect(() => buildModel(d)).toThrow('ausente');
    d = await docs();
    d.cfg.nodes.push(d.cfg.nodes[0]);
    expect(() => buildModel(d)).toThrow('duplicada');
  });
  it('rejects forged StatementLink label instead of repairing it', async () => {
    const d = await docs();
    d.links!.statements[0].label = d.links!.statements.find(
      (l: any) => canonical(l.label) !== canonical(d.links!.statements[0].label),
    ).label;
    expect(() => buildModel(d)).toThrow('sequence incorreta');
  });
  it('does not attach SP to AIR without typed links', async () => {
    const b = bundle();
    delete b.artifacts['links.json'];
    const m = buildModel(await admitFiles({ 'x.json': JSON.stringify(b) }));
    expect(m.nodes.every((n) => n.statements.length === 0)).toBe(true);
    expect(m.warnings.some((w) => w.includes('sem links'))).toBe(true);
  });
  it('AIR + CFG alone is usable and does not invent dependency candidates', async () => {
    const b = bundle();
    const d = await admitFiles({
      'air.json': b.artifacts['air.json'],
      'cfg.json': b.artifacts['cfg.json'],
    });
    const m = buildModel(d);
    expect(m.nodes).toHaveLength(16);
    expect(m.sites.every((s) => s.candidates.length === 0)).toBe(true);
  });
  it('rejects truncated JSON and multiple artifacts for one role', async () => {
    await expect(admitFiles({ 'bad.json': '{"schema":' })).rejects.toThrow('JSON inválido');
    const b = bundle();
    await expect(
      admitFiles({ 'a.json': b.artifacts['air.json'], 'b.json': b.artifacts['air.json'] }),
    ).rejects.toThrow('Mais de um');
  });
  it('slices source by Unicode scalar columns, not UTF-16 offsets', () => {
    expect(
      sourceText(
        {
          file: 'x',
          startLine: 1,
          endLine: 1,
          startColumn: 2,
          endColumn: 5,
          exact: true,
          endExclusive: false,
        },
        { x: '😀 CALL X' },
      ),
    ).toBe('CALL');
  });
});
function smallGraph(): Model {
  const edge = (
    source: string,
    target: string,
    entry = 'e',
    kind = 'JUMP',
    suffix = '',
  ): GraphEdge => ({ id: source + target + suffix, source, target, entry, kind, raw: {} });
  const nodes = ['start', 'left', 'right', 'loop', 'target', 'dead', 'other'].map((id) => ({
    id,
    open: id === 'loop',
  }));
  return {
    edges: [
      edge('start', 'left'),
      edge('start', 'right'),
      edge('left', 'loop'),
      edge('loop', 'left'),
      edge('left', 'target', 'e', 'BRANCH_TRUE', 'T'),
      edge('left', 'target', 'e', 'BRANCH_FALSE', 'F'),
      edge('dead', 'target'),
      edge('right', 'other', 'other-entry'),
    ],
    nodes,
    nodeById: new Map(nodes.map((n) => [n.id, n])),
    entries: [{ id: 'e', nodeId: 'start' }],
  } as unknown as Model;
}
describe('Known-control query laws', () => {
  it('intersects reverse reachability with forward reachability and activationEntry', () => {
    const r = pathsTo(smallGraph(), 'e', ['target']);
    expect([...r.nodes].sort()).toEqual(['left', 'loop', 'start', 'target']);
    expect(r.hasOpenControl).toBe(true);
    expect(r.edges.filter((e) => e.target === 'target')).toHaveLength(2);
    expect(r.witness.map((e) => e.source)).toEqual(['start', 'left']);
  });
  it('cycles terminate; disconnected and unreachable targets remain distinct from unknown runtime', () => {
    const m = smallGraph();
    expect(pathsTo(m, 'e', ['dead']).reachable).toBe(false);
    expect(pathsTo(m, 'e', ['dead']).nodes.size).toBe(0);
    expect(pathsTo(m, 'e', ['other']).reachable).toBe(false);
  });
  it('handles zero-length entry path and no fabricated edge', () => {
    const r = pathsTo(smallGraph(), 'e', ['start']);
    expect([...r.nodes]).toEqual(['start']);
    expect(r.witness).toEqual([]);
    expect(r.reachable).toBe(true);
  });
});

describe('Legacy wire versions from real producers', () => {
  it('v1 preserves the minimal entry → GOBACK → exit path', async () => {
    const m = await model('minimal');
    expect(m.documents.cfg.schemaVersion).toBe('1.0.0');
    expect(m.edges.map((e) => e.kind)).toEqual(['ENTRY', 'RETURN']);
    expect(m.sites).toHaveLength(0);
    const target = m.nodes.find((n) => n.kind === 'NORMAL_EXIT')!;
    expect(pathsTo(m, m.entries[0].id, [target.id]).witness.map((e) => e.kind)).toEqual([
      'ENTRY',
      'RETURN',
    ]);
  });
  it('v3 keeps OPAQUE facts and requires its explicit open-control flag', async () => {
    const d = await docs('partial'),
      m = buildModel(d);
    expect(d.cfg.schemaVersion).toBe('3.0.0');
    expect(m.nodes.find((n) => n.kind === 'OPAQUE')!.title).toBe('DISPLAY WS-A');
    expect(m.edges.some((e) => e.kind === 'OPAQUE_JUMP')).toBe(true);
    delete d.cfg.nodes.find((n: any) => n.kind === 'SEQUENCE').terminator.openControlRemainder;
    expect(() => buildModel(d)).toThrow('openControlRemainder');
  });
});

describe('FILE projection from real analyzer runs', () => {
  it('preserves FILE candidates, raw values, SYSID and typed operation joins', async () => {
    const m = await model('files-values');
    expect(m.sites).toHaveLength(0);
    expect(m.fileSites).toHaveLength(1);
    const site = m.fileSites[0];
    expect(site.candidates.map((c) => c.referenceName)).toEqual(['ACCOUNTS', 'CUSTOMER']);
    expect(site.raw.context.candidates.map((c: any) => c.referenceName)).toEqual(['R001']);
    expect(site.raw).toEqual(m.documents.dependencies!.fileDependencies.sites[0]);
    expect(site.raw.valuePoint.position).toBe('BEFORE');
    expect(site.statement?.raw.variant).toBe('CICS_FILE_CONTROL');
    expect(site.nodeIds.length).toBeGreaterThan(0);
    const paths = pathsTo(m, site.entry!, site.nodeIds);
    expect(paths.reachable).toBe(true);
    expect(paths.edges.some((e) => e.kind === 'BRANCH_TRUE')).toBe(true);
    expect(paths.edges.some((e) => e.kind === 'BRANCH_FALSE')).toBe(true);
    for (const c of site.candidates)
      for (const support of c.supports) {
        expect(m.operationNodes.has(idKey(support.producer, 'operation'))).toBe(true);
        expect(m.locations(support.origin).some((l) => l.file === 'computed-closed.cbl')).toBe(
          true,
        );
      }
  });
  it('keeps known-plus-open and fully unknown results distinct', async () => {
    const partial = (await model('files-partial')).fileSites[0];
    const unknown = (await model('files-unknown')).fileSites[0];
    expect(partial.candidates.map((c) => c.referenceName)).toEqual(['ACCOUNTS']);
    expect(partial.raw.unknownRemainder).toBe(true);
    expect(unknown.candidates).toEqual([]);
    expect(unknown.raw.unknownRemainder).toBe(true);
  });
  it('keeps bindings and declarations distinct from values at unreachable uses', async () => {
    const m = await model('files-native');
    expect(m.fileDeclarations.map((d) => d.logicalFile).sort()).toEqual(['F', 'G']);
    expect(m.fileSites).toHaveLength(4);
    expect(m.sites).toHaveLength(0);
    for (const s of m.fileSites) {
      expect(s.declarations).toHaveLength(1);
      const name = s.declarations![0].name;
      expect(['CLIENTDD', 'OTHERDD']).toContain(name);
      if (s.raw.reachability === 'UNREACHABLE_IN_MODEL') {
        expect(s.candidates).toEqual([]);
        expect(pathsTo(m, s.entry!, s.nodeIds).reachable).toBe(false);
      } else expect(s.candidates.map((c) => c.referenceName)).toEqual([name]);
    }
  });
  it('AIR+CFG still identifies FILE without fabricating candidates or CALLs', async () => {
    const d = await docs('files-values');
    delete d.dependencies;
    const m = buildModel(d);
    expect(m.fileSites).toHaveLength(1);
    expect(m.fileSites[0].candidates).toEqual([]);
    expect(m.fileSites[0].raw.targetStatus).toBe('DEPENDENCIES_NOT_AVAILABLE');
    expect(m.sites).toHaveLength(0);
  });
  it.each(['operation', 'sequence', 'entry', 'owner', 'binding'])(
    'rejects a broken FILE %s identity rather than matching by text',
    async (field) => {
      const d = await docs('files-native');
      const s = d.dependencies!.fileDependencies.sites[0];
      if (field === 'binding') s.bindings[0].declaration.localId = 'absent';
      else s[field].localId = 'absent';
      expect(() => buildModel(d)).toThrow(/FILE/);
    },
  );
});
