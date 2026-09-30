import { assert, type Raw } from './artifacts';
import { canonical, cfgKey, idKey, type GraphEdge, type GraphNode, type Model } from './model';

/** State identities are private to queries. Display identities remain the published CFG IDs. */
export interface ContextGraph {
  start: string;
  nodes: Map<string, string>;
  edges: GraphEdge[];
  displayEdges: Map<string, GraphEdge>;
}
const localKinds = ['LOCAL_INVOKE', 'LOCAL_BOUNDARY', 'LOCAL_RESUME', 'LOCAL_UNWIND'];
export const localKind = (kind: string) => kind.toUpperCase().replace('.', '_');

/** Check typed correlations, not COBOL text or source locations. */
export function admitLocalRules(model: Model): Map<string, Raw> {
  const { cfg, air } = model.documents;
  const rules = new Map<string, Raw>();
  const localNodes = model.nodes.filter((n) => localKinds.includes(n.kind));
  if (cfg.schemaVersion !== '5.0.0') {
    assert(!cfg.localControl?.length && !localNodes.length, 'Controle local exige CFG v5.');
    return rules;
  }
  assert(
    Array.isArray(cfg.localControl) && cfg.localControl.length > 0,
    'CFG v5 exige localControl.',
  );
  const ports = new Set<string>(
    air.publication.units.flatMap((u: Raw) =>
      (u.completionPorts ?? []).map((p: Raw) => idKey(p.id, 'completion_port')),
    ),
  );
  const outgoing = new Set(model.edges.map((e) => e.source));
  for (const r of cfg.localControl) {
    const source = cfgKey(r.source),
      node = model.nodeById.get(source),
      op = node?.sequence?.terminator;
    assert(
      node &&
        op &&
        localKinds.includes(r.kind) &&
        node.kind === r.kind &&
        idKey(op.header.id, 'operation') === idKey(r.operation, 'operation'),
      'Regra local diverge do terminador AIR/CFG.',
    );
    assert(
      !rules.has(source) && !outgoing.has(source),
      'Regra local duplicada ou com transição ordinária.',
    );
    const destination = (field: string, label: Raw) => {
      const target = model.nodeById.get(cfgKey(r[field]));
      assert(
        target?.sequence &&
          target.unit === node.unit &&
          idKey(target.sequence.label, 'label') === idKey(label, 'label'),
        'Destino local diverge da AIR.',
      );
    };
    const port = (p: Raw) => {
      const key = idKey(p, 'completion_port');
      assert(
        ports.has(key) && p.publication === r.operation.publication && p.unit === r.operation.unit,
        'Completion port ausente ou de outra unit.',
      );
      return key;
    };
    const invalid = (tag: string) => {
      const exit = model.nodeById.get(cfgKey(r.invalidExit));
      assert(
        exit?.raw.kind === 'OUTCOME_EXIT' &&
          exit.raw.outcome === 'EXCEPTION' &&
          exit.raw.tag === tag &&
          idKey(exit.raw.operation, 'operation') === idKey(r.operation, 'operation'),
        'Saída local inválida diverge da AIR.',
      );
    };
    if (r.kind === 'LOCAL_INVOKE') {
      destination('entry', op.entry);
      destination('resume', op.resume);
      assert(Array.isArray(r.ports), 'Regra local sem ports.');
      const actual = r.ports.map(port);
      assert(
        new Set(actual).size === actual.length &&
          canonical([...actual].sort()) === canonical(op.completionPorts.map(port).sort()),
        'Ports da invocação divergem da AIR.',
      );
    } else if (r.kind === 'LOCAL_BOUNDARY') {
      assert(port(r.port) === port(op.port), 'Port da fronteira diverge da AIR.');
      destination('defaultDestination', op.defaultDestination);
    } else if (r.kind === 'LOCAL_RESUME') invalid('invalid_local_return');
    else {
      assert(
        typeof r.count === 'string' && /^(0|[1-9][0-9]*)$/.test(r.count) && r.count === op.count,
        'Contagem local deve ser decimal canônica e igual à AIR.',
      );
      destination('destination', op.destination);
      invalid('invalid_local_unwind');
    }
    rules.set(source, r);
  }
  assert(localNodes.length === rules.size, 'Terminador local sem regra publicada.');
  return rules;
}

interface Frame {
  id: number;
  parent?: Frame;
  operation: string;
  resume: string;
  ports: Set<string>;
  depth: number;
}
/** Mirrors CFG v5's finite traversal profile: match only the top frame, reject active recursion.
 * A resource guard rejects the whole query; it never returns a truncated graph as complete.
 */
