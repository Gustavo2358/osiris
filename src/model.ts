import { assert, type Documents, type Raw } from './artifacts';
export function canonical(v: any): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  return (
    '{' +
    Object.keys(v)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
      .join(',') +
    '}'
  );
}
// Domains come from typed fields in the CFG wire, never from spelling of local IDs.
export function idKey(id: Raw, domain?: string): string {
  assert(id && typeof id === 'object', 'Identidade ausente.');
  if (domain)
    assert(!id.domain || id.domain === domain, `Domínio incompatível: ${id.domain} / ${domain}`);
  return canonical({ ...id, domain: domain ?? id.domain });
}
export const cfgKey = (id: Raw) => idKey(id, 'cfg-node');
export const sourceKey = (unit: Raw, handle: string) => canonical({ unit, handle });
export interface Location {
  file: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  exact: boolean;
  endExclusive?: boolean;
  origin?: Raw;
}
export interface Statement {
  key: string;
  id: string;
  unit: Raw;
  raw: Raw;
  title: string;
  snippet: string;
  location?: Location;
  paragraph?: string;
}
export interface GraphNode {
  id: string;
  raw: Raw;
  sequence?: Raw;
  operations: Raw[];
  statements: Statement[];
  title: string;
  subtitle: string;
  kind: string;
  paragraph?: string;
  location?: Location;
  open: boolean;
  contexts: number;
  contextIndex: number;
  siteIds: string[];
  fileSiteIds: string[];
  unit: string;
}
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: string;
  entry: string;
  raw: Raw;
}
export interface Site {
  family: 'program' | 'file';
  location?: Location;
  declarations?: Raw[];
  id: string;
  raw: Raw;
  nodeIds: string[];
  title: string;
  command: string;
  statement?: Statement;
  candidates: Raw[];
  entry?: string;
  operation?: string;
  sourceOnly: boolean;
  sourceEvidence?: Raw[];
}
export interface Paragraph {
  id: string;
  title: string;
  unit: string;
  statements: Set<string>;
  nodeIds: string[];
  location?: Location;
}
export interface Model {
  documents: Documents;
  nodes: GraphNode[];
  edges: GraphEdge[];
  sites: Site[];
  fileSites: Site[];
  fileDeclarations: Raw[];
  entries: { id: string; title: string; nodeId: string; raw: Raw; unit: string }[];
  paragraphs: Paragraph[];
  nodeById: Map<string, GraphNode>;
  operationNodes: Map<string, string[]>;
  statements: Map<string, Statement>;
  locations: (origin?: Raw) => Location[];
  origins: Map<string, Raw>;
  artifacts: Map<string, Raw>;
  warnings: string[];
  units: Map<string, string>;
}
export function spanLocation(p: Raw | undefined): Location | undefined {
  const o = p?.original;
  return o && o.startLine >= 1
    ? { ...o, exact: p?.exact === true, endExclusive: false }
    : undefined;
}
export function sourceText(
  loc: Location | undefined,
  sources: Record<string, string>,
  maxLines = 8,
): string {
  if (!loc || !Object.hasOwn(sources, loc.file)) return '';
  const lines = sources[loc.file].split(/\r?\n/);
  if (loc.startLine < 1 || loc.endLine < loc.startLine || loc.startLine > lines.length) return '';
  return lines
    .slice(loc.startLine - 1, Math.min(loc.endLine, loc.startLine + maxLines - 1))
    .map((line, i) => {
      const chars = Array.from(line);
      const end =
        loc.startLine + i === loc.endLine
          ? loc.endColumn + (loc.endExclusive === false ? 1 : 0)
          : chars.length;
      return chars.slice(i === 0 ? loc.startColumn : 0, end).join('');
    })
    .join('\n')
    .trim();
}
export function buildModel(doc: Documents): Model {
  const p = doc.air.publication,
    nodes: GraphNode[] = [],
    edges: GraphEdge[] = [],
    sites: Site[] = [],
    warnings: string[] = [];
  const origins = new Map<string, Raw>(),
    artifacts = new Map<string, Raw>(),
    sequences = new Map<string, Raw>(),
    operations = new Map<string, Raw>(),
    airEntries = new Map<string, Raw>();
  function put(map: Map<string, Raw>, key: string, val: Raw, label: string) {
    assert(!map.has(key), `Identidade duplicada em ${label}.`);
    map.set(key, val);
  }
  for (const o of p.origins ?? []) put(origins, idKey(o.id, 'origin'), o, 'origins');
  for (const a of p.artifacts ?? []) put(artifacts, idKey(a.id, 'artifact'), a, 'artifacts');
  const locationCache = new Map<string, Location[]>();
  function locations(ref?: Raw): Location[] {
    if (!ref) return [];
    const key = idKey(ref, 'origin');
    if (locationCache.has(key)) return locationCache.get(key)!;
    const seen = new Set<string>(),
      result: Location[] = [];
    const pending = [ref];
    while (pending.length) {
      const r = pending.pop()!;
      const k = idKey(r, 'origin');
      if (seen.has(k)) continue;
      seen.add(k);
      const o = origins.get(k);
      if (!o) continue;
      if (o.kind === 'written' && o.location?.kind === 'line_columns') {
        const s = o.location.span,
          a = artifacts.get(idKey(o.artifact, 'artifact'));
        if (a && s.columnUnit === 'UNICODE_SCALAR')
          result.push({
            file: a.logicalName,
            startLine: Number(s.start.line) - Number(s.lineBase) + 1,
            endLine: Number(s.end.line) - Number(s.lineBase) + 1,
            startColumn: Number(s.start.column) - Number(s.columnBase),
            endColumn: Number(s.end.column) - Number(s.columnBase),
            endExclusive: s.endExclusive,
            exact: o.exact,
            origin: r,
          });
      } else if (o.kind === 'derived') pending.push(...[...(o.inputs ?? [])].reverse());
    }
    locationCache.set(key, result);
    return result;
  }
  const units = new Map<string, string>();
  for (const u of p.units) {
    const unit = idKey(u.id, 'unit');
    assert(!units.has(unit), 'Unit AIR duplicada.');
    units.set(unit, `Programa ${units.size + 1}`);
    for (const e of u.entries ?? []) put(airEntries, idKey(e.id, 'entry'), e, 'entries');
    for (const s of u.sequences ?? []) {
      put(sequences, idKey(s.label, 'label'), s, 'sequences');
      for (const op of [...s.instructions, s.terminator])
        put(operations, idKey(op.header.id, 'operation'), op, 'operations');
    }
  }
  const products: Raw[] = doc.sp
    ? doc.sp.schema === 'cobol-semantic-compilation'
      ? doc.sp.units.map((u: Raw) => u.product)
      : [doc.sp]
    : [];
  const statements = new Map<string, Statement>(),
    paragraphs: Paragraph[] = [],
    paragraphById = new Map<string, Paragraph>();
  for (const product of products) {
    assert(
      Array.isArray(product.statements) && product.unit,
      'Semantic Product sem statements/unit.',
    );
    for (const s of product.statements) {
      const key = sourceKey(product.unit, s.header.id);
      assert(!statements.has(key), 'Statement SP duplicado.');
      const loc = spanLocation(s.header.provenance),
        snippet = sourceText(loc, doc.sources);
      statements.set(key, {
        key,
        id: s.header.id,
        unit: product.unit,
        raw: s,
        snippet,
        title: snippet.split('\n')[0] || s.variant.replaceAll('_', ' '),
        location: loc,
      });
    }
    const topo = product.controlTopology;
    if (topo) {
      const regions = new Map<string, Raw>((topo.regions ?? []).map((r: Raw) => [r.id, r])),
        proofs = new Map<string, Raw>((topo.proofs ?? []).map((r: Raw) => [r.id, r]));
      for (const r of regions.values())
        if (r.kind === 'PARAGRAPH' || r.kind === 'SECTION') {
          const proof = (r.proofs ?? [])
            .map((key: string) => proofs.get(key))
            .find((pr: Raw) => pr?.provenance);
          const loc = spanLocation(proof?.provenance);
          const text = sourceText(loc, doc.sources, 1).split('\n')[0];
          const key = sourceKey(product.unit, r.id);
          const para = {
            id: key,
            title:
              text ||
              `${r.kind === 'PARAGRAPH' ? 'Paragraph' : 'Section'} ${paragraphs.length + 1}`,
            unit: product.unit.canonicalProgramName,
            statements: new Set<string>(),
            nodeIds: [],
            location: loc,
          };
          paragraphs.push(para);
          paragraphById.set(key, para);
        }
      for (const o of topo.occurrences ?? []) {
        let r = regions.get(o.region);
        const visited = new Set<string>();
        while (r && !visited.has(r.id)) {
          visited.add(r.id);
          if (r.kind === 'PARAGRAPH' || r.kind === 'SECTION') {
            const para = paragraphById.get(sourceKey(product.unit, r.id))!,
              st = statements.get(sourceKey(product.unit, o.statement));
            if (st) {
              para.statements.add(st.key);
              st.paragraph = para.id;
            }
            break;
          }
          r = regions.get(r.parent);
        }
      }
    }
  }
  const opStatements = new Map<string, Statement[]>();
  const entrySources = new Map<string, Raw>();
  for (const l of doc.links?.statements ?? []) {
    const st = statements.get(sourceKey(l.source.unit, l.source.handle)),
      opKey = idKey(l.target, 'operation'),
      op = operations.get(opKey),
      sequence = sequences.get(idKey(l.label, 'label'));
    assert(st && op && sequence, 'StatementLink aponta para identidade ausente.');
    assert(
      [...sequence.instructions, sequence.terminator].some(
        (o: Raw) => idKey(o.header.id, 'operation') === opKey,
      ),
      'StatementLink aponta para sequence incorreta.',
    );
    const previous = opStatements.get(opKey) ?? [];
    if (!previous.some((s) => s.key === st.key)) previous.push(st);
    opStatements.set(opKey, previous);
    units.set(
      idKey({ publication: l.target.publication, localId: l.target.unit }, 'unit'),
      l.source.unit.canonicalProgramName,
    );
  }
  for (const l of doc.links?.entries ?? []) {
    assert(airEntries.has(idKey(l.target, 'entry')), 'EntryLink aponta para entry ausente.');
    entrySources.set(idKey(l.target, 'entry'), l.source);
  }
  if (doc.sp && !doc.links)
    warnings.push(
      'SP carregado sem links: a correlação por identidade está indisponível. Exporte links.json para nomes e paragraphs do SP.',
    );
  if (!doc.dependencies)
    warnings.push(
      'Dependencies ausente: candidatos de chamadas não foram analisados nesta visualização.',
    );
  const operationNodes = new Map<string, string[]>(),
    nodeById = new Map<string, GraphNode>();
  const allowedTerms =
    doc.cfg.schemaVersion === '1.0.0'
      ? ['JUMP', 'BRANCH', 'RETURN', 'HALT']
      : doc.cfg.schemaVersion === '2.0.0'
        ? ['JUMP', 'BRANCH', 'RETURN', 'HALT', 'INVOKE']
        : ['JUMP', 'BRANCH', 'RETURN', 'HALT', 'INVOKE', 'OPAQUE'];
  for (const raw of doc.cfg.nodes) {
    const id = cfgKey(raw.id);
    assert(raw.id.publication === p.id.localId, 'Nó CFG de outra publicação.');
    assert(!nodeById.has(id), 'Identidade de nó CFG duplicada.');
    assert(
      ['ENTRY', 'SEQUENCE', 'NORMAL_EXIT', 'HALT_EXIT'].includes(raw.kind),
      'Kind de nó CFG não suportado.',
    );
    const seq = raw.kind === 'SEQUENCE' ? sequences.get(idKey(raw.label, 'label')) : undefined;
    if (raw.kind === 'SEQUENCE') {
      if (doc.cfg.schemaVersion === '3.0.0')
        assert(
          typeof raw.terminator?.openControlRemainder === 'boolean',
          'CFG v3 exige openControlRemainder explícito.',
        );
      assert(seq, 'Label CFG ausente na AIR.');
      assert(allowedTerms.includes(raw.terminator.kind), 'Terminador incompatível com versão CFG.');
      assert(
        idKey(seq.terminator.header.id, 'operation') ===
          idKey(raw.terminator.operation, 'operation'),
        'Terminador CFG não corresponde à AIR.',
      );
      assert(
        seq.terminator.kind.toUpperCase() === raw.terminator.kind,
        'Kind de terminador AIR/CFG diverge.',
      );
    }
    const ops: Raw[] = seq ? [...seq.instructions, seq.terminator] : [];
    const linked = Array.from(
      new Map(
        ops
          .flatMap((op) => opStatements.get(idKey(op.header.id, 'operation')) ?? [])
          .map((st) => [st.key, st]),
      ).values(),
    );
    const loc =
      linked[0]?.location ??
      locations(
        seq?.terminator?.header?.origin ??
          (raw.entry ? airEntries.get(idKey(raw.entry, 'entry'))?.origin : undefined),
      ).find((l) => l.file !== '<preprocessed>');
    const snippet = sourceText(loc, doc.sources, 1);
    const headline =
      seq?.terminator.kind === 'invoke'
        ? opStatements.get(idKey(seq.terminator.header.id, 'operation'))?.[0]
        : undefined;
    let title =
      headline?.title ||
      linked[0]?.title ||
      snippet ||
      {
        ENTRY: 'Entrada do programa',
        NORMAL_EXIT: 'Retorno ao chamador',
        HALT_EXIT: 'Fim da execução',
      }[raw.kind as string] ||
      {
        jump: 'Continuação',
        branch: 'Decisão',
        return: 'Retorno',
        halt: 'Fim da execução',
        invoke:
          seq?.terminator?.target?.category === 'file' ? 'Acesso a arquivo' : 'Chamada externa',
        opaque: 'Operação parcialmente modelada',
      }[seq?.terminator?.kind as string] ||
      'Trecho de controle';
    if (raw.kind === 'ENTRY') title = 'Entrada do programa';
    const unitId = raw.label
      ? { publication: raw.label.publication, localId: raw.label.unit }
      : (raw.unit ??
        (raw.entry
          ? { publication: raw.entry.publication, localId: raw.entry.unit }
          : raw.operation
            ? { publication: raw.operation.publication, localId: raw.operation.unit }
            : {}));
    const node: GraphNode = {
      id,
      raw,
      sequence: seq,
      operations: ops,
      statements: linked,
      title,
      subtitle: loc ? `${loc.file}:${loc.startLine}` : 'Sem localização publicada',
      kind: raw.kind === 'SEQUENCE' ? raw.terminator.kind : raw.kind,
      paragraph: linked.find((s) => s.paragraph)?.paragraph,
      location: loc,
      open:
        raw.terminator?.openControlRemainder === true ||
        seq?.terminator?.outcomes?.remainder?.kind === 'within',
      contexts: 1,
      contextIndex: 1,
      siteIds: [],
      fileSiteIds: [],
      unit: idKey(unitId, 'unit'),
    };
    nodes.push(node);
    nodeById.set(id, node);
    for (const op of ops) {
      const key = idKey(op.header.id, 'operation');
      operationNodes.set(key, [...(operationNodes.get(key) ?? []), id]);
    }
    if (node.paragraph) paragraphById.get(node.paragraph)?.nodeIds.push(id);
  }
  // Multiple lowered occurrences remain separate vertices, even with the same SP statement.
  const occurrences = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    const s = n.statements[0];
    if (s) occurrences.set(s.key, [...(occurrences.get(s.key) ?? []), n]);
  }
  for (const group of occurrences.values())
    group.forEach((n, i) => {
      n.contexts = group.length;
      n.contextIndex = i + 1;
    });
  const edgeKinds = [
    'ENTRY',
    'JUMP',
    'BRANCH_TRUE',
    'BRANCH_FALSE',
    'RETURN',
    'HALT',
    ...(doc.cfg.schemaVersion !== '1.0.0' ? ['INVOKE_NORMAL'] : []),
    ...(doc.cfg.schemaVersion === '3.0.0' ? ['OPAQUE_JUMP', 'OPAQUE_RETURN'] : []),
  ];
  for (const [i, e] of doc.cfg.transitions.entries()) {
    assert(edgeKinds.includes(e.kind), 'Transição não suportada pela versão CFG.');
    const source = cfgKey(e.from),
      target = cfgKey(e.to),
      entry = idKey(e.activationEntry, 'entry');
    assert(nodeById.has(source) && nodeById.has(target), 'Transição com destino/origem ausente.');
    assert(airEntries.has(entry), 'ActivationEntry da transição ausente na AIR.');
    edges.push({ id: `edge:${i}`, source, target, kind: e.kind, entry, raw: e });
  }
  const entries = nodes
    .filter((n) => n.raw.kind === 'ENTRY')
    .map((n) => {
      const id = idKey(n.raw.entry, 'entry');
      assert(airEntries.has(id), 'Entry CFG ausente na AIR.');
      const source = entrySources.get(id);
      return {
        id,
        title: source
          ? `${source.unit.canonicalProgramName} · ${source.handle}`
          : `${units.get(n.unit)} · entrada ${n.raw.entry.localId.slice(0, 8)}`,
        nodeId: n.id,
        raw: airEntries.get(id)!,
        unit: n.unit,
      };
    });
  const depSites = doc.dependencies?.sites ?? [];
  const opSeen = new Set<string>();
  for (const s of depSites) {
    const opKey = idKey(s.operation, 'operation');
    assert(operations.has(opKey), 'Dependency site aponta para operação AIR ausente.');
    assert(airEntries.has(idKey(s.entry, 'entry')), 'Dependency site aponta para entry ausente.');
    const ids = operationNodes.get(opKey) ?? [];
    const depSequence = sequences.get(idKey(s.sequence, 'label'));
    assert(
      depSequence && idKey(depSequence.terminator.header.id, 'operation') === opKey,
      'Dependency site aponta para sequence incorreta.',
    );
    const st = opStatements.get(opKey)?.[0];
    const command = s.command ?? 'CALL';
    const site: Site = {
      family: 'program',
      id: canonical({ entry: s.entry, operation: s.operation }),
      raw: s,
      nodeIds: ids,
      title:
        st?.title ??
        `${command} ${(s.candidates ?? []).map((c: Raw) => c.referenceName).join(', ') || 'alvo aberto'}`,
      command,
      statement: st,
      candidates: s.candidates ?? [],
      entry: idKey(s.entry, 'entry'),
      operation: opKey,
      sourceOnly: ids.length === 0,
    };
    assert(!sites.some((v) => v.id === site.id), 'Site de dependência duplicado.');
    sites.push(site);
    opSeen.add(opKey);
    ids.forEach((id) => nodeById.get(id)!.siteIds.push(site.id));
  }
  for (const [key, op] of operations)
    if (op.kind === 'invoke' && op.target?.category !== 'file' && !opSeen.has(key)) {
      const ids = operationNodes.get(key) ?? [],
        st = opStatements.get(key)?.[0];
      const site: Site = {
        family: 'program',
        id: key,
        raw: {
          targetStatus: 'DEPENDENCIES_NOT_AVAILABLE',
          operation: op.header.id,
          targetKind: op.target?.kind,
        },
        nodeIds: ids,
        title: st?.title ?? 'Chamada externa',
        command: 'INVOKE',
        statement: st,
        candidates: [],
        operation: key,
        sourceOnly: !ids.length,
      };
      sites.push(site);
      ids.forEach((id) => nodeById.get(id)!.siteIds.push(site.id));
    }
  // Source occurrence IDs correlate canonical source evidence without mixing
  // its conditional candidates with executable candidates or inventing edges.
  const sitesByStatement = new Map<string, Site[]>();
  for (const site of sites)
    if (site.statement) {
      const key = site.statement.key;
      sitesByStatement.set(key, [...(sitesByStatement.get(key) ?? []), site]);
    }
  for (const [i, s] of (doc.dependencies?.dependencies?.programs ?? []).entries()) {
    const occurrence = s.sourceOccurrence;
    const key = occurrence ? sourceKey(occurrence.unit, occurrence.handle) : undefined;
    const matching = key
      ? sitesByStatement.get(key)
      : sites.filter((site) =>
          (s.executableOperations ?? []).some((o: Raw) => idKey(o, 'operation') === site.operation),
        );
    if (matching?.length) {
      for (const site of matching) (site.sourceEvidence ??= []).push(s);
      continue;
    }
    if ((s.executableOperations ?? []).some((o: Raw) => operationNodes.has(idKey(o, 'operation'))))
      continue;
    const statement = key ? statements.get(key) : undefined;
    sites.push({
      family: 'program',
      id: `source-only:${i}`,
      raw: s,
      nodeIds: [],
      title:
        statement?.title ??
        `${s.command ?? s.technology ?? 'Programa'} · ${(s.candidates ?? []).map((c: Raw) => c.referenceName).join(', ') || 'alvo aberto'}`,
      command: s.command ?? s.technology ?? 'SOURCE',
      candidates: s.candidates ?? [],
      sourceOnly: true,
      statement,
    });
  }
  // FILE is a separate typed projection. Never infer a file from a CALL name,
  // source spelling, line number or a declaration's external name.
  const fileSites: Site[] = [];
  const fileDeclarations: Raw[] = doc.dependencies?.fileDependencies?.declarations ?? [];
  const resources = new Map<string, Raw>(
    (p.resources ?? []).map((r: Raw) => [idKey(r.id, 'resource'), r]),
  );
  const declarations = new Map<string, Raw>();
  for (const d of fileDeclarations) {
    const key = idKey(d.id, 'resource'),
      resource = resources.get(key);
    assert(resource?.declaration, 'Declaração FILE ausente na AIR.');
    assert(
      units.has(idKey(d.owner, 'unit')) &&
        idKey(resource.declaration.owner, 'unit') === idKey(d.owner, 'unit'),
      'Owner da declaração FILE diverge da AIR.',
    );
    put(declarations, key, d, 'declarações FILE');
  }
  const fileOps = new Set<string>();
  for (const raw of doc.dependencies?.fileDependencies?.sites ?? []) {
    const operation = idKey(raw.operation, 'operation'),
      op = operations.get(operation);
    const sequence = sequences.get(idKey(raw.sequence, 'label'));
    assert(
      op &&
        sequence &&
        [...sequence.instructions, sequence.terminator].some(
          (o: Raw) => idKey(o.header.id, 'operation') === operation,
        ),
      'Site FILE aponta para operação/sequence AIR ausente ou incorreta.',
    );
    assert(airEntries.has(idKey(raw.entry, 'entry')), 'Entrada FILE ausente na AIR.');
    assert(
      idKey(raw.owner, 'unit') ===
        idKey({ publication: raw.operation.publication, localId: raw.operation.unit }, 'unit') &&
        raw.entry.unit === raw.operation.unit,
      'Owner/entrada FILE diverge da operação AIR.',
    );
    const bound = (raw.bindings ?? []).map((b: Raw) => {
      const d = declarations.get(idKey(b.declaration, 'resource'));
      assert(d, 'Binding FILE aponta para declaração ausente.');
      const r = resources.get(idKey(b.declaration, 'resource'))!;
      assert(
        r.declaration.uses.some(
          (u: Raw) => idKey(u.operation, 'operation') === operation && u.role === b.role,
        ),
        'Binding FILE não corresponde ao uso tipado AIR.',
      );
      return d;
    });
    assert(
      raw.targetKind === 'LOCAL' ? bound.length > 0 : op.target?.category === 'file',
      'Site FILE incompatível com a categoria AIR.',
    );
    const statement = opStatements.get(operation)?.[0],
      ids = operationNodes.get(operation) ?? [];
    const location =
      statement?.location ?? locations(raw.origin).find((l) => l.file !== '<preprocessed>');
    const command = String(raw.action).toUpperCase();
    const site: Site = {
      family: 'file',
      id: 'file:' + canonical({ entry: raw.entry, operation: raw.operation }),
      raw,
      operation,
      entry: idKey(raw.entry, 'entry'),
      nodeIds: ids,
      statement,
      location,
      declarations: bound,
      command,
      title:
        statement?.title ||
        sourceText(location, doc.sources, 1) ||
        `${command} ${bound.map((d: Raw) => d.logicalFile).join(', ') || 'arquivo'}`,
      candidates: raw.candidates ?? [],
      sourceOnly: !ids.length,
    };
    assert(!fileSites.some((s) => s.id === site.id), 'Site FILE duplicado.');
    fileSites.push(site);
    fileOps.add(operation);
    ids.forEach((id) => nodeById.get(id)!.fileSiteIds.push(site.id));
  }
  for (const [key, op] of operations) {
    if (op.kind !== 'invoke' || op.target?.category !== 'file' || fileOps.has(key)) continue;
    const statement = opStatements.get(key)?.[0],
      ids = operationNodes.get(key) ?? [];
    const location =
      statement?.location ?? locations(op.header.origin).find((l) => l.file !== '<preprocessed>');
    const site: Site = {
      family: 'file',
      id: 'file:' + key,
      operation: key,
      nodeIds: ids,
      statement,
      location,
      raw: {
        operation: op.header.id,
        targetStatus: 'DEPENDENCIES_NOT_AVAILABLE',
        targetKind: op.target.kind.toUpperCase(),
        namespace: op.target.namespace,
      },
      title: statement?.title || sourceText(location, doc.sources, 1) || 'Acesso a arquivo',
      command: String(op.action).toUpperCase(),
      candidates: [],
      sourceOnly: !ids.length,
    };
    fileSites.push(site);
    ids.forEach((id) => nodeById.get(id)!.fileSiteIds.push(site.id));
  }
  if (nodes.some((n) => n.open))
    warnings.push(
      'Há controle aberto. As arestas publicadas representam apenas o fluxo conhecido.',
    );
  if (nodes.filter((n) => n.raw.kind === 'SEQUENCE' && !n.statements.length).length)
    warnings.push(
      'Alguns trechos auxiliares não têm StatementLink. Sua identidade e provenance AIR permanecem disponíveis.',
    );
  return {
    documents: doc,
    nodes,
    edges,
    sites,
    fileSites,
    fileDeclarations,
    entries,
    paragraphs,
    nodeById,
    operationNodes,
    statements,
    locations,
    origins,
    artifacts,
    warnings,
    units,
  };
}
export function entryGraph(model: Model, entry: string) {
  const edges = model.edges.filter((e) => e.entry === entry),
    unit = model.entries.find((e) => e.id === entry)?.unit;
  const nodes = model.nodes.filter((n) => n.unit === unit);
  return { nodes, edges };
}
export function traverse(start: string[], edges: GraphEdge[], reverse = false): Set<string> {
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    const a = reverse ? e.target : e.source,
      b = reverse ? e.source : e.target;
    let list = adjacency.get(a);
    if (!list) adjacency.set(a, (list = []));
    list.push(b);
  }
  const seen = new Set(start),
    queue = [...start];
  for (let i = 0; i < queue.length; i++)
    for (const n of adjacency.get(queue[i]) ?? [])
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
  return seen;
}
export function pathsTo(model: Model, entry: string, targets: string[]) {
  const edges = model.edges.filter((e) => e.entry === entry),
    start = model.entries.find((e) => e.id === entry)?.nodeId;
  const forward = traverse(start ? [start] : [], edges),
    backward = traverse(targets, edges, true);
  const nodes = new Set([...backward].filter((n) => forward.has(n)));
  const included = edges.filter((e) => nodes.has(e.source) && nodes.has(e.target));
  const goal = new Set(targets),
    previous = new Map<string, GraphEdge>();
  const queue = start ? [start] : [],
    seen = new Set(queue);
  let reached: string | undefined;
  const adjacency = new Map<string, GraphEdge[]>();
  for (const e of included) {
    let list = adjacency.get(e.source);
    if (!list) adjacency.set(e.source, (list = []));
    list.push(e);
  }
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i];
    if (goal.has(n)) {
      reached = n;
      break;
    }
    for (const e of adjacency.get(n) ?? [])
      if (!seen.has(e.target)) {
        seen.add(e.target);
        previous.set(e.target, e);
        queue.push(e.target);
      }
  }
  const witness: GraphEdge[] = [];
  while (reached && reached !== start) {
    const edge = previous.get(reached);
    if (!edge) break;
    witness.push(edge);
    reached = edge.source;
  }
  witness.reverse();
  return {
    nodes,
    edges: included,
    witness,
    reachable: targets.some((t) => forward.has(t)),
    hasOpenControl: [...nodes].some((id) => model.nodeById.get(id)?.open),
  };
}
