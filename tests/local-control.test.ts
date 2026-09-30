import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { admitFiles, type Documents, type Raw } from '../src/artifacts';
import {
  buildModel,
  cfgKey,
  idKey,
  pathsTo,
  unreachableDefensiveExits,
  type Model,
} from '../src/model';
import { valuePaths } from '../src/value-paths';

const ref = (domain: string, localId: string) => ({
  domain,
  publication: 'test',
  unit: 'u',
  localId,
});
const vertex = (ordinal: string) => ({ publication: 'test', ordinal });
const termKind = (kind: string) =>
  kind.startsWith('LOCAL_') ? kind.toLowerCase().replace('_', '.') : kind.toLowerCase();
/** Small wire graphs with explicit expected semantics; source names/order have no role. */
function wire(spec: Record<string, Raw>, start: string): Documents {
  const sequences = Object.entries(spec).map(([name, r]) => ({
    label: ref('label', name),
    instructions: [],
    terminator: {
      header: { id: ref('operation', name) },
      kind: termKind(r.kind),
      ...(r.entry
        ? {
            entry: ref('label', r.entry),
            resume: ref('label', r.resume),
            completionPorts: (r.ports ?? []).map((p: string) => ref('completion_port', p)),
          }
        : {}),
      ...(r.port
        ? {
            port: ref('completion_port', r.port),
            defaultDestination: ref('label', r.defaultDestination),
          }
        : {}),
      ...(r.count !== undefined
        ? { count: r.count, destination: ref('label', r.destination) }
        : {}),
    },
  }));
  const localControl = Object.entries(spec)
    .filter(([, r]) => r.kind.startsWith('LOCAL_'))
    .map(([name, r]) => ({
      source: vertex(name),
      operation: ref('operation', name),
      kind: r.kind,
      ...(r.entry
        ? {
            entry: vertex(r.entry),
            resume: vertex(r.resume),
            ports: (r.ports ?? []).map((p: string) => ref('completion_port', p)),
          }
        : {}),
      ...(r.port
        ? { port: ref('completion_port', r.port), defaultDestination: vertex(r.defaultDestination) }
        : {}),
      ...(r.count !== undefined ? { count: r.count, destination: vertex(r.destination) } : {}),
      ...(['LOCAL_RESUME', 'LOCAL_UNWIND'].includes(r.kind)
        ? { invalidExit: vertex('invalid:' + name) }
        : {}),
    }));
  const entry = { id: ref('entry', 'root'), start: ref('label', start) };
  const nodes = sequences.map((s) => ({
    id: vertex(s.label.localId),
    kind: 'SEQUENCE',
    label: s.label,
    terminator: {
      kind: spec[s.label.localId].kind,
      operation: s.terminator.header.id,
      openControlRemainder: false,
    },
  }));
  const exits = localControl
    .filter((r) => r.invalidExit)
    .map((r) => ({
      id: r.invalidExit,
      kind: 'OUTCOME_EXIT',
      operation: r.operation,
      outcome: 'EXCEPTION',
      tag: r.kind === 'LOCAL_RESUME' ? 'invalid_local_return' : 'invalid_local_unwind',
    }));
  const transitions = [
    { from: vertex('entry'), to: vertex(start), kind: 'ENTRY', activationEntry: entry.id },
    ...Object.entries(spec).flatMap(([name, r]) =>
      (r.next ?? []).map((to: string, i: number) => ({
        from: vertex(name),
        to: vertex(to),
        kind: r.kind === 'BRANCH' ? (i ? 'BRANCH_FALSE' : 'BRANCH_TRUE') : 'JUMP',
        activationEntry: entry.id,
      })),
    ),
  ];
  return {
    air: {
      publication: {
        id: { localId: 'test' },
        units: [
          {
            id: { publication: 'test', localId: 'u' },
            sequences,
            entries: [entry],
            completionPorts: ['p', 'q'].map((p) => ({ id: ref('completion_port', p) })),
          },
        ],
      },
    },
    cfg: {
      schemaVersion: '5.0.0',
      nodes: [{ id: vertex('entry'), kind: 'ENTRY', entry: entry.id }, ...nodes, ...exits],
      transitions,
      localControl,
    },
    sources: {},
    files: {},
  };
}
const ids = (m: Model, target: string) =>
  new Set(
    [...pathsTo(m, m.entries[0].id, [cfgKey(vertex(target))]).nodes].map(
      (id) => m.nodeById.get(id)!.raw.id.ordinal,
    ),
  );