export function contextGraph(
  model: Model,
  entry: Model['entries'][number],
  rules: Map<string, Raw>,
): ContextGraph {
  const result: ContextGraph = { start: '', nodes: new Map(), edges: [], displayEdges: new Map() };
  const ordinary = new Map<string, GraphEdge[]>();
  for (const e of model.edges)
    if (e.entry === entry.id) {
      assert(
        model.nodeById.get(e.source)?.unit === entry.unit &&
          model.nodeById.get(e.target)?.unit === entry.unit,
        'Transição atravessa a unit da entrada.',
      );
      ordinary.set(e.source, [...(ordinary.get(e.source) ?? []), e]);
    }
  const frames = new Map<string, Frame>(),
    states = new Map<string, string>();
  const pending: { id: string; node: string; stack?: Frame }[] = [];
  const state = (node: string, stack?: Frame) => {
    const key = `${node}/${stack?.id ?? 0}`;
    let id = states.get(key);
    if (id) return id;
    assert(
      pending.length < 250000,
      'Consulta excede 250.000 estados de controle local. O grafo não foi truncado; use uma publicação menor.',
    );
    id = `context:${states.size}`;
    states.set(key, id);
    result.nodes.set(id, node);
    pending.push({ id, node, stack });
    return id;
  };
  result.start = state(entry.nodeId);
  for (let i = 0; i < pending.length; i++) {
    const p = pending[i],
      r = rules.get(p.node);
    const connect = (edge: GraphEdge, stack?: Frame) => {
      const target = state(edge.target, stack);
      result.displayEdges.set(edge.id, edge);
      result.edges.push({
        ...edge,
        id: `context-edge:${result.edges.length}`,
        source: p.id,
        target,
        raw: { displayEdge: edge.id },
      });
    };
    if (!r) {
      for (const e of ordinary.get(p.node) ?? [])
        connect(e, model.nodeById.get(e.target)?.raw.kind === 'SEQUENCE' ? p.stack : undefined);
      continue;
    }
    let stack = p.stack,
      target: string;
    if (r.kind === 'LOCAL_INVOKE') {
      const operation = idKey(r.operation, 'operation');
      for (let f = stack; f; f = f.parent)
        assert(
          f.operation !== operation,
          'Invocação local recursiva ativa: o perfil finito do analisador e do Osiris não suporta esta travessia.',
        );
      const key = `${stack?.id ?? 0}/${operation}`;
      let frame = frames.get(key);
      if (!frame) {
        frame = {
          id: frames.size + 1,
          parent: stack,
          operation,
          resume: cfgKey(r.resume),
          ports: new Set(r.ports.map((p: Raw) => idKey(p, 'completion_port'))),
          depth: (stack?.depth ?? 0) + 1,
        };
        frames.set(key, frame);
      }
      stack = frame;
      target = cfgKey(r.entry);
    } else if (r.kind === 'LOCAL_BOUNDARY') {
      if (stack?.ports.has(idKey(r.port, 'completion_port'))) {
        target = stack.resume;
        stack = stack.parent;
      } else target = cfgKey(r.defaultDestination);
    } else if (r.kind === 'LOCAL_RESUME') {
      target = stack?.resume ?? cfgKey(r.invalidExit);
      stack = stack?.parent;
    } else {
      const count = BigInt(r.count);
      if (count > BigInt(stack?.depth ?? 0)) {
        target = cfgKey(r.invalidExit);
        stack = undefined;
      } else {
        for (let n = Number(count); n > 0; n--) stack = stack!.parent;
        target = cfgKey(r.destination);
      }
    }
    const id = `local:${entry.id}:${p.node}:${target}`;
    connect(
      {
        id,
        source: p.node,
        target,
        entry: entry.id,
        kind: r.kind,
        raw: {
          ...r,
          from: model.nodeById.get(p.node)!.raw.id,
          to: model.nodeById.get(target)!.raw.id,
          activationEntry: entry.raw.id,
          derivedFrom: 'CFG_LOCAL_RULE',
        },
      },
      stack,
    );
  }
  return result;
}

/** Query-only expansion: never render these contextual copies as source statements. */
export function contextualModel(model: Model, entry: string): Model | undefined {
  const graph = model.localGraphs?.get(entry);
  if (!graph) return undefined;
  const nodes: GraphNode[] = [...graph.nodes].map(([id, physical]) => ({
    ...model.nodeById.get(physical)!,
    id,
  }));
  const operationNodes = new Map<string, string[]>();
  for (const node of nodes)
    for (const op of node.operations) {
      const key = idKey(op.header.id, 'operation');
      const ids = operationNodes.get(key) ?? [];
      ids.push(node.id);
      operationNodes.set(key, ids);
    }
  return {
    ...model,
    localGraphs: undefined,
    nodes,
    nodeById: new Map(nodes.map((n) => [n.id, n])),
    edges: graph.edges,
    operationNodes,
    // Regional v1 merges RD observations across invocation stacks. It cannot certify a
    // value's path within an individual stack. Preserve supports and label structural paths.
    documents: { ...model.documents, valueFlow: undefined },
    entries: model.entries
      .filter((e) => e.id === entry)
      .map((e) => ({ ...e, nodeId: graph.start })),
  };
}
