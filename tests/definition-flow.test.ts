import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { admitFiles } from '../src/artifacts';
import { buildModel, idKey } from '../src/model';
import { valuePaths, combineValuePaths } from '../src/value-paths';

function bundle(name = 'goto') {
  return JSON.parse(gunzipSync(readFileSync(`public/examples/${name}.json.gz`)).toString());
}
async function model(b = bundle()) {
  return buildModel(await admitFiles({ 'bundle.json': JSON.stringify(b) }));
}
const proga = (m: Awaited<ReturnType<typeof model>>) =>
  valuePaths(m, m.sites[0], m.sites[0].entry!).find((t) => t.candidate.referenceName === 'PROGA')!;

describe('Native reaching-definition boundaries', () => {
  it('keeps the PROGA branch to CALL and the dying prefix through MOVE PROGB only', async () => {
    const m = await model(),
      t = proga(m);
    expect(t.verification).toBe('reaching-definitions');
    expect(t.unknowns).toEqual([]);
    expect(t.kills).toHaveLength(1);
    expect(t.kills[0].operation?.localId).toBe('fb0e4051dc6c509849ea2c12755aff86');
    expect(t.kills[0].before?.fact.definitions[0].definition.operationId.localId).toBe(
      'e52226b01b4afc8f6c6214aafd63e5ab',
    );
    expect(t.kills[0].after?.fact.definitions[0].definition.operationId.localId).toBe(
      'fb0e4051dc6c509849ea2c12755aff86',
    );
    expect(t.edges.size).toBe(4);
    expect(t.liveEdges.size).toBe(3);
    expect(t.killedEdges.size).toBe(1);
    expect(m.edges.some((e) => e.source === t.kills[0].node && t.edges.has(e.id))).toBe(false);
    const other = m.nodes.find((n) =>
      n.operations.some((o) => o.header.id.localId === '6189b2b0901599f902c0cb1aba88ad14'),
    )!;
    expect(t.nodes.has(other.id)).toBe(false);
    const o = valuePaths(m, m.sites[0], m.sites[0].entry!).find(
      (t) => t.candidate.referenceName === 'OTHER',
    )!;
    expect(o.kills).toEqual([]);
    expect(o.unknowns).toEqual([]);
    expect(o.liveEdges.size).toBe(2);
    expect(combineValuePaths([t, o]).kills.size).toBe(1);
  });

  it('does not infer a kill from an open, absent or unsupported observation', async () => {
    for (const change of ['unknown', 'missing', 'unsupported']) {
      const m = await model();
      const flow = m.documents.valueFlow!;
      const o = flow.observations.find(
        (o: any) =>
          o.point.operationId?.localId === 'fb0e4051dc6c509849ea2c12755aff86' &&
          o.point.position === 'AFTER',
      );
      if (change === 'missing') flow.observations = flow.observations.filter((x: any) => x !== o);
      else if (change === 'unknown') flow.facts[o.rd].fact.unknownRemainder = true;
      else flow.facts[o.rd] = { status: 'UNSUPPORTED', reason: 'SUBJECT_UNSUPPORTED', fact: null };
      const t = proga(m);
      expect(t.kills).toEqual([]);
      expect(t.unknowns.length).toBeGreaterThan(0);
      expect(t.edges.size).toBe(4);
    }
  });

  it('marks a partial surviving range as uncertain, not intact or fully killed', async () => {
    const m = await model(),
      flow = m.documents.valueFlow!;
    const before = flow.observations.find(
      (o: any) =>
        o.point.operationId?.localId === 'fb0e4051dc6c509849ea2c12755aff86' &&
        o.point.position === 'BEFORE',
    );
    const after = flow.observations.find(
      (o: any) =>
        o.point.operationId?.localId === 'fb0e4051dc6c509849ea2c12755aff86' &&
        o.point.position === 'AFTER',
    );
    const partial = structuredClone(flow.facts[before.rd]);
    partial.fact.definitions[0].contributedRanges[0].range.end = '4';
    after.rd = flow.facts.length;
    flow.facts.push(partial);
    const t = proga(m);
    expect(t.kills).toEqual([]);
    expect(t.unknowns[0].reason).toContain('parcial');
    expect(t.edges.size).toBe(4);
  });

  it('never equates a value copied to a new definition with a proven kill', async () => {
    const m = await model();
    const op = m.nodes
      .flatMap((n) => n.operations)
      .find((o) => o.header.id.localId === 'fb0e4051dc6c509849ea2c12755aff86')!;
    // Negative transport guard: a copied expression cannot reuse the literal-kill assertion.
    op.value = { kind: 'read', place: op.destination };
    const t = proga(m);
    expect(t.kills).toEqual([]);
    expect(t.unknowns[0].reason).toContain('transferência');
  });

  it('labels older bundles as structural without inventing overwrite proof', async () => {
    const b = bundle();
    delete b.artifacts['value-flow.json'];
    const m = await model(b),
      t = proga(m);
    expect(t.verification).toBe('structural');
    expect(t.edges.size).toBeGreaterThan(4);
    expect(t.kills).toEqual([]);
  });

  it('rejects stale AIR hashes, foreign subjects and invalid fact references', async () => {
    for (const change of ['hash', 'subject', 'fact']) {
      const b = bundle(),
        f = JSON.parse(b.artifacts['value-flow.json']);
      if (change === 'hash') f.airSha256 = '0'.repeat(64);
      if (change === 'subject') f.observations[0].subject.objectId.publication = 'different';
      if (change === 'fact') f.observations[0].rd = f.facts.length;
      b.artifacts['value-flow.json'] = JSON.stringify(f);
      await expect(model(b)).rejects.toThrow();
    }
  });

  it.each(['cics', 'files-values', 'perform', 'cycle', 'until'])(
    'uses real %s observations without crossing entries or looping forever',
    async (name) => {
      const m = await model(bundle(name));
      let checked = 0;
      for (const s of [...m.sites, ...m.fileSites])
        for (const t of valuePaths(m, s, s.entry!)) {
          if (t.verification === 'reaching-definitions') checked++;
          for (const e of m.edges.filter((e) => t.edges.has(e.id))) expect(e.entry).toBe(s.entry);
          for (const k of t.kills)
            expect(m.operationNodes.get(idKey(k.operation!))).toContain(k.node);
        }
      expect(checked).toBeGreaterThan(0);
    },
  );
});