const reachable = (m: Model) => new Set([...m.localGraphs!.values()][0].nodes.values());
const has = (m: Model, id: string) => reachable(m).has(cfgKey(vertex(id)));
const model = (s: Record<string, Raw>, start: string) => buildModel(wire(s, start));
const resume = { kind: 'LOCAL_RESUME' },
  end = { kind: 'RETURN' };

describe('matched local control, without flattening shared returns', () => {
  it('two sequential PERFORMs return to their own continuation; first path excludes the second call', () => {
    const m = model(
      {
        a: { kind: 'LOCAL_INVOKE', entry: 'body', resume: 'b' },
        b: { kind: 'LOCAL_INVOKE', entry: 'body', resume: 'end' },
        body: resume,
        end,
      },
      'a',
    );
    expect(ids(m, 'b')).toEqual(new Set(['entry', 'a', 'body', 'b']));
    expect(ids(m, 'body')).toEqual(new Set(['entry', 'a', 'body', 'b']));
    expect(ids(m, 'end')).toEqual(new Set(['entry', 'a', 'body', 'b', 'end']));
    expect(has(m, 'invalid:body')).toBe(false);
    expect([...m.localGraphs!.values()][0].nodes.size).toBe(6);
  });
  it('a boundary matches ONLY the top frame, never an outer PERFORM', () => {
    const m = model(
      {
        a: { kind: 'LOCAL_INVOKE', entry: 'b', resume: 'end', ports: ['p'] },
        b: { kind: 'LOCAL_INVOKE', entry: 'boundary', resume: 'outer', ports: ['q'] },
        boundary: { kind: 'LOCAL_BOUNDARY', port: 'p', defaultDestination: 'inner' },
        inner: resume,
        outer: resume,
        end,
      },
      'a',
    );
    expect(ids(m, 'end')).toEqual(
      new Set(['entry', 'a', 'b', 'boundary', 'inner', 'outer', 'end']),
    );
    const withTop = wire(
      {
        a: { kind: 'LOCAL_INVOKE', entry: 'boundary', resume: 'end', ports: ['p'] },
        boundary: { kind: 'LOCAL_BOUNDARY', port: 'p', defaultDestination: 'wrong' },
        wrong: end,
        end,
      },
      'a',
    );
    expect(has(buildModel(withTop), 'wrong')).toBe(false);
  });
  it('fallthrough without an active PERFORM follows the default boundary', () => {
    const m = model(
      { boundary: { kind: 'LOCAL_BOUNDARY', port: 'p', defaultDestination: 'end' }, end },
      'boundary',
    );
    expect(has(m, 'end')).toBe(true);
  });
  it('resume with an empty stack follows its declared invalid exit', () => {
    const m = model({ empty: resume }, 'empty');
    expect(has(m, 'invalid:empty')).toBe(true);
  });
  it.each(['0', '1', '2', '9223372036854775808123'])(
    'unwind %s removes exactly the requested count',
    (count) => {
      const m = model(
        {
          a: { kind: 'LOCAL_INVOKE', entry: 'u', resume: 'end' },
          u: { kind: 'LOCAL_UNWIND', count, destination: 'r' },
          r: resume,
          end,
        },
        'a',
      );
      expect(has(m, 'end')).toBe(count === '0');
      expect(has(m, 'invalid:r')).toBe(count === '1');
      expect(has(m, 'invalid:u')).toBe(!['0', '1'].includes(count));
    },
  );
  it('ordinary loops terminate the query; active invocation recursion is explicitly refused', () => {
    const m = model(
      {
        a: { kind: 'LOCAL_INVOKE', entry: 'body', resume: 'again' },
        body: resume,
        again: { kind: 'JUMP', next: ['a'] },
      },
      'a',
    );
    expect([...m.localGraphs!.values()][0].nodes.size).toBe(4);
    expect(() =>
      model({ a: { kind: 'LOCAL_INVOKE', entry: 'a', resume: 'end' }, end }, 'a'),
    ).toThrow(/recursiva ativa/);
  });
  it('an ordinary activation exit discards the PERFORM stack', () => {
    const d = wire(
      {
        a: { kind: 'LOCAL_INVOKE', entry: 'body', resume: 'wrong' },
        body: { kind: 'JUMP', next: ['exit'] },
        r: resume,
        wrong: end,
      },
      'a',
    );
    d.cfg.nodes.push({
      id: vertex('exit'),
      kind: 'NORMAL_EXIT',
      unit: { publication: 'test', localId: 'u' },
    });
    d.cfg.transitions.push({
      from: vertex('exit'),
      to: vertex('r'),
      kind: 'JUMP',
      activationEntry: ref('entry', 'root'),
    });
    const m = buildModel(d);
    expect(has(m, 'invalid:r')).toBe(true);
    expect(has(m, 'wrong')).toBe(false);
  });
  it.each([
    'missing',
    'duplicate',
    'ordinary',
    'operation',
    'destination',
    'port',
    'invalid',
    'count',
    'legacy',
  ])('rejects %s corruption without repairing identities', (change) => {
    const d = wire(
      {
        a: { kind: 'LOCAL_INVOKE', entry: 'body', resume: 'u', ports: ['p'] },
        body: resume,
        u: { kind: 'LOCAL_UNWIND', count: '0', destination: 'end' },
        end,
      },
      'a',
    );
    const r = d.cfg.localControl[0];
    if (change === 'missing') d.cfg.localControl.shift();
    if (change === 'duplicate') d.cfg.localControl.push(r);
    if (change === 'ordinary')
      d.cfg.transitions.push({
        from: r.source,
        to: r.resume,
        kind: 'JUMP',
        activationEntry: ref('entry', 'root'),
      });
    if (change === 'operation') r.operation = ref('operation', 'body');
    if (change === 'destination') r.entry = r.resume;
    if (change === 'port') r.ports[0].unit = 'other';
    if (change === 'invalid')
      d.cfg.localControl.find((r: Raw) => r.kind === 'LOCAL_RESUME').invalidExit = vertex('end');
    if (change === 'count')
      d.cfg.localControl.find((r: Raw) => r.kind === 'LOCAL_UNWIND').count = '00';
    if (change === 'legacy') d.cfg.schemaVersion = '4.0.0';
    expect(() => buildModel(d)).toThrow();
  });
});

