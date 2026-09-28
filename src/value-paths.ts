import type { Raw } from './artifacts';
import { definitionFlow, type FlowStop } from './definition-flow';
import { idKey, traverse, type Model, type Site, type Location } from './model';

export interface ValueDefinition {
  kind: 'operation' | 'initial' | 'literal' | 'unmapped';
  support: Raw;
  nodes: string[];
  locations: Location[];
  connected: boolean;
}
export interface ValueTrace {
  candidate: Raw;
  definitions: ValueDefinition[];
  nodes: Set<string>;
  edges: Set<string>;
  producers: Set<string>;
  targets: Set<string>;
  hasOpenControl: boolean;
  verification: 'reaching-definitions' | 'structural' | 'mixed' | 'literal';
  liveEdges: Set<string>;
  killedEdges: Set<string>;
  kills: FlowStop[];
  unknowns: FlowStop[];
}

// Dependencies names full identities; AIR encodes operand owners as local, typed owners.
// Expand that documented wire form before comparing. Never join by source spans or text.
function operandKey(id: Raw) {
  const owner = id.owner;
  return idKey(
    {
      ...id,
      owner: owner?.kind
        ? { domain: owner.kind, localId: owner.localId, publication: id.publication, unit: id.unit }
        : owner,
    },
    'operand',
  );
}

/** Published supports and CFG corridors, refined by optional native reaching definitions. */
export function valuePaths(model: Model, site: Site, entry: string): ValueTrace[] {
  const activation = model.entries.find((e) => e.id === entry);
  const edges = model.edges.filter((e) => e.entry === entry);
  const reachable = traverse(activation ? [activation.nodeId] : [], edges);
  const targets = new Set(
    site.sourceOnly || (site.entry && site.entry !== entry)
      ? []
      : site.nodeIds.filter((id) => model.nodeById.get(id)?.unit === activation?.unit),
  );
  // End at the selected call, rather than lighting continuations after it through loops.
  const beforeCall = edges.filter((e) => !targets.has(e.source));
  const ancestors = traverse([...targets], beforeCall, true);
  const initialOperands = new Set<string>();
  for (const condition of activation?.raw.state?.conditions ?? []) {
    const ids = [
      condition.place?.header?.id,
      ...(condition.value?.candidates ?? []).map((v: Raw) => v.header?.id),
    ];
    for (const id of ids) if (id?.domain === 'operand') initialOperands.add(operandKey(id));
  }
  return site.candidates.map((candidate) => {
    const definitions: ValueDefinition[] = (candidate.supports ?? []).map((support: Raw) => {
      const producer = support.producer;
      let kind: ValueDefinition['kind'] = 'unmapped';
      let nodes: string[] = [];
      if (targets.size && producer?.domain === 'operation') {
        nodes = (model.operationNodes.get(idKey(producer, 'operation')) ?? []).filter(
          (id) => model.nodeById.get(id)?.unit === activation?.unit,
        );
        if (support.kind === 'VALUE_PRODUCER') kind = nodes.length ? 'operation' : 'unmapped';
        else if (['CALL_LITERAL', 'CICS_LITERAL', 'FILE_LITERAL'].includes(support.kind)) {
          nodes = nodes.filter((id) => targets.has(id));
          kind = nodes.length ? 'literal' : 'unmapped';
        } else nodes = [];
      } else if (
        targets.size &&
        support.kind === 'VALUE_PRODUCER' &&
        producer?.domain === 'operand' &&
        initialOperands.has(operandKey(producer)) &&
        activation
      ) {
        kind = 'initial';
        nodes = [activation.nodeId];
      }
      return {
        kind,
        support,
        nodes,
        locations: model.locations(support.origin).filter((l) => l.file !== '<preprocessed>'),
        connected: nodes.some((id) => reachable.has(id) && ancestors.has(id)),
      };
    });
    const starts = definitions.flatMap((d) => d.nodes).filter((id) => reachable.has(id));
    const forward = traverse(starts, beforeCall);
    let nodes = new Set([...forward].filter((id) => ancestors.has(id)));
    let pathEdges = new Set(
      beforeCall.filter((e) => nodes.has(e.source) && nodes.has(e.target)).map((e) => e.id),
    );
    const liveEdges = new Set<string>(),
      killedEdges = new Set<string>();
    const kills: FlowStop[] = [],
      unknowns: FlowStop[] = [];
    const dynamic = definitions.filter((d) => ['operation', 'initial'].includes(d.kind));
    const flows = dynamic.map((d) =>
      definitionFlow(model, site, entry, d, beforeCall, ancestors, targets),
    );
    const verified = flows.filter((f) => f !== undefined);
    const verification = !dynamic.length
      ? 'literal'
      : !verified.length
        ? 'structural'
        : verified.length === dynamic.length
          ? 'reaching-definitions'
          : 'mixed';
    if (verified.length) {
      nodes = new Set();
      pathEdges = new Set();
      flows.forEach((flow, i) => {
        if (flow) {
          flow.nodes.forEach((n) => nodes.add(n));
          flow.edges.forEach((e) => pathEdges.add(e));
          flow.liveEdges.forEach((e) => liveEdges.add(e));
          flow.killedEdges.forEach((e) => killedEdges.add(e));
          kills.push(...flow.kills);
          unknowns.push(...flow.unknowns);
        } else {
          const fallback = traverse(
            dynamic[i].nodes.filter((n) => reachable.has(n)),
            beforeCall,
          );
          for (const n of fallback) if (ancestors.has(n)) nodes.add(n);
          for (const e of beforeCall)
            if (fallback.has(e.source) && fallback.has(e.target) && ancestors.has(e.target))
              pathEdges.add(e.id);
        }
      });
    }
    const producers = new Set(
      definitions.filter((d) => d.kind !== 'literal').flatMap((d) => d.nodes),
    );
    // A mapped but disconnected definition is still inspectable; no invented edge joins it.
    for (const id of [...producers, ...targets]) nodes.add(id);
    return {
      candidate,
      definitions,
      nodes,
      producers,
      targets,
      edges: pathEdges,
      verification,
      liveEdges,
      killedEdges,
      kills,
      unknowns,
      hasOpenControl: [...nodes].some((id) => model.nodeById.get(id)?.open),
    };
  });
}

export function combineValuePaths(traces: ValueTrace[]) {
  const union = (
    field: 'nodes' | 'edges' | 'producers' | 'targets' | 'liveEdges' | 'killedEdges',
  ) => new Set(traces.flatMap((t) => [...t[field]]));
  return {
    nodes: union('nodes'),
    edges: union('edges'),
    producers: union('producers'),
    targets: union('targets'),
    kills: new Set(traces.flatMap((t) => t.kills.map((k) => k.node))),
    unknowns: new Set(traces.flatMap((t) => t.unknowns.map((k) => k.node))),
    killedEdges: new Set([...union('killedEdges')].filter((e) => !union('liveEdges').has(e))),
    hasOpenControl: traces.some((t) => t.hasOpenControl),
  };
}
