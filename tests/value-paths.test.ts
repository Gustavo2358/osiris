import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { admitFiles } from '../src/artifacts';
import { buildModel, idKey, type GraphEdge } from '../src/model';
import { valuePaths, combineValuePaths } from '../src/value-paths';

async function load(name: string) {
  return buildModel(
    await admitFiles({
      'bundle.json': gunzipSync(
        readFileSync(new URL(`../public/examples/${name}.json.gz`, import.meta.url)),
      ).toString(),
    }),
  );
}

describe('Candidate definitions and structural paths', () => {
  it('maps each CICS candidate to its own published producer and uses only CFG edges', async () => {
    const m = await load('cics');
    const site = m.sites.find((s) => s.raw.targetKind === 'COMPUTED')!;
    const traces = valuePaths(m, site, site.entry!);
    expect(traces.map((t) => t.candidate.referenceName)).toEqual(['DETAIL', 'SUMMARY']);
    for (const trace of traces) {
      const producer = idKey(trace.candidate.supports[0].producer, 'operation');
      expect([...trace.producers]).toEqual(m.operationNodes.get(producer));
      expect(trace.definitions[0].connected).toBe(true);
      expect(trace.edges.size).toBeGreaterThan(0);
      for (const edge of m.edges.filter((e) => trace.edges.has(e.id))) {
        expect(edge.entry).toBe(site.entry);
        expect(trace.nodes.has(edge.source) && trace.nodes.has(edge.target)).toBe(true);
        expect(site.nodeIds).not.toContain(edge.source); // stop at the observed use
      }
    }
    expect([...traces[0].producers]).not.toEqual([...traces[1].producers]);
    expect(combineValuePaths(traces).producers.size).toBe(2);
  });

  it('keeps repeated PERFORM producer identities and contexts separate', async () => {
    const m = await load('perform');
    const calls = m.sites.filter((s) => !s.sourceOnly);
    expect(calls).toHaveLength(2);
    const traces = calls.map((s) => valuePaths(m, s, s.entry!)[0]);
    expect([...traces[0].producers]).not.toEqual([...traces[1].producers]);
    for (let i = 0; i < calls.length; i++) {
      expect([...traces[i].producers]).toEqual(
        m.operationNodes.get(idKey(calls[i].candidates[0].supports[0].producer)),
      );
      expect(traces[i].definitions[0].connected).toBe(true);
    }
  });

  it('literal calls highlight the use without inventing an earlier assignment', async () => {
    const m = await load('order-router');
    const s = m.sites.find((s) => s.title === "CALL 'AUDITLOG'")!;
    const t = valuePaths(m, s, s.entry!)[0];
    expect(t.definitions[0].kind).toBe('literal');
    expect(t.producers.size).toBe(0);
    expect(t.edges.size).toBe(0);
    expect([...t.nodes]).toEqual(s.nodeIds);
  });

  it(
    'recognizes the COACTUPC VALUE operand by full identity and preserves declaration provenance',
    { timeout: 15000 },
    async () => {
      const m = await load('carddemo-coactupc');
      const s = m.sites.find((s) => s.candidates.some((c) => c.referenceName === 'COMEN01C'))!;
      const t = valuePaths(m, s, s.entry!)[0];
      expect(t.definitions[0].kind).toBe('initial');
      expect(t.definitions[0].connected).toBe(true);
      expect(t.definitions[0].locations.length).toBeGreaterThan(0);
      expect([...t.producers]).toEqual([m.entries.find((e) => e.id === s.entry)!.nodeId]);
      expect(t.edges.size).toBeGreaterThan(0);
      // Real FILE names in COACTUPC come from entry-state VALUE declarations too.
      for (const file of m.fileSites) {
        const trace = valuePaths(m, file, file.entry!)[0];
        expect(trace.definitions[0].kind).toBe('initial');
        expect(trace.definitions[0].connected).toBe(true);
        expect(trace.definitions[0].locations.length).toBeGreaterThan(0);
        expect(trace.edges.size).toBeGreaterThan(0);
      }
      const candidate = structuredClone(s.candidates[0]);
      candidate.supports[0].producer.publication = 'other-publication';
      expect(
        valuePaths(m, { ...s, candidates: [candidate] }, s.entry!)[0].definitions[0].kind,
      ).toBe('unmapped');
    },
  );

  it('does not guess a path from conditional source evidence or a missing producer', async () => {
    const m = await load('cics');
    const s = m.sites.find((s) => s.raw.targetKind === 'COMPUTED')!;
    for (const candidate of [
      {
        ...s.candidates[0],
        supports: [],
        conditionalSupports: [{ evidence: [{ reference: 'statement:0' }] }],
      },
      {
        ...s.candidates[0],
        supports: [
          {
            ...s.candidates[0].supports[0],
            producer: { ...s.candidates[0].supports[0].producer, publication: 'other' },
          },
        ],
      },
    ]) {
      const t = valuePaths(m, { ...s, candidates: [candidate] }, s.entry!)[0];
      expect(t.producers.size).toBe(0);
      expect(t.edges.size).toBe(0);
      expect([...t.nodes]).toEqual(s.nodeIds);
    }
  });

  it('keeps disconnected definitions visible and excludes other activation edges', async () => {
    const m = await load('cics');
    const s = m.sites.find((s) => s.raw.targetKind === 'COMPUTED')!;
    const mapped = valuePaths(m, s, s.entry!)[0];
    const producer = [...mapped.producers][0];
    const disconnected = { ...m, edges: m.edges.filter((e) => e.source !== producer) };
    const t = valuePaths(disconnected, s, s.entry!)[0];
    expect(t.nodes.has(producer)).toBe(true);
    expect(t.definitions[0].connected).toBe(false);
    expect(t.edges.size).toBe(0);
    const fake: GraphEdge = {
      ...m.edges[0],
      id: 'other-activation',
      source: producer,
      target: s.nodeIds[0],
      entry: 'different',
    };
    expect(
      valuePaths({ ...disconnected, edges: [...disconnected.edges, fake] }, s, s.entry!)[0].edges
        .size,
    ).toBe(0);
    expect(valuePaths(m, s, 'different')[0].producers.size).toBe(0);
  });
});

