import { useEffect, useRef, useState, type RefObject } from 'react';
import ForceGraph3D, { type ForceGraph3DInstance } from '3d-force-graph';
import { Sprite, SpriteMaterial, Vector3, PerspectiveCamera, type CanvasTexture } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Plus,
  Minus,
  Focus,
  Scan,
  Pause,
  Play,
  RotateCcw,
  Box,
  LoaderCircle,
  BookOpen,
} from 'lucide-react';
import type { GraphNode, GraphEdge, Model } from './model';
import {
  CARD_WIDTH,
  CARD_HEIGHT,
  DETAIL_LIMIT,
  cardTexture,
  category,
  edgeColor,
  edgeDescription,
  type SceneNode,
  type SceneLink,
  type Point3D,
  type GraphViewport,
} from './graph3d';
import './graph3d.css';

export type { GraphViewport } from './graph3d';
type Props = {
  model: Model;
  visibleNodes: GraphNode[];
  visibleEdges: GraphEdge[];
  selected?: string;
  onSelect: (id: string) => void;
  highlightCalls: boolean;
  highlightFiles?: boolean;
  viewportRef?: RefObject<GraphViewport | undefined>;
  restoreView?: { id: number; viewport: GraphViewport };
  focusIds?: Set<string>;
  witnessIds?: Set<string>;
  onReady?: () => void;
};
type Target = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
};
type Instance = ForceGraph3DInstance<SceneNode, SceneLink>;
const point = (v: Vector3): Point3D => ({ x: v.x, y: v.y, z: v.z });

