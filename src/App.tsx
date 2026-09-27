import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Upload,
  Search,
  PhoneOutgoing,
  Layers3,
  GitBranch,
  X,
  ChevronRight,
  Route,
  ShieldCheck,
  HelpCircle,
  FileCode2,
  ArrowLeft,
  Download,
  ScanSearch,
  Network,
  FolderOpen,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { admitFiles, decodeBytes, MAX_BYTES } from './artifacts';
import {
  buildModel,
  entryGraph,
  pathsTo,
  type Model,
  type Site,
  type GraphNode,
  type Location,
} from './model';
import { Graph, type GraphViewport } from './Graph';
import { Inspector } from './Inspector';
import { SourcePane } from './SourcePane';
import { SplitWorkspace } from './SplitWorkspace';
import { Tabs } from './Tabs';
import { Modal } from './Modal';
interface Example {
  id: string;
  title: string;
  description: string;
  nodes: number;
  sites: number;
  url: string;
  format: string;
}
interface ViewState {
  sourceTarget?: Location;
  entry: string;
  selected?: string;
  selectedSite?: string;
  queries: Record<string, string>;
  sidebar: string;
  mode: string;
  paragraph: string;
  routeTargets: string[];
  routeCaption: string;
  routeSite?: string;
  highlight: boolean;
  witness: boolean;
  viewport?: GraphViewport;
}
function App() {
  const [model, setModel] = useState<Model>(),
    [examples, setExamples] = useState<Example[]>([]),
    [exampleId, setExampleId] = useState(''),
    [entry, setEntry] = useState('');
  const [selected, setSelected] = useState<string>(),
    [selectedSite, setSelectedSite] = useState<string>(),
    [queries, setQueries] = useState<Record<string, string>>({}),
    [sidebar, setSidebar] = useState('calls');
  const query = queries[sidebar] ?? '';
  function setQuery(value: string) {
    setQueries((previous) => ({ ...previous, [sidebar]: value }));
  }
  const [routeTargets, setRouteTargets] = useState<string[]>([]);
  const [routeCaption, setRouteCaption] = useState('');
  const [routeSite, setRouteSite] = useState<string>();
  const [mode, setMode] = useState('all'),
    [paragraph, setParagraph] = useState(''),
    [highlight, setHighlight] = useState(false),
    [witness, setWitness] = useState(false);
  const [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [help, setHelp] = useState(false),
    [warnings, setWarnings] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [sourceTarget, setSourceTarget] = useState<Location>();
  const [selectionSerial, setSelectionSerial] = useState(0);
  const [sourceRequest, setSourceRequest] = useState(0);
  const [history, setHistory] = useState<ViewState[]>([]);
  const graphViewport = useRef<GraphViewport | undefined>(undefined),
    restoreSerial = useRef(0);
  const [restoreView, setRestoreView] = useState<{ id: number; viewport: GraphViewport }>();
  function rememberView() {
    setHistory((h) => [
      ...h.slice(-29),
      {
        entry,
        sourceTarget,
        selected,
        selectedSite,
        queries,
        sidebar,
        mode,
        paragraph,
        routeTargets,
        routeCaption,
        routeSite,
        highlight,
        witness,
        viewport: graphViewport.current,
      },
    ]);
  }
  const goBack = useCallback(() => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((h) => h.slice(0, -1));
    setEntry(previous.entry);
    setSelected(previous.selected);
    setSourceTarget(previous.sourceTarget);
    setSelectionSerial((n) => n + 1);
    setSelectedSite(previous.selectedSite);
    setQueries(previous.queries);
    setSidebar(previous.sidebar);
    setMode(previous.mode);
    setParagraph(previous.paragraph);
    setRouteTargets(previous.routeTargets);
    setRouteCaption(previous.routeCaption);
    setRouteSite(previous.routeSite);
    setHighlight(previous.highlight);
    setWitness(previous.witness);
    if (previous.viewport)
      setRestoreView({ id: ++restoreSerial.current, viewport: previous.viewport });
  }, [history]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        help ||
        (event.target as HTMLElement)?.matches('input, textarea, select, [contenteditable="true"]')
      )
        return;
      if (viewing) {
        event.preventDefault();
        setViewing(false);
      } else if (history.length) {
        event.preventDefault();
        goBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goBack, history.length, help, viewing]);
  const input = useRef<HTMLInputElement>(null),
    loadId = useRef(0);
  const install = useCallback(async (files: Record<string, string>, id: string, serial: number) => {
    const docs = await admitFiles(files);
    const m = buildModel(docs);
    if (serial !== loadId.current) return;
    const firstSite =
      m.sites.find((s) => s.entry === m.entries[0]?.id && s.raw.targetKind === 'COMPUTED') ??
      m.sites.find((s) => s.entry === m.entries[0]?.id) ??
      m.fileSites.find((s) => s.entry === m.entries[0]?.id);
    setModel(m);
    setHistory([]);
    setRouteTargets([]);
    setRouteCaption('');
    setRouteSite(undefined);
    setRestoreView(undefined);
    graphViewport.current = undefined;
    setSidebar(firstSite?.family === 'file' ? 'files' : 'calls');
    setEntry(m.entries[0]?.id ?? '');
    setSelected(firstSite?.nodeIds[0]);
    setSelectedSite(firstSite?.id);
    setSourceTarget(firstSite?.statement?.location ?? firstSite?.location);
    setSelectionSerial((n) => n + 1);
    setMode('all');
    setParagraph('');
    setQueries({});
    setWitness(false);
    setHighlight(false);
    setExampleId(id);
    setError('');
  }, []);
  const loadExample = useCallback(
    async (ex: Example) => {
      const serial = ++loadId.current;
      setBusy('Carregando ' + ex.title + '…');
      try {
        const response = await fetch(ex.url);
        if (!response.ok) throw new Error('Exemplo indisponível.');
        const text = await decodeBytes(new Uint8Array(await response.arrayBuffer()));
        await install({ [ex.id + '.json']: text }, ex.id, serial);
      } catch (e) {
        if (serial === loadId.current) setError(String(e instanceof Error ? e.message : e));
      } finally {
        if (serial === loadId.current) setBusy('');
      }
    },
    [install],
  );
  useEffect(() => {
    let cancelled = false;
    fetch('examples/index.json')
      .then((r) => r.json())
      .then((ex: Example[]) => {
        if (cancelled) return;
        setExamples(ex);
        const wanted = new URLSearchParams(location.search).get('example');
        void loadExample(ex.find((e) => e.id === wanted) ?? ex[0]);
      })
      .catch(() => setError('Abra seus artefatos para começar.'));
    return () => {
      cancelled = true;
    };
  }, [loadExample]);
  async function importFiles(list: FileList | File[]) {
    const serial = ++loadId.current;
    setBusy('Validando artefatos e identidades…');
    try {
      assertTotal(list);
      const files: Record<string, string> = {};
      for (const file of Array.from(list)) {
        if (Object.hasOwn(files, file.name))
          throw new Error(
            'Nomes duplicados na seleção. Use um pacote com nomes lógicos explícitos.',
          );
        files[file.name] = await decodeBytes(new Uint8Array(await file.arrayBuffer()));
      }
      await install(files, '', serial);
    } catch (e) {
      if (serial === loadId.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (serial === loadId.current) setBusy('');
      if (input.current) input.current.value = '';
    }
  }
  function selectNode(id: string) {
    setSourceTarget(model?.nodeById.get(id)?.location);
    setSelectionSerial((n) => n + 1);
    if (id === selected && !selectedSite) return;
    rememberView();
    if (!scope.nodes.some((n) => n.id === id)) {
      setMode('all');
      setParagraph('');
    }
    setSelected(id);
    setSelectedSite(undefined);
  }
  function selectSite(site: Site) {
    setSourceTarget(
      site.statement?.location ?? site.location ?? model?.nodeById.get(site.nodeIds[0])?.location,
    );
    setSelectionSerial((n) => n + 1);
    if (site.id === selectedSite && selected === site.nodeIds[0]) return;
    rememberView();
    if (site.entry) setEntry(site.entry);
    setSelectedSite(site.id);
    setSelected(site.nodeIds[0]);
    if (!site.nodeIds.some((id) => scope.nodes.some((n) => n.id === id))) {
      setMode('all');
      setParagraph('');
    }
  }
  const allSites = useMemo(() => (model ? [...model.sites, ...model.fileSites] : []), [model]);
  const node = model?.nodeById.get(selected ?? ''),
    site =
      allSites.find((s) => s.id === selectedSite) ??
      allSites.find((s) => s.nodeIds.includes(selected ?? '') && (!s.entry || s.entry === entry));
  const targetIds = useMemo(() => site?.nodeIds ?? (selected ? [selected] : []), [site, selected]);
  const reach = useMemo(
    () => (model && routeTargets.length ? pathsTo(model, entry, routeTargets) : undefined),
    [model, entry, routeTargets],
  );
  const baseScope = useMemo(
    () => (model ? entryGraph(model, entry) : { nodes: [], edges: [] }),
    [model, entry],
  );
  const scope = useMemo(() => {
    if (!model) return baseScope;
    const base = baseScope;
    if (mode === 'paths')
      return { nodes: base.nodes.filter((n) => reach?.nodes.has(n.id)), edges: reach?.edges ?? [] };
    if (mode === 'paragraph') {
      const ids = new Set(model.paragraphs.find((p) => p.id === paragraph)?.nodeIds);
      return {
        nodes: base.nodes.filter((n) => ids.has(n.id)),
        edges: base.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
      };
    }
    if (mode === 'local' && selected) {
      const ids = new Set([selected]);
      for (let i = 0; i < 2; i++) {
        const next = new Set(ids);
        for (const e of base.edges)
          if (ids.has(e.source) || ids.has(e.target)) {
            next.add(e.source);
            next.add(e.target);
          }
        for (const id of next) ids.add(id);
      }
      return {
        nodes: base.nodes.filter((n) => ids.has(n.id)),
        edges: base.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
      };
    }
    return base;
  }, [baseScope, model, mode, paragraph, selected, reach]);
  const entrySites =
    (sidebar === 'files' ? model?.fileSites : model?.sites)?.filter(
      (s) => !s.entry || s.entry === entry,
    ) ?? [];
  const shownSites = entrySites.filter((s) =>
    `${s.title} ${s.command} ${s.candidates.map((c) => c.referenceName).join(' ')} ${s.declarations?.map((d) => `${d.logicalFile} ${d.name ?? ''}`).join(' ') ?? ''}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  const shownParagraphs =
    model?.paragraphs.filter(
      (p) =>
        p.nodeIds.some(
          (id) => model.nodeById.get(id)?.unit === model.entries.find((e) => e.id === entry)?.unit,
        ) && p.title.toLowerCase().includes(query.toLowerCase()),
    ) ?? [];
  const foundNodes =
    model?.nodes.filter(
      (n) =>
        n.unit === model.entries.find((e) => e.id === entry)?.unit &&
        `${n.title} ${n.subtitle}`.toLowerCase().includes(query.toLowerCase()),
    ) ?? [];
  const totalResults =
    sidebar === 'calls' || sidebar === 'files'
      ? entrySites.length
      : sidebar === 'paragraphs'
        ? (model?.paragraphs.filter((p) =>
            p.nodeIds.some((id) => baseScope.nodes.some((n) => n.id === id)),
          ).length ?? 0)
        : baseScope.nodes.length;
  const filteredResults =
    sidebar === 'calls' || sidebar === 'files'
      ? shownSites.length
      : sidebar === 'paragraphs'
        ? shownParagraphs.length
        : foundNodes.length;
  const pathAction = () => {
    if (mode !== 'paths' || routeTargets.join() !== targetIds.join()) rememberView();
    setRouteTargets(targetIds);
    setRouteCaption(site?.title ?? node?.title ?? 'Trecho selecionado');
    setRouteSite(site?.id);
    setMode('paths');
    setParagraph('');
    setWitness(false);
  };
  function exportSelection() {
    if (!model) return;
    const value = {
      schema: 'cobol-explorer-selection',
      version: '1.0.0',
      publication: model.documents.cfg.publication,
      entry,
      mode,
      notice: 'Subgrafo do CFG conhecido; não prova a viabilidade dos predicados.',
      nodes: scope.nodes.map((n) => n.raw),
      transitions: scope.edges.map((e) => e.raw),
      selectedSite: site?.raw,
      sourceKnowledge: model.documents.cfg.sourceKnowledge,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'selection.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div
      className={`app ${viewing ? 'viewing-mode' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) void importFiles(e.dataTransfer.files);
      }}
    >
      <header className="app-header">
        <h1 className="sr-only">
          {model ? [...new Set(model.units.values())].join(' / ') : 'COBOL Graph Explorer'}
        </h1>
        <div className="brand">
          <span className="brand-mark">
            <Network size={24} />
          </span>
          <strong>trama</strong>
          <span className="brand-divider" />
          <span className="brand-sub">COBOL GRAPH EXPLORER</span>
        </div>
        <label className="example-picker">
          <span>EXEMPLOS REAIS</span>
          <select
            aria-label="Escolher exemplo"
            value={exampleId}
            onChange={(e) => {
              const ex = examples.find((x) => x.id === e.target.value);
              if (ex) void loadExample(ex);
            }}
          >
            <option value="" disabled>
              Publicação importada
            </option>
            {examples.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title} · {ex.nodes} nós
              </option>
            ))}
          </select>
        </label>
        <div className="viewing-context">
          <strong>{model ? [...new Set(model.units.values())].join(' / ') : ''}</strong>
          <span title={mode === 'paths' ? routeCaption : undefined}>
            {mode === 'paths'
              ? 'Caminhos'
              : mode === 'paragraph'
                ? 'Paragraph'
                : mode === 'local'
                  ? 'Vizinhança'
                  : 'Programa inteiro'}{' '}
            · {scope.nodes.length} trechos
          </span>
        </div>
        <div className="header-actions">
          <button className="back-button viewing-back" disabled={!history.length} onClick={goBack}>
            <ArrowLeft size={15} /> Voltar
          </button>
          <button
            className="viewing-toggle source-toggle"
            aria-pressed={viewing}
            aria-label={viewing ? 'Sair da visualização' : 'Modo de visualização'}
            disabled={!model}
            title={viewing ? 'Sair da visualização (Esc)' : 'Mostrar somente grafo e código'}
            onClick={() => setViewing(!viewing)}
          >
            {viewing ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span className="header-action-label">
              {viewing ? 'Sair da visualização' : 'Modo de visualização'}
            </span>
          </button>
          <span className="local-badge">
            <ShieldCheck size={14} /> Local no browser
          </span>
          <button
            className={`source-toggle code-toggle ${sourceOpen ? 'active' : ''}`}
            aria-label="Código fonte"
            title="Código fonte"
            aria-expanded={sourceOpen}
            disabled={!model}
            onClick={() => setSourceOpen(!sourceOpen)}
          >
            <FileCode2 size={16} /> <span className="header-action-label">Código fonte</span>
          </button>
          <button className="icon-button" aria-label="Ajuda" onClick={() => setHelp(true)}>
            <HelpCircle size={19} />
          </button>
          <button
            className="primary-button"
            aria-label="Abrir artefatos"
            title="Abrir artefatos"
            onClick={() => input.current?.click()}
          >
            <Upload size={15} /> <span className="header-action-label">Abrir artefatos</span>
          </button>
          <input
            ref={input}
            type="file"
            multiple
            accept=".json,.gz,.cbl,.cob,.cpy"
            className="hidden-input"
            aria-label="Selecionar artefatos"
            onChange={(e) => e.target.files && void importFiles(e.target.files)}
          />
        </div>
      </header>
      {error && (
        <div role="alert" className="error-banner">
          {error}
          <button aria-label="Fechar erro" onClick={() => setError('')}>
            <X size={16} />
          </button>
        </div>
      )}
      <div className="workspace">
        <aside className="navigator" aria-label="Navegação do programa">
          <div className="nav-heading">
            <Layers3 size={16} />
            <strong>Explorar programa</strong>
          </div>
          <label className="entry-picker">
            ENTRADA
            <select
              aria-label="Entrada do programa"
              value={entry}
              onChange={(e) => {
                rememberView();
                setEntry(e.target.value);
                setMode('all');
                setSelected(undefined);
                setSelectedSite(undefined);
                setSourceTarget(undefined);
              }}
            >
              {model?.entries.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </label>
          <div className="search-box">
            <Search size={15} />
            <input
              aria-label="Buscar no programa"
              placeholder={
                sidebar === 'calls'
                  ? 'Buscar chamada ou candidato…'
                  : sidebar === 'files'
                    ? 'Buscar arquivo ou valor…'
                    : 'Buscar no programa…'
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button aria-label="Limpar busca" onClick={() => setQuery('')}>
                <X size={13} />
              </button>
            )}
          </div>
          <Tabs
            id="navigation"
            className="nav-tabs"
            label="Navegar por"
            value={sidebar}
            onChange={setSidebar}
            items={[
              { key: 'calls', label: 'Chamadas', icon: PhoneOutgoing },
              { key: 'files', label: 'Arquivos', icon: FolderOpen },
              { key: 'paragraphs', label: 'Paragraphs', icon: Layers3 },
              { key: 'statements', label: 'Trechos', icon: FileCode2 },
            ]}
          />
          <div
            className="nav-list"
            role="tabpanel"
            id={`navigation-panel-${sidebar}`}
            aria-labelledby={`navigation-tab-${sidebar}`}
            tabIndex={0}
          >
            <div className="list-caption">
              {query ? `${filteredResults} de ${totalResults}` : filteredResults}{' '}
              {sidebar === 'files'
                ? 'ACESSOS A ARQUIVOS'
                : sidebar === 'calls'
                  ? 'CHAMADAS'
                  : sidebar === 'paragraphs'
                    ? 'REGIÕES'
                    : 'TRECHOS'}
            </div>
            {(sidebar === 'calls' || sidebar === 'files') &&
              shownSites.map((s) => (
                <button
                  key={s.id}
                  className={`nav-item ${site?.id === s.id ? 'active' : ''}`}
                  onClick={() => selectSite(s)}
                  title={s.title}
                  aria-current={site?.id === s.id ? 'true' : undefined}
                >
                  <span
                    className={`nav-kind ${s.family === 'file' ? 'file-kind' : s.command === 'CALL' ? '' : 'cics'}`}
                  >
                    {s.family === 'file' ? <FolderOpen size={15} /> : <PhoneOutgoing size={15} />}
                  </span>
                  <span className="nav-item-body">
                    <strong>{s.title}</strong>
                    <span>
                      {(s.statement?.location ?? s.location) && (
                        <span className="site-location">
                          {(s.statement?.location ?? s.location)!.file}:
                          {(s.statement?.location ?? s.location)!.startLine}
                        </span>
                      )}
                      {s.sourceOnly
                        ? 'Sem controle publicado'
                        : `${s.candidates.length} ${s.family === 'file' ? 'valores possíveis' : 'candidatos'}`}
                      {s.raw.effectiveUnknownRemainder || s.raw.unknownRemainder ? ' · aberto' : ''}
                      {s.declarations?.length
                        ? ` · ${s.declarations.map((d) => d.logicalFile).join(', ')}`
                        : ''}
                    </span>
                    {s.candidates.length > 0 && (
                      <span
                        className="site-values"
                        title={s.candidates.map((c) => c.referenceName ?? c.name).join(', ')}
                      >
                        →{' '}
                        {s.candidates
                          .slice(0, 2)
                          .map((c) => c.referenceName ?? c.name ?? 'Sem nome interpretado')
                          .join(' · ')}
                        {s.candidates.length > 2 ? ` · +${s.candidates.length - 2}` : ''}
                      </span>
                    )}
                    {s.nodeIds
                      .map((id) => model?.nodeById.get(id))
                      .filter((n) => n && n.contexts > 1)
                      .map((n) => (
                        <span key={n!.id}>
                          Contexto {n!.contextIndex}/{n!.contexts}
                        </span>
                      ))}
                  </span>
                  <ChevronRight size={13} />
                </button>
              ))}
            {sidebar === 'paragraphs' &&
              shownParagraphs.map((p) => (
                <button
                  key={p.id}
                  className={`nav-item ${paragraph === p.id ? 'active' : ''}`}
                  onClick={() => {
                    rememberView();
                    setParagraph(p.id);
                    setMode('paragraph');
                    setSelected(p.nodeIds[0]);
                    setSourceTarget(p.location ?? model?.nodeById.get(p.nodeIds[0])?.location);
                    setSelectionSerial((n) => n + 1);
                    setSelectedSite(undefined);
                  }}
                >
                  <Layers3 size={15} />
                  <span className="nav-item-body">
                    <strong>{p.title}</strong>
                    <span>
                      {p.nodeIds.length} trechos · {p.unit}
                    </span>
                  </span>
                  <ChevronRight size={13} />
                </button>
              ))}
            {sidebar === 'statements' &&
              foundNodes.map((n) => (
                <button
                  key={n.id}
                  className={`nav-item ${n.id === selected ? 'active' : ''}`}
                  onClick={() => {
                    selectNode(n.id);
                  }}
                >
                  <span className="line-number">{n.location?.startLine ?? '·'}</span>
                  <span className="nav-item-body">
                    <strong>{n.title}</strong>
                    <span>
                      {n.contexts > 1 ? `Contexto ${n.contextIndex}/${n.contexts}` : n.subtitle}
                    </span>
                  </span>
                </button>
              ))}
            {(((sidebar === 'calls' || sidebar === 'files') && !shownSites.length) ||
              (sidebar === 'paragraphs' && !shownParagraphs.length) ||
              (sidebar === 'statements' && !foundNodes.length)) && (
              <div className="empty-note" role="status">
                {query
                  ? `Nenhum resultado para “${query}” nesta categoria.`
                  : sidebar === 'paragraphs'
                    ? 'Sem paragraphs correlacionados. Inclua SP e links.json.'
                    : 'Nenhuma ocorrência publicada nesta entrada.'}
                {query && (
                  <button className="clear-results" onClick={() => setQuery('')}>
                    Mostrar todos
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="navigator-footer">
            <span className="live-dot" />
            Fluxo publicado pelo analisador<span>SP → AIR → CFG</span>
          </div>
        </aside>
        <main className="graph-panel">
          <div className="graph-toolbar">
            <button
              className="back-button"
              disabled={!history.length}
              onClick={goBack}
              title="Voltar à visão anterior (Esc)"
            >
              <ArrowLeft size={15} /> Voltar
            </button>
            <div className="view-switch">
              <button
                className={mode === 'all' ? 'chosen' : ''}
                aria-pressed={mode === 'all'}
                onClick={() => {
                  if (mode !== 'all') rememberView();
                  setMode('all');
                  setParagraph('');
                }}
              >
                <GitBranch size={14} /> Programa inteiro
              </button>
              <button
                className={mode === 'local' ? 'chosen' : ''}
                aria-pressed={mode === 'local'}
                disabled={!selected}
                onClick={() => {
                  if (mode !== 'local') rememberView();
                  setMode('local');
                }}
              >
                <ScanSearch size={14} /> Vizinhança
              </button>
              <button
                className={mode === 'paths' ? 'chosen' : ''}
                aria-pressed={mode === 'paths'}
                disabled={!targetIds.length}
                onClick={pathAction}
              >
                <Route size={14} /> Caminhos
              </button>
            </div>
            <button
              className="icon-button"
              aria-label="Exportar subgrafo selecionado"
              title="Exportar subgrafo"
              onClick={exportSelection}
              disabled={!model}
            >
              <Download size={16} />
            </button>
          </div>
          <div className="graph-context">
            <span>
              <strong>{scope.nodes.length}</strong> de {baseScope.nodes.length} trechos nesta
              entrada <span className="dot-separator">·</span> {scope.edges.length} transições
              {mode === 'paragraph' ? ' · recorte do paragraph' : ''}
            </span>
            <label>
              <input
                type="checkbox"
                checked={highlight}
                onChange={(e) => setHighlight(e.target.checked)}
              />{' '}
              {sidebar === 'files' ? 'Destacar arquivos' : 'Destacar chamadas'}
            </label>
          </div>
          {mode === 'paths' && (
            <div className="path-banner">
              <Route size={16} />
              <span>
                {reach?.reachable
                  ? `${reach.nodes.size} trechos em caminhos conhecidos até:`
                  : 'Sem caminho conhecido a partir desta entrada até:'}
                <button
                  className="path-destination"
                  aria-label="Inspecionar destino do caminho"
                  title={routeCaption}
                  onClick={() => {
                    const targetSite = allSites.find((s) => s.id === routeSite);
                    if (targetSite) selectSite(targetSite);
                    else if (routeTargets[0]) selectNode(routeTargets[0]);
                  }}
                >
                  {routeCaption} <ChevronRight size={13} />
                </button>
                <small>
                  Alcançabilidade estrutural no CFG. Não avalia a viabilidade das condições.
                  {reach?.hasOpenControl ? ' Há controle aberto neste recorte.' : ''}
                </small>
              </span>
              <label>
                <input
                  type="checkbox"
                  checked={witness}
                  onChange={(e) => setWitness(e.target.checked)}
                />{' '}
                Um caminho
              </label>
              <button className="return-view" onClick={goBack}>
                <ArrowLeft size={15} /> Voltar à visão anterior
              </button>
            </div>
          )}
          <SplitWorkspace
            source={
              model && (sourceOpen || viewing)
                ? (controls) => (
                    <SourcePane
                      key={model.documents.cfg.publication.localId}
                      sources={model.documents.sources}
                      requestSerial={sourceRequest}
                      selectionSerial={selectionSerial}
                      location={
                        sourceTarget ??
                        site?.statement?.location ??
                        site?.location ??
                        node?.location
                      }
                      onClose={viewing ? undefined : () => setSourceOpen(false)}
                      {...controls}
                    />
                  )
                : undefined
            }
          >
            {model ? (
              <Graph
                model={model}
                visibleNodes={scope.nodes}
                visibleEdges={scope.edges}
                selected={selected}
                onSelect={selectNode}
                highlightCalls={highlight && sidebar !== 'files'}
                highlightFiles={highlight && sidebar === 'files'}
                viewportRef={graphViewport}
                restoreView={restoreView}
                witnessIds={witness ? new Set(reach?.witness.map((e) => e.id)) : undefined}
              />
            ) : (
              <div className="start-state">
                <Network size={40} />
                <h2>Seu programa, em perspectiva.</h2>
                <p>Abra um pacote de exemplo ou selecione AIR e CFG.</p>
                <button className="primary-button" onClick={() => input.current?.click()}>
                  Abrir artefatos
                </button>
              </div>
            )}
          </SplitWorkspace>
          <button className="coverage-bar" onClick={() => setWarnings(!warnings)}>
            <span className="coverage-tag">
              {model?.documents.cfg.sourceKnowledge?.publicationInventory ?? '—'}
            </span>
            <span>
              Cobertura publicada
              {model?.warnings.length ? ` · ${model.warnings.length} observações` : ''}
            </span>
            <ChevronRight size={14} className={warnings ? 'rotate' : ''} />
          </button>
          {warnings && (
            <div className="coverage-details">
              <p>
                CFG_BUILT indica que o grafo foi produzido. O estado de cobertura e os remainders
                permanecem os publicados.
              </p>
              {model?.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
              <p>
                Dependencies: {model?.documents.dependencies?.analysisStatus ?? 'não carregado'} ·{' '}
                {model?.documents.dependencies?.modelScope ?? 'escopo não publicado'}
              </p>
            </div>
          )}
        </main>
        {model && (
          <Inspector
            model={model}
            entry={entry}
            node={node}
            site={site}
            onPaths={pathAction}
            onSource={() => {
              setSourceOpen(true);
              setSourceTarget(site?.statement?.location ?? site?.location ?? node?.location);
              setSourceRequest((n) => n + 1);
            }}
            onOperation={(key) => {
              const ids = model.operationNodes.get(key);
              const destination =
                scope.nodes.find((n) => ids?.includes(n.id)) ??
                baseScope.nodes.find((n) => ids?.includes(n.id));
              if (destination) selectNode(destination.id);
            }}
            onNode={selectNode}
          />
        )}
      </div>
      {busy && (
        <div className="loading-overlay" role="status">
          <div className="loading-card">
            <Network className="pulse" size={28} />
            <strong>{busy}</strong>
            <span>Artefatos processados nesta aba.</span>
          </div>
        </div>
      )}
      {help && (
        <Modal labelledBy="help-title" onDismiss={() => setHelp(false)}>
          <button
            autoFocus
            className="modal-close icon-button"
            aria-label="Fechar ajuda"
            onClick={() => setHelp(false)}
          >
            <X />
          </button>
          <span className="eyebrow">TRAMA / GUIA RÁPIDO</span>
          <h2 id="help-title">Explore com as evidências à mão.</h2>
          <p>
            Abra um pacote <code>.json.gz</code> ou selecione vários arquivos de uma mesma execução.
          </p>
          <ol>
            <li>
              <strong>AIR + CFG</strong> fornecem o grafo e a provenance.
            </li>
            <li>
              <strong>SP + links.json</strong> conectam statements, entradas e paragraphs por
              identidade. O exportador Java deste projeto gera os links e seus hashes.
            </li>
            <li>
              <strong>dependencies.json</strong> fornece candidatos, suportes e remainders.
            </li>
            <li>
              <strong>Fontes .cbl/.cpy</strong> são opcionais. Seus nomes devem corresponder aos
              nomes lógicos da provenance.
            </li>
          </ol>
          <p>
            Selecione uma chamada ou um acesso a arquivo e use <strong>Caminhos até aqui</strong>. O
            recorte inclui o que é alcançável a partir da entrada e consegue chegar à seleção pelas
            arestas publicadas.
          </p>
          <p>
            Use Voltar (Esc) para restaurar a visão anterior. Código fonte abre o arquivo completo
            ao lado da exploração. No grafo 3D, arraste para girar, use o botão direito para
            deslocar e a roda para aproximar. As caixas ficam voltadas para você. Centralizar
            seleção reencontra o trecho sem alterar o zoom; Enquadrar recorte mostra o grafo
            visível. Nas abas, use as setas, Home e End; Enter ou Espaço selecionam um trecho. Com
            foco no grafo, as setas giram a câmera, Home enquadra, F centraliza e Espaço pausa as
            partículas. Elas indicam o sentido das arestas, sem representar uma execução do
            programa. Esc fecha esta ajuda.
          </p>
          <p>
            Modo de visualização mostra apenas grafo e código; Esc retorna à exploração. Arraste a
            divisória entre os painéis para ajustar seus tamanhos. Com foco na divisória, use ←/→
            para ajustar, Home/End para os limites e Enter para restaurar a proporção inicial.
          </p>
          <div className="privacy-note">
            <ShieldCheck size={18} />
            <span>
              Os arquivos ficam na memória desta aba. Não há upload, conta, telemetria ou
              armazenamento persistente.
            </span>
          </div>
        </Modal>
      )}
    </div>
  );
}
function assertTotal(list: FileList | File[]) {
  if (Array.from(list).reduce((sum, f) => sum + f.size, 0) > MAX_BYTES)
    throw new Error('A seleção excede 128 MiB. Abra uma publicação por vez.');
}
export default App;