it('stops the ACCOUNTS file value at the real CUSTOMER assignment, while CUSTOMER reaches ENDBR', async () => {
  const m = await model(bundle('file-value-kill')),
    site = m.fileSites[0];
  const traces = valuePaths(m, site, site.entry!);
  expect(traces.map((t) => t.candidate.referenceName)).toEqual(['ACCOUNTS', 'CUSTOMER']);
  const a = traces[0],
    c = traces[1];
  expect(a.verification).toBe('reaching-definitions');
  expect(a.kills).toHaveLength(1);
  expect(a.unknowns).toEqual([]);
  expect(a.liveEdges.size).toBeGreaterThan(0);
  expect(a.killedEdges.size).toBeGreaterThan(0);
  expect([...c.producers]).toContain(a.kills[0].node);
  expect(c.kills).toEqual([]);
  expect(c.liveEdges.size).toBeGreaterThan(0);
  expect(m.edges.filter((e) => e.source === a.kills[0].node).every((e) => !a.edges.has(e.id))).toBe(
    true,
  );
});

it('uses a structural fallback for a real copied value instead of killing it with its former source', async () => {
  const m = await model(bundle('value-copy-boundary')),
    site = m.sites[0];
  const t = valuePaths(m, site, site.entry!)[0];
  expect(t.candidate.referenceName).toBe('PROGA');
  expect(t.verification).toBe('structural');
  expect(t.kills).toEqual([]);
  expect(t.edges.size).toBeGreaterThan(0);
});
