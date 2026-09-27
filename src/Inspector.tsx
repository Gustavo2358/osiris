import { useState } from 'react';
import {
  ArrowUpRight,
  Route,
  Code2,
  Fingerprint,
  FileCode2,
  ChevronRight,
  CircleHelp,
} from 'lucide-react';
import { type Model, type GraphNode, type Site, type Location, idKey, sourceText } from './model';
import type { Raw } from './artifacts';
function Json({ value, label }: { value: any; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="raw" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{label}</summary>
      {open && <pre>{JSON.stringify(value, null, 2)}</pre>}
    </details>
  );
}
function uniqueLocations(locs: Location[]) {
  return Array.from(
    new Map(
      locs.map((l) => [
        JSON.stringify([l.file, l.startLine, l.endLine, l.startColumn, l.endColumn, l.exact]),
        l,
      ]),
    ).values(),
  );
}
function LocationLabel({ loc }: { loc: Location }) {
  return (
    <span className="location-label">
      <FileCode2 size={13} />
      {loc.file}:{loc.startLine}
      {loc.endLine !== loc.startLine ? `–${loc.endLine}` : ''}
      {!loc.exact ? ' · aproximada' : ''}
    </span>
  );
}
const remainderLabels: Record<string, string> = {
  modelValueRemainder: 'Valores no modelo',
  sourceValueRemainder: 'Cobertura da fonte',
  interpretationUnknownRemainder: 'Interpretação do nome',
  effectiveUnknownRemainder: 'Alvo ainda aberto',
  openControlRemainder: 'Controle aberto',
  valueRemainder: 'Valores em aberto',
  interpretationRemainder: 'Interpretação em aberto',
  unknownRemainder: 'Outros valores possíveis',
};
export function Inspector({
  model,
  node,
  site,
  entry,
  onPaths,
  onSource,
  onOperation,
  onNode,
}: {
  model: Model;
  entry: string;
  node?: GraphNode;
  site?: Site;
  onPaths: () => void;
  onSource: () => void;
  onOperation: (key: string) => void;
  onNode: (id: string) => void;
}) {
  const [tab, setTab] = useState('details');
  const loc = site?.statement?.location ?? site?.location ?? node?.location;
  const isFile = site?.family === 'file';
  const op = node?.sequence?.terminator;
  const candidates = site?.candidates ?? [];
  const sourceEvidence =
    site?.sourceEvidence?.filter((s) =>
      s.authorities?.some(
        (a: string) => a === 'SOURCE_QUALIFIED' || a === 'CONDITIONAL_SOURCE_VALUES',
      ),
    ) ?? [];
  const locations = uniqueLocations(
    site?.raw.siteOrigin || site?.raw.origin
      ? model.locations(site.raw.siteOrigin ?? site.raw.origin)
      : op
        ? model.locations(op.header.origin)
        : [],
  );
  const reasons = [
    ...(site?.raw.analysisReasons ?? []),
    ...(site?.raw.uncertaintyRefs ?? [])
      .map((ref: Raw) =>
        model.documents.air.publication.uncertainties?.find(
          (u: Raw) => idKey(u.id, 'uncertainty') === idKey(ref, 'uncertainty'),
        ),
      )
      .filter(Boolean),
  ];
  const incoming = model.edges.filter((e) => e.target === node?.id && e.entry === entry),
    outgoing = model.edges.filter((e) => e.source === node?.id && e.entry === entry);
  return (
    <aside className="inspector" aria-label="Inspetor">
      <div className="inspector-heading">
        <span>INSPECIONAR</span>
        <Fingerprint size={17} />
      </div>
      {!node && !site ? (
        <div className="inspector-empty">
          <CircleHelp size={28} />
          <h2>Siga uma pergunta.</h2>
          <p>
            Selecione um trecho ou uma chamada para explorar o que o analisador conhece sobre o
            programa.
          </p>
          <div>
            01 <span>Localize uma chamada</span>
          </div>
          <div>
            02 <span>Inspecione seus candidatos</span>
          </div>
          <div>
            03 <span>Veja os caminhos até ela</span>
          </div>
        </div>
      ) : (
        <>
          <div className="selection-heading">
            <span className="eyebrow">
              {site ? site.command : node?.kind === 'BRANCH' ? 'DECISÃO' : 'TRECHO DO PROGRAMA'}
            </span>
            <h2>{site?.title ?? node?.title}</h2>
            {loc && (
              <button
                className="source-location-link"
                onClick={onSource}
                title="Abrir no código fonte"
              >
                <LocationLabel loc={loc} />
                <ArrowUpRight size={13} />
              </button>
            )}
            <div className="selection-tags">
              {site?.raw.targetKind && (
                <span>
                  {site.raw.targetKind === 'COMPUTED'
                    ? 'Alvo dinâmico'
                    : site.raw.targetKind === 'LITERAL'
                      ? 'Alvo literal'
                      : site.raw.targetKind === 'LOCAL'
                        ? 'Recurso local'
                        : site.raw.targetKind}
                </span>
              )}
              {node && node.contexts > 1 && (
                <span>
                  Contexto {node.contextIndex} de {node.contexts}
                </span>
              )}
              {site?.sourceOnly && <span>Sem nó no CFG</span>}
            </div>
          </div>
          <div className="inspector-tabs" role="tablist" aria-label="Detalhes da seleção">
            {[
              ['details', 'Evidências', Fingerprint],
              ['source', 'Fonte', FileCode2],
              ['raw', 'Internos', Code2],
            ].map(([key, label, Icon]) => (
              <button
                key={String(key)}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(String(key))}
              >
                {typeof Icon !== 'string' && <Icon size={14} />} {String(label)}
              </button>
            ))}
          </div>
          <div className="inspector-body">
            {tab === 'details' && (
              <>
                <button
                  className="path-action"
                  onClick={onPaths}
                  disabled={!node && !site?.nodeIds.length}
                >
                  <Route size={16} /> Caminhos até aqui <ArrowUpRight size={15} />
                </button>
                <p className="micro">Consulta sobre o fluxo conhecido da entrada selecionada.</p>
                {site && (
                  <section>
                    <div className="section-title">
                      <h3>{isFile ? 'Valores possíveis' : 'Candidatos'}</h3>
                      <span>{candidates.length}</span>
                    </div>
                    {!candidates.length ? (
                      <p className="empty-note">
                        {site.raw.targetStatus === 'UNREACHABLE_IN_MODEL' ||
                        site.raw.reachability === 'UNREACHABLE_IN_MODEL'
                          ? 'Site inalcançável no modelo selecionado.'
                          : site.raw.targetStatus === 'DEPENDENCIES_NOT_AVAILABLE'
                            ? 'Carregue dependencies.json para consultar os candidatos publicados.'
                            : site.raw.targetKind === 'LOCAL'
                              ? 'Recurso local sem nome externo; não há valor de arquivo a resolver.'
                              : 'Nenhum candidato publicado. O alvo pode permanecer aberto.'}
                      </p>
                    ) : (
                      candidates.map((c, i) => (
                        <div className="candidate" key={i}>
                          <div className="candidate-name">
                            <span className="target-icon">↗</span>
                            <strong>{c.referenceName ?? c.name ?? 'Sem nome interpretado'}</strong>
                          </div>
                          <code className="raw-value" title="Valor bruto">
                            {JSON.stringify(c.rawValue)}
                          </code>
                          <div className="candidate-supports">
                            {(c.supports ?? []).map((support: Raw, j: number) => {
                              const locs = uniqueLocations(model.locations(support.origin));
                              const key =
                                support.producer?.domain === 'operation'
                                  ? idKey(support.producer, 'operation')
                                  : undefined;
                              return (
                                <div key={j}>
                                  <span className="support-kind">
                                    {support.kind === 'VALUE_PRODUCER'
                                      ? 'Produzido por'
                                      : support.kind === 'FILE_LITERAL'
                                        ? 'Literal do arquivo'
                                        : support.kind === 'CICS_LITERAL'
                                          ? 'Literal CICS'
                                          : support.kind === 'CALL_LITERAL'
                                            ? 'Literal da chamada'
                                            : support.kind}
                                  </span>
                                  {locs
                                    .filter((l) => l.file !== '<preprocessed>')
                                    .map((l, k) => (
                                      <button
                                        key={k}
                                        disabled={!key || !model.operationNodes.has(key)}
                                        onClick={() => key && onOperation(key)}
                                        className="producer-link"
                                      >
                                        <LocationLabel loc={l} />
                                        <ArrowUpRight size={13} />
                                      </button>
                                    ))}
                                  {support.premises?.length > 0 && (
                                    <Json label="Premissas do suporte" value={support.premises} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {c.conditionalSupports?.length > 0 && (
                            <>
                              <p className="warning-note">
                                Candidato condicional: depende das premissas publicadas.
                              </p>
                              <Json label="Suportes condicionais" value={c.conditionalSupports} />
                            </>
                          )}
                          <Json label="Evidência completa do candidato" value={c} />
                        </div>
                      ))
                    )}
                  </section>
                )}
                {isFile && site && (
                  <section className="file-facts">
                    <h3>Arquivo e ponto de uso</h3>
                    <div className="status-row">
                      <span>Ação</span>
                      <strong>{site.command}</strong>
                    </div>
                    <div className="status-row">
                      <span>Domínio do nome</span>
                      <strong>
                        {site.raw.namespace === 'cics.file'
                          ? 'Arquivo CICS'
                          : site.raw.namespace === 'cobol.external-file-name'
                            ? 'Nome externo COBOL'
                            : (site.raw.namespace ?? 'Recurso local')}
                      </strong>
                    </div>
                    {site.raw.valuePoint && (
                      <p className="micro">
                        Valores consultados antes deste comando ({site.raw.valuePoint.position}).
                      </p>
                    )}
                    {site.declarations?.map((d) => (
                      <div key={idKey(d.id, 'resource')} className="file-binding">
                        <strong>{d.logicalFile}</strong>
                        <span>{d.classification}</span>
                        <p className="micro">
                          Nome declarado: {d.name ?? 'Sem nome externo'}. A declaração não comprova
                          um valor no ponto de uso.
                        </p>
                        <div className="selection-tags">
                          {site.raw.bindings
                            .filter(
                              (b: Raw) =>
                                idKey(b.declaration, 'resource') === idKey(d.id, 'resource'),
                            )
                            .map((b: Raw, i: number) => (
                              <span key={i}>{b.role}</span>
                            ))}
                        </div>
                        <Json label="Declaração e identidade" value={d} />
                      </div>
                    ))}
                    {['effects', 'control'].map(
                      (key) =>
                        site.raw[key] && (
                          <div className="status-row" key={key}>
                            <span>{key === 'effects' ? 'Efeitos' : 'Controle'}</span>
                            <strong>
                              {(
                                {
                                  EXACT: 'Exato',
                                  CONSERVATIVE: 'Conservador',
                                  OPEN: 'Aberto',
                                  UNAVAILABLE: 'Indisponível',
                                  NOT_APPLICABLE: 'Não se aplica',
                                } as Record<string, string>
                              )[site.raw[key]] ?? site.raw[key]}
                            </strong>
                          </div>
                        ),
                    )}
                    {site.raw.context && (
                      <div className="file-context">
                        <h3>Contexto CICS / SYSID</h3>
                        <p className="micro">
                          {site.raw.context.selection === 'DEFAULT'
                            ? 'Seleção padrão publicada; não comprova sistema local.'
                            : 'Seleção explícita no comando.'}
                        </p>
                        {(site.raw.context.candidates ?? []).map((c: Raw, i: number) => (
                          <div className="candidate" key={i}>
                            <strong>{c.referenceName}</strong>
                            <code className="raw-value">{JSON.stringify(c.rawValue)}</code>
                            {(c.supports ?? []).map((support: Raw, j: number) => (
                              <button
                                key={j}
                                className="producer-link"
                                disabled={
                                  !model.operationNodes.has(idKey(support.producer, 'operation'))
                                }
                                onClick={() => onOperation(idKey(support.producer, 'operation'))}
                              >
                                Inspecionar produtor <ArrowUpRight size={13} />
                              </button>
                            ))}
                            <Json label="Evidência do contexto" value={c} />
                          </div>
                        ))}
                        <p className="micro">
                          {site.raw.context.unknownRemainder
                            ? 'Outros valores de SYSID permanecem possíveis.'
                            : 'Sem valores adicionais publicados para SYSID.'}
                        </p>
                        <Json label="Contexto completo" value={site.raw.context} />
                      </div>
                    )}
                  </section>
                )}
                {sourceEvidence.length > 0 && (
                  <section>
                    <h3>Candidatos da evidência fonte</h3>
                    <p className="micro">
                      Esta evidência tem autoridade de fonte. Candidatos condicionais dependem das
                      premissas abaixo e não provam alcançabilidade no CFG.
                    </p>
                    {sourceEvidence.map((s, i) => (
                      <div key={i} className="source-evidence">
                        {(s.candidates ?? []).map((c: Raw, j: number) => (
                          <div className="candidate" key={j}>
                            <div className="candidate-name">
                              <strong>{c.referenceName}</strong>
                              <span className="conditional-badge">
                                {c.conditionalSupports?.length ? 'Condicional' : 'Fonte'}
                              </span>
                            </div>
                            <code className="raw-value">{JSON.stringify(c.rawValue)}</code>
                            {c.conditionalSupports
                              ?.flatMap((support: Raw) => support.assumptions ?? [])
                              .map((a: string, k: number) => (
                                <div className="micro" key={k}>
                                  {(
                                    {
                                      NOMINAL_DECLARATIONS_PRESERVE_MEANING:
                                        'Premissa: declarações nominais preservam o significado',
                                      NO_UNMODELED_STORAGE_INTERFERENCE:
                                        'Premissa: sem interferência de storage não modelada',
                                      DECLARATIVE_INITIAL_VALUES_APPLY:
                                        'Premissa: os valores iniciais declarados se aplicam',
                                    } as Record<string, string>
                                  )[a] ?? a}
                                </div>
                              ))}
                            <Json label="Suportes e qualificações" value={c} />
                          </div>
                        ))}
                        <Json label="Ocorrência fonte completa" value={s} />
                      </div>
                    ))}
                  </section>
                )}
                {site && (
                  <section>
                    <h3>Limites da análise</h3>
                    <div className="status-row">
                      <span>Alcançabilidade</span>
                      <strong>
                        {site.raw.reachability === 'REACHABLE'
                          ? 'No grafo conhecido'
                          : site.raw.reachability === 'UNREACHABLE_IN_MODEL'
                            ? 'Inalcançável no modelo'
                            : (site.raw.reachability ?? 'Não publicada')}
                      </strong>
                    </div>
                    {Object.entries(remainderLabels)
                      .filter(([key]) => key in site.raw)
                      .map(([key, label]) => (
                        <div className="status-row" key={key}>
                          <span>{label}</span>
                          <strong className={site.raw[key] === true ? 'amber' : 'muted'}>
                            {site.raw[key] === true
                              ? 'Aberto'
                              : site.raw[key] === false
                                ? 'Fechado'
                                : 'Indeterminado'}
                          </strong>
                        </div>
                      ))}
                    {site.raw.analysisStatus && (
                      <div className="status-row">
                        <span>Estado deste site</span>
                        <strong>{site.raw.analysisStatus}</strong>
                      </div>
                    )}
                    {reasons.length > 0 && (
                      <Json label={`${reasons.length} motivos / incertezas`} value={reasons} />
                    )}
                    <p className="micro">
                      {isFile
                        ? 'Valores publicados identificam nomes no domínio do analisador; não comprovam alocação ou recurso físico.'
                        : 'Candidatos representam possibilidades publicadas; não confirmam vínculo com um programa executável.'}
                    </p>
                  </section>
                )}
                {node && (
                  <section>
                    <h3>Navegar no fluxo</h3>
                    <div className="neighbor-list">
                      {[
                        ...incoming.map((e) => ({ e, id: e.source, direction: '←' })),
                        ...outgoing.map((e) => ({ e, id: e.target, direction: '→' })),
                      ].map(({ e, id, direction }) => (
                        <button key={direction + e.id} onClick={() => onNode(id)}>
                          <span>{direction}</span>
                          <span>
                            {model.nodeById.get(id)?.title}
                            <small>{e.kind}</small>
                          </span>
                          <ChevronRight size={13} />
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {locations.length > 0 && (
                  <section>
                    <h3>Provenance</h3>
                    {locations.map((l, i) => (
                      <div key={i} className="provenance-location">
                        <LocationLabel loc={l} />
                      </div>
                    ))}
                    <Json
                      label="Referências de provenance"
                      value={site?.raw.provenance ?? site?.raw.origin ?? op?.header.origin}
                    />
                  </section>
                )}
              </>
            )}
            {tab === 'source' && (
              <>
                <button className="path-action" onClick={onSource}>
                  <FileCode2 size={16} /> Abrir código completo <ArrowUpRight size={15} />
                </button>
                <p className="micro">
                  Texto fornecido com a publicação; localização usada somente para apresentação. Os
                  artefatos AIR podem não incluir hash do fonte.
                </p>
                {loc && sourceText(loc, model.documents.sources, 100) ? (
                  <>
                    <LocationLabel loc={loc} />
                    <pre className="source-code">
                      {sourceText(loc, model.documents.sources, 100)}
                    </pre>
                  </>
                ) : (
                  <p className="empty-note">
                    Fonte indisponível. Inclua o arquivo com o nome lógico publicado na provenance.
                    O fluxo continua disponível.
                  </p>
                )}
                {(node?.statements ?? []).map((s) => (
                  <section key={s.key}>
                    <h3>{s.raw.variant.replaceAll('_', ' ')}</h3>
                    <p className="micro">
                      {s.id} · {s.unit.canonicalProgramName}
                    </p>
                    <Json label="Fatos do statement" value={s.raw} />
                  </section>
                ))}
                {node && node.contexts > 1 && (
                  <p className="warning-note">
                    O mesmo statement participa de {node.contexts} contextos no CFG. Eles permanecem
                    separados para preservar os caminhos publicados.
                  </p>
                )}
              </>
            )}
            {tab === 'raw' && (
              <>
                <p className="micro">
                  Identidades completas e fatos originais, sem interpretação adicional.
                </p>
                <Json label="Nó CFG" value={node?.raw} />
                <Json label="Sequence AIR (instruções e terminador)" value={node?.sequence} />
                <Json label="Dependency site / ocorrência" value={site?.raw} />
                <Json label="Transições de entrada" value={incoming.map((e) => e.raw)} />
                <Json label="Transições de saída" value={outgoing.map((e) => e.raw)} />
                <Json
                  label="StatementLinks"
                  value={model.documents.links?.statements.filter((l: Raw) =>
                    node?.operations.some(
                      (o) => idKey(o.header.id, 'operation') === idKey(l.target, 'operation'),
                    ),
                  )}
                />
                <Json
                  label="Inventário, precisão e cobertura"
                  value={{
                    cfg: model.documents.cfg.sourceKnowledge,
                    air: model.documents.air.publication.coverage,
                    dependencies: {
                      analysisStatus: model.documents.dependencies?.analysisStatus,
                      modelScope: model.documents.dependencies?.modelScope,
                      analysisReasons: model.documents.dependencies?.analysisReasons,
                    },
                  }}
                />
                <Json
                  label="Dependencies completo (programas, arquivos e demais inventários)"
                  value={model.documents.dependencies}
                />
                <Json
                  label="Catálogo de origins AIR"
                  value={model.documents.air.publication.origins}
                />
                <Json
                  label="Catálogo de premissas AIR"
                  value={model.documents.air.publication.premises}
                />
                <Json
                  label="Catálogo de incertezas AIR"
                  value={model.documents.air.publication.uncertainties}
                />
                <Json label="Evidência da geração" value={model.documents.evidence} />
              </>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
