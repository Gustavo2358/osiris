import { useEffect, useMemo, useRef, useState } from 'react';
import { FileCode2, Crosshair, Maximize2, Minimize2, X } from 'lucide-react';
import type { Location } from './model';

/** Displays supplied source verbatim. Spans navigate presentation, never join facts. */
export function SourcePane({
  sources,
  location,
  onClose,
  requestSerial,
  selectionSerial,
  expanded,
  onToggleExpand,
}: {
  sources: Record<string, string>;
  location?: Location;
  onClose?: () => void;
  requestSerial: number;
  selectionSerial: number;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const names = useMemo(
    () =>
      Object.keys(sources).sort(
        (a, b) =>
          Number(a === '<preprocessed>') - Number(b === '<preprocessed>') || a.localeCompare(b),
      ),
    [sources],
  );
  const [file, setFile] = useState(location?.file ?? names[0] ?? '');
  const [follow, setFollow] = useState(true);
  const scroll = useRef<HTMLDivElement>(null),
    active = useRef<HTMLDivElement>(null);
  const source = sources[file];
  const lines = useMemo(() => source?.split(/\r?\n/) ?? [], [source]);
  const goToSelection = () => {
    setFollow(true);
    if (location) setFile(location.file);
    const root = scroll.current,
      line = active.current;
    if (root && line) root.scrollTop = line.offsetTop - root.clientHeight / 2 + 22;
  };
  useEffect(() => {
    setFollow(true);
    if (location) setFile(location.file);
  }, [requestSerial]);
  useEffect(() => {
    if (follow && location) setFile(location.file);
  }, [location, follow]);
  useEffect(() => {
    if (!follow || file !== location?.file) return;
    const root = scroll.current,
      line = active.current;
    if (root && line) root.scrollTop = line.offsetTop - root.clientHeight / 2 + 22;
  }, [file, location, follow, expanded, requestSerial, selectionSerial]);
  useEffect(() => {
    const root = scroll.current;
    if (!root || !follow || file !== location?.file) return;
    const observer = new ResizeObserver(() => {
      const line = active.current;
      if (line) root.scrollTop = line.offsetTop - root.clientHeight / 2 + 22;
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [file, location, follow]);
  return (
    <section
      id="source-pane"
      className={`source-pane ${expanded ? 'expanded' : ''}`}
      aria-label="Código fonte original"
    >
      <header className="source-pane-toolbar">
        <FileCode2 size={16} />
        <strong>Código fonte</strong>
        <select
          aria-label="Arquivo de código fonte"
          value={file}
          onChange={(e) => {
            setFile(e.target.value);
            setFollow(false);
            if (scroll.current) scroll.current.scrollTop = 0;
          }}
        >
          {!Object.hasOwn(sources, file) && (
            <option value={file}>{file || 'Nenhuma fonte fornecida'}</option>
          )}
          {names.map((name) => (
            <option key={name} value={name}>
              {name === '<preprocessed>' ? 'Expandido pelo pré-processador' : name}
            </option>
          ))}
        </select>
        <button
          className="icon-button"
          title="Ir para a seleção"
          aria-label="Ir para a seleção no código"
          disabled={!location}
          onClick={goToSelection}
        >
          <Crosshair size={16} />
        </button>
        <button
          className="icon-button"
          aria-label={expanded ? 'Reduzir painel de código' : 'Ampliar painel de código'}
          onClick={onToggleExpand}
        >
          {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
        {onClose && (
          <button className="icon-button" aria-label="Fechar código fonte" onClick={onClose}>
            <X size={16} />
          </button>
        )}
      </header>
      <div className="source-pane-caption">
        <span>
          {file === '<preprocessed>' ? 'Fonte expandido' : 'Arquivo original fornecido'} ·{' '}
          {lines.length} linhas
        </span>
        <label>
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />{' '}
          Acompanhar seleção
        </label>
      </div>
      {source === undefined ? (
        <p className="empty-note">
          O arquivo {file || 'fonte'} não foi fornecido. Inclua o fonte com o nome lógico da
          provenance para abri-lo aqui.
        </p>
      ) : (
        <div
          className="source-document"
          ref={scroll}
          tabIndex={0}
          aria-label={`Conteúdo de ${file}`}
        >
          {lines.map((line, i) => {
            const row = i + 1;
            const selected =
              location?.file === file && row >= location.startLine && row <= location.endLine;
            const chars = Array.from(line);
            const start = selected && row === location.startLine ? location.startColumn : 0;
            const end =
              selected && row === location.endLine
                ? location.endColumn + (location.endExclusive === false ? 1 : 0)
                : chars.length;
            return (
              <div
                key={i}
                ref={selected && row === location.startLine ? active : undefined}
                className={`source-line ${selected ? 'selected-line' : ''}`}
                data-line={row}
              >
                <span className="source-line-number" aria-hidden="true">
                  {row}
                </span>
                <code>
                  {selected ? (
                    <>
                      {chars.slice(0, start).join('')}
                      <mark>{chars.slice(start, end).join('')}</mark>
                      {chars.slice(end).join('')}
                    </>
                  ) : (
                    line || ' '
                  )}
                </code>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