async function real(id: string) {
  return buildModel(
    await admitFiles({
      bundle: gunzipSync(readFileSync(`public/examples/${id}.json.gz`)).toString(),
    }),
  );
}
describe('real shared bodies and dependency identities', () => {
  it('separates callers while showing the shared dynamic CALL only once', async () => {
    const m = await real('shared-values'),
      entry = m.entries[0].id;
    const sites = m.sites
      .filter((s) => !s.sourceOnly)
      .sort((a, b) => a.statement!.location!.startLine - b.statement!.location!.startLine);
    expect(sites.map((s) => s.candidates.map((c) => c.referenceName).sort())).toEqual([
      ['PROGA001'],
      ['PROGB001'],
      ['PROGA001', 'PROGB001'],
    ]);
    expect(sites[2].nodeIds).toHaveLength(1);
    const first = pathsTo(m, entry, sites[0].nodeIds);
    expect(first.reachable).toBe(true);
    expect(sites[1].nodeIds.some((id) => first.nodes.has(id))).toBe(false);
    expect(
      [...first.nodes].some((id) => m.nodeById.get(id)!.title.includes("MOVE 'PROGB001'")),
    ).toBe(false);
    expect(first.witness.some((e) => e.kind === 'LOCAL_RESUME')).toBe(true);
    const traces = valuePaths(m, sites[2], entry);
    expect(traces.map((t) => t.verification)).toEqual(['structural', 'structural']);
    expect(traces.every((t) => t.contextual && t.edges.size > 0 && t.kills.length === 0)).toBe(
      true,
    );
    const a = traces.find((t) => t.candidate.referenceName === 'PROGA001')!;
    expect(
      [...a.edges].some((id) => m.edges.find((e) => e.id === id)?.kind === 'LOCAL_INVOKE'),
    ).toBe(true);
  });
  it('keeps FILE candidates and supports attached to one shared access', async () => {
    const m = await real('shared-files');
    expect(m.fileSites).toHaveLength(1);
    expect(m.fileSites[0].nodeIds).toHaveLength(1);
    expect(m.fileSites[0].candidates.map((c) => c.referenceName).sort()).toEqual([
      'ACCOUNT',
      'CUSTOMER',
    ]);
    const paths = valuePaths(m, m.fileSites[0], m.entries[0].id);
    expect(paths).toHaveLength(2);
    expect(
      paths.every(
        (t) => t.definitions.some((d) => d.connected) && t.edges.size > 0 && t.kills.length === 0,
      ),
    ).toBe(true);
  });
});