export function Graph(props: Props) {
  const live = useRef(props);
  live.current = props;
  const surface = useRef<HTMLDivElement>(null),
    host = useRef<HTMLDivElement>(null);
  const graph = useRef<Instance | null>(null);
  const nodes = useRef<SceneNode[]>([]);
  const sprites = useRef(new Map<string, Sprite>());
  const textures = useRef(new Map<string, CanvasTexture>());
  const shared = useRef(new Map<string, CanvasTexture>());
  const layouts = useRef(new Map<string, (Point3D & { id: string })[]>());
  const cachedModel = useRef<Model | undefined>(undefined);
  const layoutPending = useRef(true);
  const pointer = useRef<{ clientX: number; clientY: number } | undefined>(undefined);
  const appliedSelection = useRef<string | undefined>(undefined);
  const restored = useRef(0),
    initialized = useRef(false);
  const refresh = useRef<() => void>(() => {});
  const [instanceReady, setInstanceReady] = useState(false);
  const [busy, setBusy] = useState(true),
    [error, setError] = useState('');
  const [targets, setTargets] = useState<Target[]>([]);
  const [motion, setMotion] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const motionRef = useRef(motion);
  motionRef.current = motion;
  const detailIds = useRef(new Set<string>());
  const [hover, setHover] = useState('');

  // Selected cards draw in front for readability; hit testing uses the same foreground rule.
  function selectedAt(event = pointer.current) {
    if (!event) return undefined;
    const card = surface.current
      ?.querySelector('.graph-node-target.is-selected')
      ?.getBoundingClientRect();
    if (
      card &&
      event.clientX >= card.left &&
      event.clientX <= card.right &&
      event.clientY >= card.top &&
      event.clientY <= card.bottom
    )
      return nodes.current.find((n) => n.id === live.current.selected);
  }
  function selectInScene(node: SceneNode) {
    live.current.onSelect(node.id);
    appliedSelection.current = node.id;
    focus(node.id, true, true);
  }
  function capture() {
    const g = graph.current;
    if (!g) return;
    const camera = g.camera(),
      controls = g.controls() as OrbitControls;
    const view = {
      position: point(camera.position),
      target: point(controls.target),
      up: point(camera.up),
    };
    if (live.current.viewportRef) live.current.viewportRef.current = view;
    surface.current?.setAttribute('data-camera', JSON.stringify(view));
    surface.current?.setAttribute(
      'data-distance',
      String(camera.position.distanceTo(controls.target)),
    );
  }
  function move(position: Point3D, target: Point3D) {
    const g = graph.current;
    if (!g) return;
    // Immediate moves keep history exact; direct selection flights use the library transition below.
    g.cameraPosition(position, target, 0);
    (g.controls() as OrbitControls).update();
    capture();
    refresh.current();
  }
  function focus(id: string | undefined, animate = false, first = false) {
    const g = graph.current,
      node = nodes.current.find((n) => n.id === id);
    if (!g || !node) return;
    const controls = g.controls() as OrbitControls;
    const offset = g.camera().position.clone().sub(controls.target);
    const camera = g.camera() as PerspectiveCamera;
    const readableWidth = Math.min(300, g.width() * 0.7);
    const readingDistance =
      (CARD_WIDTH * g.height()) / (2 * Math.tan((camera.fov * Math.PI) / 360) * readableWidth);
    const distance = first ? readingDistance : Math.max(150, offset.length());
    if (offset.lengthSq() < 1) offset.set(0.3, 0.15, 1);
    offset.normalize().multiplyScalar(distance);
    const position = point(offset.add(new Vector3(node.x, node.y, node.z)));
    if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      g.cameraPosition(position, node, 550);
    } else move(position, node);
  }
  function fit() {
    const g = graph.current;
    if (!g || !nodes.current.length) return;
    const min = new Vector3(Infinity, Infinity, Infinity),
      max = min.clone().negate();
    nodes.current.forEach((n) => {
      const p = new Vector3(n.x, n.y, n.z);
      min.min(p);
      max.max(p);
    });
    const target = min.clone().add(max).multiplyScalar(0.5);
    const camera = g.camera() as PerspectiveCamera;
    const direction = new Vector3(0.25, 0.12, 1).normalize();
    const right = new Vector3(0, 1, 0).cross(direction).normalize();
    const up = direction.clone().cross(right).normalize();
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    let distance = 150;
    for (const n of nodes.current) {
      const p = new Vector3(n.x, n.y, n.z).sub(target);
      distance = Math.max(
        distance,
        direction.dot(p) + (Math.abs(right.dot(p)) + CARD_WIDTH / 2) / (tan * camera.aspect * 0.88),
        direction.dot(p) + (Math.abs(up.dot(p)) + CARD_HEIGHT / 2) / (tan * 0.76),
      );
    }
    move(point(direction.multiplyScalar(distance).add(target)), point(target));
  }

  function zoom(factor: number) {
    const g = graph.current;
    if (!g) return;
    const target = (g.controls() as OrbitControls).target;
    const offset = g.camera().position.clone().sub(target);
    offset.setLength(Math.max(150, Math.min(100000, offset.length() * factor)));
    move(point(offset.add(target)), point(target));
  }
  function rotate(horizontal: number, vertical = 0) {
    const g = graph.current;
    if (!g) return;
    const target = (g.controls() as OrbitControls).target;
    const offset = g.camera().position.clone().sub(target);
    offset.applyAxisAngle(new Vector3(0, 1, 0), horizontal);
    offset.applyAxisAngle(new Vector3(1, 0, 0), vertical);
    move(point(offset.add(target)), point(target));
  }
  function clearCards() {
    sprites.current.forEach((s) => s.material.dispose());
    sprites.current.clear();
    textures.current.forEach((t) => t.dispose());
    textures.current.clear();
    detailIds.current.clear();
    setTargets([]);
  }

  useEffect(() => {
    const el = host.current!;
    let g: Instance;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    try {
      g = new ForceGraph3D(el, {
        controlType: 'orbit',
        rendererConfig: { antialias: true, alpha: false },
      }) as unknown as Instance;
      graph.current = g;
      g.backgroundColor('#111c2c')
        .showNavInfo(false)
        .enableNodeDrag(false)
        .cooldownTicks(0)
        .nodeThreeObjectExtend(false)
        .linkOpacity(0.65)
        .nodeThreeObject((n) => {
          if (!shared.current.has(n.category))
            shared.current.set(n.category, cardTexture(n.category));
          const sprite = new Sprite(
            new SpriteMaterial({
              map: shared.current.get(n.category),
              depthWrite: true,
              alphaTest: 0.2,
            }),
          );
          sprite.scale.set(CARD_WIDTH, CARD_HEIGHT, 1);
          sprites.current.set(n.id, sprite);
          return sprite;
        })
        .nodeLabel((n) => {
          const label = document.createElement('div');
          label.textContent = (selectedAt() ?? n).node.title;
          return label;
        })
        .linkLabel((l) => {
          const label = document.createElement('div');
          label.textContent = `${edgeDescription(l.edge)}: ${live.current.model.nodeById.get(l.edge.source)?.title} → ${live.current.model.nodeById.get(l.edge.target)?.title}`;
          return label;
        })
        .linkColor((l) => edgeColor(l.edge, live.current.witnessIds))
        .linkWidth((l) => (live.current.witnessIds?.has(l.id) ? 1.7 : 0))
        .linkCurvature((l) => (l.edge.source === l.edge.target ? 0.6 : 0.12))
        .linkCurveRotation((l) => l.rotation)
        .linkDirectionalArrowLength(12)
        .linkDirectionalArrowRelPos(0.65)
        .linkDirectionalArrowResolution(4)
        .linkDirectionalArrowColor((l) => edgeColor(l.edge, live.current.witnessIds))
        .linkDirectionalParticleWidth(3)
        .linkDirectionalParticleSpeed(0.004)
        .linkDirectionalParticleResolution(3)
        .linkDirectionalParticleColor((l) => edgeColor(l.edge, live.current.witnessIds))
        .onNodeClick((n, event) => selectInScene(selectedAt(event) ?? n))
        .onNodeHover((n) => setHover(n ? (selectedAt() ?? n).node.title : ''))
        .onLinkClick((l, event) => {
          const target = selectedAt(event) ?? nodes.current.find((n) => n.id === l.edge.target);
          if (target) selectInScene(target);
        });
      const renderer = g.renderer();
      renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
      const canvas = renderer.domElement;
      canvas.tabIndex = 0;
      canvas.setAttribute(
        'aria-label',
        'Grafo 3D: arraste para girar; botão direito desloca; roda aproxima. Setas giram, Home enquadra e F centraliza a seleção.',
      );
      const controls = g.controls() as OrbitControls;
      controls.enableDamping = false;
      controls.minDistance = 150;
      controls.maxDistance = 100000;
      const update = () => {
        if (!active) return;
        capture();
        const camera = g.camera() as PerspectiveCamera;
        camera.updateMatrixWorld();
        const width = el.clientWidth,
          height = el.clientHeight;
        const projected: Target[] = [];
        for (const n of nodes.current) {
          const view = new Vector3(n.x, n.y, n.z).applyMatrix4(camera.matrixWorldInverse);
          if (view.z >= -1) continue;
          const scale = height / (2 * Math.tan((camera.fov * Math.PI) / 360) * -view.z);
          const w = CARD_WIDTH * scale,
            h = CARD_HEIGHT * scale;
          const p = g.graph2ScreenCoords(n.x, n.y, n.z);
          if (
            w < 46 ||
            p.x + w / 2 < 0 ||
            p.x - w / 2 > width ||
            p.y + h / 2 < 0 ||
            p.y - h / 2 > height
          )
            continue;
          projected.push({
            id: n.id,
            label: n.node.title,
            x: p.x - w / 2,
            y: p.y - h / 2,
            width: w,
            height: h,
            depth: -view.z,
          });
        }
        projected.sort((a, b) =>
          a.id === live.current.selected
            ? -1
            : b.id === live.current.selected
              ? 1
              : a.depth - b.depth,
        );
        const visible = projected.slice(0, DETAIL_LIMIT),
          ids = new Set(visible.map((p) => p.id));
        const particleChanges =
          ids.size !== detailIds.current.size || [...ids].some((id) => !detailIds.current.has(id));
        detailIds.current = ids;
        for (const n of nodes.current) {
          const sprite = sprites.current.get(n.id);
          if (!sprite) continue;
          const key = n.id + (n.id === live.current.selected ? '/selected' : '');
          if (ids.has(n.id)) {
            if (!textures.current.has(key))
              textures.current.set(key, cardTexture(n, n.id === live.current.selected));
            sprite.material.map = textures.current.get(key)!;
          } else sprite.material.map = shared.current.get(n.category)!;
          sprite.renderOrder = n.id === live.current.selected ? 100 : 0;
          sprite.material.depthTest = n.id !== live.current.selected;
          sprite.material.opacity =
            n.id !== live.current.selected &&
            ((live.current.highlightCalls && !n.node.siteIds.length) ||
              (live.current.highlightFiles && !n.node.fileSiteIds.length) ||
              (live.current.focusIds && !live.current.focusIds.has(n.id)))
              ? 0.25
              : 1;
        }
        const used = new Set(
          visible.map((t) => t.id + (t.id === live.current.selected ? '/selected' : '')),
        );
        textures.current.forEach((t, key) => {
          if (!used.has(key)) {
            t.dispose();
            textures.current.delete(key);
          }
        });
        if (particleChanges) updateParticles();
        setTargets(visible);
        surface.current?.setAttribute('data-textures', String(textures.current.size));
      };
      const schedule = () => {
        capture();
        if (!timer)
          timer = setTimeout(() => {
            timer = undefined;
            update();
          }, 80);
      };
      refresh.current = update;
      controls.addEventListener('change', schedule);
      const resize = new ResizeObserver(([entry]) => {
        if (!entry.contentRect.width || !entry.contentRect.height) return;
        g.width(entry.contentRect.width).height(entry.contentRect.height);
        schedule();
      });
      resize.observe(el);
      const lost = (event: Event) => {
        event.preventDefault();
        setError('O contexto WebGL foi perdido. Recarregue a página para retomar o experimento.');
      };
      canvas.addEventListener('webglcontextlost', lost);
      const visibility = () => {
        if (document.hidden) g.pauseAnimation();
        else g.resumeAnimation();
      };
      document.addEventListener('visibilitychange', visibility);
      setInstanceReady(true);
      return () => {
        active = false;
        if (timer) clearTimeout(timer);
        resize.disconnect();
        controls.removeEventListener('change', schedule);
        document.removeEventListener('visibilitychange', visibility);
        canvas.removeEventListener('webglcontextlost', lost);
        clearCards();
        shared.current.forEach((t) => t.dispose());
        shared.current.clear();
        g._destructor();
        renderer.dispose();
        renderer.forceContextLoss();
        el.replaceChildren();
        graph.current = null;
      };
    } catch (e) {
      setError(`Não foi possível iniciar WebGL: ${e instanceof Error ? e.message : String(e)}`);
      setBusy(false);
    }
  }, []);

  function updateParticles() {
    graph.current?.linkDirectionalParticles((l) =>
      motionRef.current &&
      (nodes.current.length <= 500 ||
        detailIds.current.has(l.edge.source) ||
        detailIds.current.has(l.edge.target))
        ? 2
        : 0,
    );
  }
  useEffect(() => {
    updateParticles();
  }, [motion]);
  useEffect(() => {
    if (!instanceReady) return;
    let cancelled = false;
    let worker: Worker | undefined;
    let frame = 0;
    layoutPending.current = true;
    setBusy(true);
    setError('');
    if (cachedModel.current !== props.model) {
      layouts.current.clear();
      cachedModel.current = props.model;
      initialized.current = false;
      restored.current = 0;
    }
    const layoutKey = JSON.stringify([
      props.visibleNodes.map((n) => n.id),
      props.visibleEdges.map((e) => e.id),
    ]);
    const install = (points: { id: string; x: number; y: number; z: number }[]) => {
      if (cancelled) return;
      layouts.current.delete(layoutKey);
      layouts.current.set(layoutKey, points);
      if (layouts.current.size > 16) layouts.current.delete(layouts.current.keys().next().value!);
      const positions = new Map(points.map((p) => [p.id, p]));
      clearCards();
      const paragraphs = new Map(props.model.paragraphs.map((p) => [p.id, p.title]));
      const candidates = new Map(
        [...props.model.sites, ...props.model.fileSites].map((s) => [s.id, s.candidates.length]),
      );
      nodes.current = props.visibleNodes.map((node) => {
        const p = positions.get(node.id)!;
        return {
          id: node.id,
          node,
          category: category(node),
          paragraph: paragraphs.get(node.paragraph ?? '') ?? '',
          candidates: [...node.siteIds, ...node.fileSiteIds].reduce(
            (sum, id) => sum + (candidates.get(id) ?? 0),
            0,
          ),
          x: p.x,
          y: p.y,
          z: p.z,
          fx: p.x,
          fy: p.y,
          fz: p.z,
        };
      });
      const groups = new Map<string, GraphEdge[]>();
      for (const edge of props.visibleEdges) {
        const key = JSON.stringify([edge.source, edge.target]);
        groups.set(key, [...(groups.get(key) ?? []), edge]);
      }
      const links: SceneLink[] = [...groups.values()].flatMap((edges) =>
        edges.map((edge, index) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          edge,
          rotation: (2 * Math.PI * index) / edges.length,
        })),
      );

      graph.current!.graphData({ nodes: nodes.current, links });
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (cancelled) return;
          const restore = live.current.restoreView;
          if (restore && restore.id !== restored.current) {
            restored.current = restore.id;
            graph
              .current!.camera()
              .up.set(restore.viewport.up.x, restore.viewport.up.y, restore.viewport.up.z);
            move(restore.viewport.position, restore.viewport.target);
          } else if (
            live.current.selected &&
            nodes.current.some((n) => n.id === live.current.selected)
          )
            focus(live.current.selected, false, !initialized.current);
          else fit();
          initialized.current = true;
          appliedSelection.current = live.current.selected;
          layoutPending.current = false;
          setBusy(false);
          updateParticles();
          refresh.current();
          live.current.onReady?.();
        });
      });
    };
    const cached = layouts.current.get(layoutKey);
    if (cached) install(cached);
    else if (!props.visibleNodes.length) install([]);
    else {
      worker = new Worker(new URL('./force-layout.worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => {
        if (cancelled) return;
        if (data.error) {
          setError(`Falha no layout 3D: ${data.error}`);
          setBusy(false);
        } else install(data.nodes);
        worker?.terminate();
      };
      worker.onerror = () => {
        if (!cancelled) {
          setError(
            'Falha ao distribuir as caixas no espaço 3D. Recarregue a página para tentar novamente.',
          );
          setBusy(false);
        }
      };
      worker.postMessage({
        nodes: props.visibleNodes.map((n) => n.id),
        links: props.visibleEdges.map((e) => ({ source: e.source, target: e.target })),
      });
    }
    return () => {
      cancelled = true;
      worker?.terminate();
      cancelAnimationFrame(frame);
    };
  }, [props.model, props.visibleNodes, props.visibleEdges, instanceReady]);

  useEffect(() => {
    if (layoutPending.current || busy || !instanceReady) return;
    if (props.restoreView && props.restoreView.id !== restored.current) {
      restored.current = props.restoreView.id;
      graph
        .current!.camera()
        .up.set(
          props.restoreView.viewport.up.x,
          props.restoreView.viewport.up.y,
          props.restoreView.viewport.up.z,
        );
      move(props.restoreView.viewport.position, props.restoreView.viewport.target);
    } else if (props.selected !== appliedSelection.current) focus(props.selected);
    appliedSelection.current = props.selected;
    refresh.current();
  }, [props.selected, props.restoreView, busy, instanceReady]);
  useEffect(() => {
    refresh.current();
    graph.current
      ?.linkColor((l) => edgeColor(l.edge, props.witnessIds))
      .linkWidth((l) => (props.witnessIds?.has(l.id) ? 1.7 : 0));
  }, [props.highlightCalls, props.highlightFiles, props.focusIds, props.witnessIds]);

  return (
    <div
      ref={surface}
      className="graph-surface graph3d"
      data-testid="graph"
      aria-label="Grafo de controle 3D"
      aria-busy={busy}
      data-nodes={props.visibleNodes.length}
      data-edges={props.visibleEdges.length}
      data-witness-edges={props.witnessIds?.size ?? 0}
      data-motion={motion ? 'on' : 'off'}
      onPointerMove={(e) => {
        pointer.current = { clientX: e.clientX, clientY: e.clientY };
      }}
      onPointerLeave={() => {
        pointer.current = undefined;
      }}
      onKeyDown={(e) => {
        if (e.target !== host.current?.querySelector('canvas')) return;
        if (
          [
            'ArrowLeft',
            'ArrowRight',
            'ArrowUp',
            'ArrowDown',
            '+',
            '-',
            'Home',
            'f',
            'F',
            ' ',
          ].includes(e.key)
        )
          e.preventDefault();
        if (e.key === 'ArrowLeft') rotate(-0.12);
        if (e.key === 'ArrowRight') rotate(0.12);
        if (e.key === 'ArrowUp') rotate(0, -0.12);
        if (e.key === 'ArrowDown') rotate(0, 0.12);
        if (e.key === '+') zoom(0.8);
        if (e.key === '-') zoom(1.25);
        if (e.key === 'Home') fit();
        if (e.key.toLowerCase() === 'f') focus(props.selected);
        if (e.key === ' ') setMotion((m) => !m);
      }}
    >
      <div ref={host} className="graph3d-canvas" />
      <div className="graph3d-targets" aria-label="Caixas visíveis no espaço 3D">
        {targets.map((t) => (
          <button
            key={t.id}
            className={`graph-node-target ${props.selected === t.id ? 'is-selected' : ''}`}
            aria-label={t.label}
            aria-pressed={props.selected === t.id}
            data-node-id={t.id}
            style={{ left: t.x, top: t.y, width: t.width, height: t.height }}
            onClick={() => {
              props.onSelect(t.id);
              appliedSelection.current = t.id;
              focus(t.id, true, true);
            }}
          >
            <span className="sr-only">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="graph3d-controls" role="group" aria-label="Navegação do grafo 3D">
        <span title="Experimento 3D">
          <Box size={15} />
          <b>3D</b>
        </span>
        <button aria-label="Aumentar zoom" title="Aproximar (+)" onClick={() => zoom(0.8)}>
          <Plus size={16} />
        </button>
        <button aria-label="Diminuir zoom" title="Afastar (-)" onClick={() => zoom(1.25)}>
          <Minus size={16} />
        </button>
        <button aria-label="Enquadrar recorte" title="Enquadrar recorte (Home)" onClick={fit}>
          <Scan size={16} />
        </button>
        <button
          aria-label="Centralizar seleção"
          title="Centralizar seleção (F)"
          disabled={!props.selected || !nodes.current.some((n) => n.id === props.selected)}
          onClick={() => focus(props.selected)}
        >
          <Focus size={16} />
        </button>
        <button
          aria-label="Ler seleção de perto"
          title="Aproximar para ler a seleção"
          disabled={!props.selected || !nodes.current.some((n) => n.id === props.selected)}
          onClick={() => focus(props.selected, true, true)}
        >
          <BookOpen size={16} />
        </button>
        <button
          aria-label="Vista frontal"
          title="Voltar à orientação frontal"
          onClick={() => {
            const g = graph.current;
            if (g) {
              const c = g.controls() as OrbitControls;
              move(
                point(
                  c.target.clone().add(new Vector3(0, 0, g.camera().position.distanceTo(c.target))),
                ),
                point(c.target),
              );
            }
          }}
        >
          <RotateCcw size={16} />
        </button>
        <button
          aria-label={motion ? 'Pausar partículas' : 'Animar partículas'}
          title="Partículas indicam o sentido das transições"
          aria-pressed={motion}
          onClick={() => setMotion((m) => !m)}
        >
          {motion ? <Pause size={16} /> : <Play size={16} />}
        </button>
      </div>
      {busy && (
        <div className="layout-status" role="status">
          <LoaderCircle className="spin" size={16} /> Distribuindo {props.visibleNodes.length}{' '}
          caixas em 3D…
        </div>
      )}
      {error && (
        <div className="layout-status error" role="alert">
          {error}
        </div>
      )}
      {!busy && !props.visibleNodes.length && (
        <div className="graph-empty">
          <Focus />
          <h3>Nenhum caminho conhecido</h3>
          <p>O CFG não publica um caminho desta entrada até a seleção.</p>
        </div>
      )}
      <div
        className="graph3d-caption"
        title="Arraste para girar · botão direito desloca · roda aproxima. Partículas indicam a direção do CFG."
      >
        <span>{hover || 'Arraste para girar · roda para aproximar'}</span>
        <span>
          {props.visibleNodes.length} caixas · {props.visibleEdges.length} transições
        </span>
      </div>
    </div>
  );
}
