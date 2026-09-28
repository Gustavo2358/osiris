import type { Raw } from './artifacts';
import { idKey, traverse, type Model, type Site, type GraphEdge, type Location } from './model';
import type { ValueDefinition } from './value-paths';

export interface FlowStop {
  node: string;
  operation?: Raw;
  reason: string;
  location?: Location;
  before?: Raw;
  after?: Raw;
}
export interface DefinitionFlow {
  nodes: Set<string>;
  edges: Set<string>;
  liveEdges: Set<string>;
  killedEdges: Set<string>;
  kills: FlowStop[];
  unknowns: FlowStop[];
}
// Canonical full identities, never source lines or displayed COBOL text.
const canonical = (x: any): string =>
  JSON.stringify(x, (_, v) =>
    v && !Array.isArray(v) && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
const ref = (id?: Raw | null) => (id ? idKey(id) : '');
const cache = new WeakMap<Raw, Map<string, Raw>>();
const pointKey = (
  entry: string,
  subject: string,
  operation: string,
  position: string,
  outcome: Raw | null,
) => canonical([entry, subject, operation, position, outcome]);
function observations(document: Raw) {
  let index = cache.get(document);
  if (!index) {
    index = new Map();
    for (const o of document.observations)
      index.set(
        pointKey(
          ref(o.point.entryId),
          ref(o.subject.objectId),
          ref(o.point.operationId),
          o.point.position,
          o.point.outcome,
        ),
        document.facts[o.rd],
      );
    cache.set(document, index);
  }
  return index;
}
const closed = (rd?: Raw) =>
  rd?.status === 'VALUE' &&
  rd.fact?.reachability === 'REACHABLE' &&
  rd.fact.unknownRemainder === false &&
  rd.fact.resolutionRemainder === false;
function fullOperand(id?: Raw) {
  if (!id) return '';
  return idKey(
    {
      ...id,
      owner: id.owner?.kind
        ? {
            domain: id.owner.kind,
            localId: id.owner.localId,
            publication: id.publication,
            unit: id.unit,
          }
        : id.owner,
    },
    'operand',
  );
}
const eventKey = (e: Raw) =>
  canonical([
    ref(e.entryId),
    ref(e.operationId),
    fullOperand(e.destination),
    e.slot,
    e.kind,
    e.outcome,
    ref(e.storageId),
    ref(e.logicalObjectId),
  ]);

/** Read-only traversal of published CFG edges, gated by the native RD observations.
 * No assignment transfer, alias analysis or predicate solver lives in the browser.
 * Unsupported/copy/partial evidence ends at an explicit uncertainty boundary.
 */
export function definitionFlow(
  model: Model,
  site: Site,
  entry: string,
  definition: ValueDefinition,
  edges: GraphEdge[],
  ancestors: Set<string>,
  targets: Set<string>,
): DefinitionFlow | undefined {
  const doc = model.documents.valueFlow;
  if (!doc || !['operation', 'initial'].includes(definition.kind)) return undefined;
  const activation = model.entries.find((e) => e.id === entry)!;
  const targetOperation = site.nodeIds
    .flatMap((n) => model.nodeById.get(n)?.operations ?? [])
    .find((op) => ref(op.header.id) === site.operation);
  const name = targetOperation?.target?.name;
  const object = name?.kind === 'read' && name.place?.kind === 'object' ? name.place.object : null;
  if (!object) return undefined;
  const index = observations(doc);
  const get = (op: Raw | null, position: string, outcome: Raw | null = null) =>
    index.get(pointKey(entry, ref(object), ref(op), position, outcome));
  const producer = definition.support.producer;
  const initial = definition.kind === 'initial';
  const seed = get(
    initial ? null : producer,
    initial ? 'ENTRY' : 'AFTER',
    initial ? null : { kind: 'normal' },
  );
  // A support propagated through another object cannot be equated with that object's
  // last writer. Keep a clearly labelled structural fallback instead of guessing.
  const initialPlaces = new Set(
    (activation.raw.state?.conditions ?? [])
      .filter((c: Raw) =>
        [c.place?.header?.id, ...(c.value?.candidates ?? []).map((v: Raw) => v.header?.id)].some(
          (id) => fullOperand(id) === fullOperand(producer),
        ),
      )
      .map((c: Raw) => fullOperand(c.place?.header?.id)),
  );
  const tracked: Raw[] = (seed?.fact?.definitions ?? []).filter(
    (d: Raw) =>
      ref(d.definition.entryId) === entry &&
      !d.definition.unknown &&
      (initial
        ? d.definition.kind === 'INITIAL_CONDITION' &&
          initialPlaces.has(fullOperand(d.definition.destination))
        : ref(d.definition.operationId) === ref(producer)),
  );
  if (!tracked.length) return undefined;
  const expected = new Map(
    tracked.map((d) => [eventKey(d.definition), canonical(d.contributedRanges)]),
  );
  const state = (rd?: Raw) => {
    if (!closed(rd)) return 'unknown';
    const present = rd!.fact.definitions.filter((d: Raw) => expected.has(eventKey(d.definition)));
    if (!present.length) return 'absent';
    return present.length === expected.size &&
      present.every(
        (d: Raw) =>
          !d.definition.unknown &&
          expected.get(eventKey(d.definition)) === canonical(d.contributedRanges),
      )
      ? 'alive'
      : 'partial';
  };
  const result: DefinitionFlow = {
    nodes: new Set(),
    edges: new Set(),
    liveEdges: new Set(),
    killedEdges: new Set(),
    kills: [],
    unknowns: [],
  };
  const outgoing = new Map<string, GraphEdge[]>();
  for (const e of edges)
    if (ancestors.has(e.target)) outgoing.set(e.source, [...(outgoing.get(e.source) ?? []), e]);
  const visited = new Set<string>();
  const pending = definition.nodes
    .filter((id) => ancestors.has(id))
    .map((id) => ({ id, seed: true }));
  const stop = (
    id: string,
    op: Raw | undefined,
    reason: string,
    before?: Raw,
    after?: Raw,
    kill = false,
  ) => {
    (kill ? result.kills : result.unknowns).push({
      node: id,
      operation: op?.header.id,
      location:
        model.locations(op?.header.origin).find((l) => l.file !== '<preprocessed>') ??
        model.nodeById.get(id)?.location,
      reason,
      before,
      after,
    });
  };
  while (pending.length) {
    const { id, seed: starting } = pending.pop()!;
    const visitKey = `${id}/${starting}`;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);
    result.nodes.add(id);
    const node = model.nodeById.get(id)!;
    let blocked = false;
    const operations = node.operations;
    const start =
      starting && !initial
        ? operations.findIndex((op) => ref(op.header.id) === ref(producer)) + 1
        : 0;
    if (starting && state(seed) !== 'alive') {
      stop(id, undefined, 'A definição inicial tem evidência incompleta.', undefined, seed);
      continue;
    }
    for (const op of operations.slice(start)) {
      const before = get(op.header.id, 'BEFORE');
      if (state(before) !== 'alive') {
        stop(id, op, 'Não é possível confirmar a preservação integral da definição.', before);
        blocked = true;
        break;
      }
      // Observe the target BEFORE its effects. Earlier instructions in this block still count.
      if (ref(op.header.id) === site.operation) {
        blocked = true;
        break;
      }
      if (op === node.sequence?.terminator) break;
      const after = get(op.header.id, 'AFTER', { kind: 'normal' });
      const afterState = state(after);
      if (afterState !== 'alive') {
        // Full disappearance in a closed RD fact certifies removal of this definition.
        // Copies/computed expressions may carry its value into a new definition: do
        // not label those as a value kill without capture/def-use evidence.
        const kill =
          afterState === 'absent' && op.kind === 'assign' && op.value?.kind === 'literal';
        stop(
          id,
          op,
          kill
            ? 'Esta atribuição elimina a definição anterior neste ramo.'
            : afterState === 'partial'
              ? 'Sobrescrita parcial: não há prova de preservação do valor completo.'
              : 'Evidência incompleta ou transferência para outra definição; o destaque para aqui.',
          before,
          after,
          kill,
        );
        blocked = true;
        break;
      }
    }
    if (blocked || targets.has(id)) continue;
    const term = node.sequence?.terminator;
    for (const edge of outgoing.get(id) ?? []) {
      if (term?.kind === 'invoke') {
        const outcome = edge.kind === 'INVOKE_NORMAL' ? { kind: 'normal' } : null;
        const after = outcome ? get(term.header.id, 'OUTCOME', outcome) : undefined;
        if (state(after) !== 'alive') {
          stop(
            id,
            term,
            'A definição não foi confirmada neste resultado da chamada.',
            get(term.header.id, 'BEFORE'),
            after,
          );
          continue;
        }
      } else if (
        term &&
        !['jump', 'branch', 'select', 'return', 'halt', 'diverge'].includes(term.kind)
      ) {
        stop(id, term, 'Terminador sem evidência de preservação para este percurso.');
        continue;
      }
      result.edges.add(edge.id);
      result.nodes.add(edge.target);
      pending.push({ id: edge.target, seed: false });
    }
  }
  const allowed = edges.filter((e) => result.edges.has(e.id));
  const liveAncestors = traverse(
    [...targets].filter(
      (id) => result.nodes.has(id) && !result.unknowns.some((s) => s.node === id),
    ),
    allowed,
    true,
  );
  const killAncestors = traverse(
    result.kills.map((k) => k.node),
    allowed,
    true,
  );
  for (const e of allowed) {
    if (liveAncestors.has(e.target)) result.liveEdges.add(e.id);
    else if (killAncestors.has(e.target)) result.killedEdges.add(e.id);
  }
  return result;
}