const oracle = JSON.parse(readFileSync('tests/fixtures/shared-routines-oracle.json', 'utf8'));
for (const [id, entries] of Object.entries(oracle.examples) as [string, Raw[]][])
  it(`agrees with the independent producer oracle: ${id}`, { timeout: 15000 }, async () => {
    const m = await real(id);
    for (const e of entries) {
      const graph = m.localGraphs!.get(idKey(e.entry, 'entry'))!;
      expect(graph.nodes.size).toBe(e.states);
      expect(
        [
          ...new Set([...graph.nodes.values()].map((n) => m.nodeById.get(n)!.raw.id.ordinal)),
        ].sort(),
      ).toEqual(e.reachable);
      const local = [...graph.displayEdges.values()].filter(
        (e) => e.raw.derivedFrom === 'CFG_LOCAL_RULE',
      );
      expect(
        local
          .map((e) => [
            m.nodeById.get(e.source)!.raw.id.ordinal,
            m.nodeById.get(e.target)!.raw.id.ordinal,
          ])
          .sort(),
      ).toEqual(e.localPairs);
    }
    if (id === 'carddemo-coactupc-shared') {
      expect(m.nodes).toHaveLength(3132);
      expect(m.sites.filter((s) => !s.sourceOnly)).toHaveLength(6);
      expect(m.fileSites).toHaveLength(14);
      const reached = new Set([...m.localGraphs!.values()].flatMap((g) => [...g.nodes.values()]));
      const unreachable = m.nodes.filter((n) => !reached.has(n.id));
      expect(unreachable).toHaveLength(67);
      expect(unreachableDefensiveExits(m, m.entries[0].id)).toEqual(
        new Set(unreachable.map((n) => n.id)),
      );
      expect(
        unreachable.every(
          (n) => n.raw.kind === 'OUTCOME_EXIT' && n.raw.tag === 'invalid_local_return',
        ),
      ).toBe(true);
      for (const site of [...m.sites, ...m.fileSites].filter((s) => !s.sourceOnly))
        expect(pathsTo(m, site.entry!, site.nodeIds).reachable).toBe(true);
      expect(m.documents.cfg.sourceKnowledge.publicationInventory).toBe('PARTIAL');
    }
  });

