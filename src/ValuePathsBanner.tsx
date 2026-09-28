import { X, Route } from 'lucide-react';
import type { Site, Location } from './model';
import type { ValueTrace } from './value-paths';

export function ValuePathsBanner({
  site,
  traces,
  candidate,
  onCandidate,
  onClose,
  onSite,
  onDefinition,
}: {
  site: Site;
  traces: ValueTrace[];
  candidate?: number;
  onCandidate: (index?: number) => void;
  onClose: () => void;
  onSite: () => void;
  onDefinition: (node?: string, location?: Location) => void;
}) {
  const destination = site.family === 'file' ? 'acesso ao arquivo' : 'chamada';
  const shown = candidate === undefined ? traces : traces.slice(candidate, candidate + 1);
  const killCount = new Set(shown.flatMap((t) => t.kills.map((k) => k.node))).size;
  return (
    <div className="value-path-banner" role="region" aria-label="Caminhos dos valores possíveis">
      <div className="value-path-controls">
        <Route size={16} />
        <button className="value-path-site" onClick={onSite} title={site.title}>
          {site.title}
        </button>
        <select
          aria-label="Valor a destacar"
          value={candidate ?? 'all'}
          onChange={(e) =>
            onCandidate(e.target.value === 'all' ? undefined : Number(e.target.value))
          }
        >
          <option value="all">Todos os valores ({traces.length})</option>
          {traces.map((t, i) => (
            <option key={i} value={i}>
              {t.candidate.referenceName ?? t.candidate.rawValue}
            </option>
          ))}
        </select>
        <button className="clear-value-paths" onClick={onClose}>
          <X size={14} /> Limpar destaque
        </button>
      </div>
      <div className="value-path-summary" role="status">
        <span className="definition-key">Definições</span> →{' '}
        <span className="destination-key">{destination}</span>
        {' · '}
        {new Set(shown.flatMap((t) => [...t.edges])).size} transições conhecidas.
        {shown.some((t) => ['reaching-definitions', 'mixed'].includes(t.verification)) && (
          <>
            {' '}
            Sobrescritas verificadas pelo analisador.{' '}
            <span className="kill-key">
              {killCount} {killCount === 1 ? 'ponto de eliminação' : 'pontos de eliminação'}
            </span>
            .
          </>
        )}
        {shown.some((t) => ['structural', 'mixed'].includes(t.verification)) &&
          ' Há percursos estruturais: falta evidência para verificar suas sobrescritas.'}
        {shown.some((t) => t.unknowns.length) &&
          ' Laranja: limite da evidência; o destaque para nesse ponto.'}{' '}
        As condições dos branches não são verificadas.
        {shown.some((t) => t.hasOpenControl) ? ' Há controle aberto.' : ''}
      </div>
      <details className="value-definitions">
        <summary>Ver definições e limites do destaque</summary>
        <div className="value-definition-list">
          {shown.map((t, i) => (
            <div key={i}>
              <strong>{t.candidate.referenceName ?? t.candidate.rawValue}</strong>
              {!t.definitions.length && (
                <p>Sem produtor executável publicado; não há caminho a traçar.</p>
              )}
              {t.definitions.map((d, j) => (
                <div key={j}>
                  <span>
                    {d.kind === 'initial'
                      ? 'Valor inicial (VALUE): o fluxo começa na entrada.'
                      : d.kind === 'literal'
                        ? site.family === 'file'
                          ? 'Nome literal do arquivo; não há atribuição dinâmica a percorrer.'
                          : 'Literal na própria chamada; não há atribuição anterior.'
                        : d.kind === 'unmapped'
                          ? 'Produtor sem nó de controle identificado.'
                          : 'Definição publicada.'}
                    {d.nodes.length > 0 && !d.connected
                      ? ` Sem caminho conhecido desta definição até ${site.family === 'file' ? 'o acesso ao arquivo' : 'a chamada'} nesta entrada.`
                      : ''}
                  </span>
                  <button
                    disabled={!d.nodes.length && !d.locations.length}
                    onClick={() =>
                      onDefinition(d.kind === 'operation' ? d.nodes[0] : undefined, d.locations[0])
                    }
                  >
                    {d.locations[0]
                      ? `${d.locations[0].file}:${d.locations[0].startLine}`
                      : 'Inspecionar definição'}
                  </button>
                </div>
              ))}
              {[...t.kills, ...t.unknowns].map((stop, k) => (
                <div
                  key={`stop-${k}`}
                  className={t.kills.includes(stop) ? 'value-kill' : 'value-unknown'}
                >
                  <span>{stop.reason}</span>
                  <button onClick={() => onDefinition(stop.node, stop.location)}>
                    {t.kills.includes(stop) ? 'Ver sobrescrita' : 'Ver limite da evidência'}
                  </button>
                  <details>
                    <summary>Evidência do analisador</summary>
                    <pre>
                      {JSON.stringify(
                        { operation: stop.operation, before: stop.before, after: stop.after },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </div>
              ))}
              {['structural', 'mixed'].includes(t.verification) && (
                <p>
                  Sem comprovação completa para este produtor e objeto. Exibindo também o percurso
                  estrutural, sem atribuir kills.
                </p>
              )}
              {t.candidate.conditionalSupports?.length > 0 && (
                <p>Há evidência condicional de fonte. Ela não cria arestas no CFG.</p>
              )}
              {t.definitions.some((d) => d.support.premises?.length) && (
                <p>O suporte depende de premissas; consulte as evidências do candidato.</p>
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