describe('FILE value definitions', () => {
  it('maps ACCOUNTS and CUSTOMER to separate published assignments and ends at the file access', async () => {
    const m = await load('files-values');
    const site = m.fileSites[0];
    const traces = valuePaths(m, site, site.entry!);
    expect(traces.map((t) => t.candidate.referenceName)).toEqual(['ACCOUNTS', 'CUSTOMER']);
    expect(combineValuePaths(traces).producers.size).toBe(2);
    for (const trace of traces) {
      const producer = idKey(trace.candidate.supports[0].producer, 'operation');
      expect([...trace.producers]).toEqual(m.operationNodes.get(producer));
      expect(trace.definitions[0].connected).toBe(true);
      expect(trace.edges.size).toBeGreaterThan(0);
      expect(trace.definitions[0].locations.length).toBeGreaterThan(0);
      expect([...trace.targets]).toEqual(site.nodeIds);
      for (const edge of m.edges.filter((e) => trace.edges.has(e.id))) {
        expect(edge.entry).toBe(site.entry);
        expect(site.nodeIds).not.toContain(edge.source);
      }
    }
  });

  it('FILE literals have no invented earlier assignment or path', async () => {
    const m = await load('files-native');
    for (const site of m.fileSites.filter((s) => s.candidates.length)) {
      const trace = valuePaths(m, site, site.entry!)[0];
      expect(trace.candidate.referenceName).toBe('CLIENTDD');
      expect(trace.definitions[0].kind).toBe('literal');
      expect(trace.producers.size).toBe(0);
      expect(trace.edges.size).toBe(0);
      expect([...trace.nodes]).toEqual(site.nodeIds);
    }
  });

  it('does not invent FILE definitions when dependencies has no values', async () => {
    const m = await load('files-unknown');
    expect(m.fileSites.length).toBeGreaterThan(0);
    for (const site of m.fileSites) expect(valuePaths(m, site, site.entry!)).toEqual([]);
  });
});