it('isolates activation entries even when their routines are shared', () => {
  const d = wire(
    {
      a: { kind: 'LOCAL_INVOKE', entry: 'body', resume: 'endA' },
      b: { kind: 'LOCAL_INVOKE', entry: 'body', resume: 'endB' },
      body: resume,
      endA: end,
      endB: end,
    },
    'a',
  );
  const second = ref('entry', 'second');
  d.air.publication.units[0].entries.push({ id: second, start: ref('label', 'b') });
  d.cfg.nodes.push({ id: vertex('entryB'), kind: 'ENTRY', entry: second });
  d.cfg.transitions.push({
    from: vertex('entryB'),
    to: vertex('b'),
    kind: 'ENTRY',
    activationEntry: second,
  });
  const m = buildModel(d);
  expect(pathsTo(m, idKey(second, 'entry'), [cfgKey(vertex('endA'))]).reachable).toBe(false);
  expect(pathsTo(m, idKey(second, 'entry'), [cfgKey(vertex('endB'))]).reachable).toBe(true);
  expect(pathsTo(m, m.entries[0].id, [cfgKey(vertex('endB'))]).reachable).toBe(false);
});

describe('defensive exit visibility is presentation-only and entry-specific', () => {
  it('hides only an unreachable invalidExit referenced by an admitted local rule', () => {
    const d = wire(
      {
        a: { kind: 'LOCAL_INVOKE', entry: 'body', resume: 'end' },
        body: resume,
        end,
        dead: { kind: 'OPAQUE' },
      },
      'a',
    );
    // A matching tag is not authority to hide an unrelated exceptional exit.
    d.cfg.nodes.push({
      id: vertex('unrelated'),
      kind: 'OUTCOME_EXIT',
      operation: ref('operation', 'dead'),
      outcome: 'EXCEPTION',
      tag: 'invalid_local_return',
    });
    const m = buildModel(d),
      before = JSON.stringify(m.documents);
    expect(unreachableDefensiveExits(m, m.entries[0].id)).toEqual(
      new Set([cfgKey(vertex('invalid:body'))]),
    );
    expect(m.nodeById.has(cfgKey(vertex('dead')))).toBe(true);
    expect(m.nodeById.has(cfgKey(vertex('invalid:body')))).toBe(true);
    expect(JSON.stringify(m.documents)).toBe(before);
  });

  it('retains a reachable return without an active PERFORM', () => {
    const m = model({ body: resume }, 'body');
    expect(has(m, 'invalid:body')).toBe(true);
    expect(unreachableDefensiveExits(m, m.entries[0].id).size).toBe(0);
  });

  it.each(['0', '2'])('unwind %s hides only its unreachable defensive exit', (count) => {
    const m = model(
      {
        a: { kind: 'LOCAL_INVOKE', entry: 'u', resume: 'end' },
        u: { kind: 'LOCAL_UNWIND', count, destination: 'body' },
        body: resume,
        end,
      },
      'a',
    );
    expect(unreachableDefensiveExits(m, m.entries[0].id).has(cfgKey(vertex('invalid:u')))).toBe(
      count === '0',
    );
  });

  it('does not hide a guard in an entry that can reach it, even if another entry cannot', () => {
    const d = wire(
      { a: { kind: 'LOCAL_INVOKE', entry: 'body', resume: 'end' }, body: resume, end },
      'a',
    );
    const second = ref('entry', 'second');
    d.air.publication.units[0].entries.push({ id: second, start: ref('label', 'body') });
    d.cfg.nodes.push({ id: vertex('entryB'), kind: 'ENTRY', entry: second });
    d.cfg.transitions.push({
      from: vertex('entryB'),
      to: vertex('body'),
      kind: 'ENTRY',
      activationEntry: second,
    });
    const m = buildModel(d);
    expect(unreachableDefensiveExits(m, m.entries[0].id)).toEqual(
      new Set([cfgKey(vertex('invalid:body'))]),
    );
    expect(unreachableDefensiveExits(m, idKey(second, 'entry')).size).toBe(0);
  });

  it('keeps legacy examples intact', async () => {
    const m = await real('order-router');
    expect(unreachableDefensiveExits(m, m.entries[0].id).size).toBe(0);
    expect(m.nodes).toHaveLength(16);
  });
});
