import { useEffect, useRef, useState, type RefObject } from 'react';
import ForceGraph3D, { type ForceGraph3DInstance } from '3d-force-graph';
import {
  Sprite,
  SpriteMaterial,
  MOUSE,
  Vector3,
  Vector2,
  Raycaster,
  PerspectiveCamera,
  type CanvasTexture,
  type Object3D,
} from 'three';
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
  Layers3,
} from 'lucide-react';
import type { GraphNode, GraphEdge, Model } from './model';
import {
  CARD_WIDTH,
  CARD_HEIGHT,
  DETAIL_LIMIT,
  cardTexture,
  category,
  edgeDescription,
  type SceneNode,
  type SceneLink,
  type Point3D,
  type GraphViewport,
} from './graph3d';
import './graph3d.css';
import { planarLayout, type PlanarLayout } from './planar-layout';
import ELK from 'elkjs/lib/elk-api.js';
import elkWorkerUrl from 'elkjs/lib/elk-worker.min.js?url';
import { RoutedLink } from './routed-link';
import { compactProjection } from './compact-layout';
import { linearBlocks, blockExpanded, blockRoute, type LinearBlock } from './linear-blocks';
import {
  diagramIntersection,
  zoomView,
  wheelZoomFactor,
  MIN_ZOOM_DISTANCE,
  MAX_ZOOM_DISTANCE,
} from './graph-navigation';

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
  valueHighlight?: {
    edges: Set<string>;
    producers: Set<string>;
    targets: Set<string>;
    kills: Set<string>;
    unknowns: Set<string>;
    killedEdges: Set<string>;
  };
  onReady?: () => void;
};
type Target = {
  block?: LinearBlock;
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  position: Point3D;
};
type BlockScene = {
  block: LinearBlock;
  node: SceneNode;
  card: Sprite;
  routes: RoutedLink[];
  expanded: boolean;
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
  const cards = useRef(new Map<string, Sprite>());
  const blocks = useRef<BlockScene[]>([]);
  const basePositions = useRef(new Map<string, Point3D>());
  const baseRoutes = useRef(new Map<RoutedLink, Point3D[]>());
  const compactKey = useRef('');
  const collapsedIds = useRef<string[]>([]);
  const framing = useRef(false);
  const opening = useRef<string | undefined>(undefined);
  const openingUntil = useRef(0);
  const restoredBlocks = useRef<Set<string> | undefined>(undefined);
  const [autoBlocks, setAutoBlocks] = useState(true);
  const autoBlocksRef = useRef(autoBlocks);
  autoBlocksRef.current = autoBlocks;
  const [blockCount, setBlockCount] = useState({ collapsed: 0, hidden: 0, total: 0 });
  const routes = useRef(new Map<string, RoutedLink>());
  const textures = useRef(new Map<string, CanvasTexture>());
  const shared = useRef(new Map<string, CanvasTexture>());
  const layouts = useRef(new Map<string, PlanarLayout>());
  const installedLayout = useRef<string | undefined>(undefined);
  const cachedModel = useRef<Model | undefined>(undefined);
  const layoutPending = useRef(true);
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

  function isSelected(n: { id: string; block?: LinearBlock }) {
    return (
      n.id === live.current.selected ||
      !!n.block?.nodes.some((member) => member.id === live.current.selected)
    );
  }
  function selectInScene(node: SceneNode) {
    if (node.block) {
      focus(node.block.nodes[0].id, true, true);
      return;
    }
    // Selection should not move the camera, its pivot, or any card in the diagram.
    appliedSelection.current = node.id;
    live.current.onSelect(node.id);
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
      collapsed: collapsedIds.current,
    };
    if (live.current.viewportRef) live.current.viewportRef.current = view;
    surface.current?.setAttribute(
      'data-camera',
      JSON.stringify({ position: view.position, target: view.target, up: view.up }),
    );
    surface.current?.setAttribute(
      'data-distance',
      String(camera.position.distanceTo(controls.target)),
    );
  }
  function move(position: Point3D, target: Point3D, details = true) {
    const g = graph.current;
    if (!g) return;
    // Immediate moves keep history exact; the explicit reading action can animate below.
    g.cameraPosition(position, target, 0);
    (g.controls() as OrbitControls).update();
    capture();
    if (details) refresh.current();
  }
  function focus(id: string | undefined, animate = false, first = false) {
    const g = graph.current,
      node = nodes.current.find((n) => n.id === id);
    if (!g || !node) return;
    if (animate || blocks.current.some((b) => !b.expanded)) {
      // Restore geometry before calculating the destination, including singleton
      // selections: otherwise an automatic expansion can interrupt the camera flight.
      opening.current = node.id;
      openingUntil.current = Infinity;
      refresh.current();
    }
    const controls = g.controls() as OrbitControls;
    const offset = g.camera().position.clone().sub(controls.target);
    const camera = g.camera() as PerspectiveCamera;
    const readableWidth = Math.min(300, g.width() * 0.7);
    const readingDistance =
      (CARD_WIDTH * g.height()) / (2 * Math.tan((camera.fov * Math.PI) / 360) * readableWidth);
    const distance = first || opening.current ? readingDistance : Math.max(150, offset.length());
    if (!initialized.current || offset.lengthSq() < 1) offset.set(0.4, 0.25, 1);
    offset.normalize().multiplyScalar(distance);
    const position = point(offset.add(new Vector3(node.x, node.y, node.z)));
    if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      openingUntil.current = performance.now() + 600;
      g.cameraPosition(position, node, 550);
    } else {
      openingUntil.current = 0;
      move(position, node);
    }
  }
  function fit(highlightOnly = false) {
    const g = graph.current;
    if (!g || !nodes.current.length) return;
    opening.current = undefined;
    framing.current = !highlightOnly;
    refresh.current();
    const display = [
      ...nodes.current.filter((n) => cards.current.get(n.id)?.visible),
      ...blocks.current.filter((b) => !b.expanded).map((b) => b.node),
    ];
    const points: Point3D[] = display
      .filter((n) => !highlightOnly || live.current.focusIds?.has(n.id))
      .flatMap((n) => [
        { x: n.x - CARD_WIDTH / 2, y: n.y - CARD_HEIGHT / 2, z: 0 },
        { x: n.x + CARD_WIDTH / 2, y: n.y + CARD_HEIGHT / 2, z: 0 },
      ]);
    for (const route of [...routes.current.values(), ...blocks.current.flatMap((b) => b.routes)]) {
      if (
        route.visible &&
        (!highlightOnly || live.current.valueHighlight?.edges.has(route.link.id))
      )
        points.push(...route.link.points);
    }
    if (!points.length) {
      framing.current = false;
      return;
    }
    const min = new Vector3(Infinity, Infinity, Infinity),
      max = min.clone().negate();
    points.forEach((p) => {
      min.min(new Vector3(p.x, p.y, p.z));
      max.max(new Vector3(p.x, p.y, p.z));
    });
    const target = min.add(max).multiplyScalar(0.5);
    const camera = g.camera() as PerspectiveCamera;
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    // Keep even a one-block program in overview until the user explicitly approaches it.
    let distance =
      autoBlocksRef.current && blocks.current.length && !highlightOnly
        ? (CARD_WIDTH * g.height()) / (2 * tan * 130)
        : 150;
    for (const p of points) {
      distance = Math.max(
        distance,
        Math.abs(p.x - target.x) / (tan * camera.aspect * 0.88),
        Math.abs(p.y - target.y) / (tan * 0.76),
      );
    }
    move(point(target.clone().add(new Vector3(0, 0, distance))), point(target));
    framing.current = false;
  }

  function zoom(factor: number, pointer?: Vector2) {
    const g = graph.current;
    if (!g || layoutPending.current) return;
    opening.current = undefined;
    const view = zoomView(
      g.camera() as PerspectiveCamera,
      (g.controls() as OrbitControls).target,
      factor,
      pointer,
    );
    // Details follow the throttled controls change; wheel input never paints textures synchronously.
    move(point(view.position), point(view.target), false);
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
    for (const block of blocks.current) {
      block.card.removeFromParent();
      block.card.material.dispose();
      block.routes.forEach((route) => {
        route.removeFromParent();
        route.dispose();
      });
    }
    blocks.current = [];
    nodes.current = [];
    basePositions.current.clear();
    baseRoutes.current.clear();
    compactKey.current = '';
    collapsedIds.current = [];
    opening.current = undefined;
    cards.current.forEach((s) => {
      // Three.js shares geometry between sprites; only the material belongs to this card.
      s.material.dispose();
    });
    cards.current.clear();
    routes.current.forEach((r) => r.dispose());
    routes.current.clear();
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
      installedLayout.current = undefined;
      initialized.current = false;
      g.backgroundColor('#111c2c')
        .showNavInfo(false)
        .enableNodeDrag(false)
        .enablePointerInteraction(false)
        .cooldownTicks(0)
        .nodeThreeObjectExtend(false)
        .linkOpacity(0.65)
        .nodeThreeObject((n) => {
          if (!shared.current.has(n.category))
            shared.current.set(n.category, cardTexture(n.category));
          const card = new Sprite(
            new SpriteMaterial({
              map: shared.current.get(n.category),
              // Cards are annotations: keep planar routes from crossing their text at oblique angles.
              depthTest: false,
              depthWrite: false,
              transparent: true,
              alphaTest: 0.2,
            }),
          );
          card.scale.set(CARD_WIDTH, CARD_HEIGHT, 1);
          card.renderOrder = 1; // Same layer for every card; distance determines mutual occlusion.
          card.userData.sceneNode = n;
          cards.current.set(n.id, card);
          return card;
        })
        .linkThreeObjectExtend(false)
        .linkThreeObject((l) => {
          const route = new RoutedLink(l);
          route.style(
            live.current.witnessIds,
            live.current.valueHighlight?.edges,
            live.current.valueHighlight?.killedEdges,
          );
          routes.current.set(l.id, route);
          return route;
        })
        .linkPositionUpdate((object) => {
          // The library assigns custom link groups to layer 10; keep all routes below labels.
          object.renderOrder = 0;
          return true;
        })
        .linkDirectionalParticles(0)
        .linkDirectionalArrowLength(0);
      const scene = g.scene();
      const previousRender = scene.onBeforeRender;
      scene.onBeforeRender = (...args) => {
        previousRender.call(scene, ...args);
        // The renderer can reset its far plane during deferred setup. Keep tall diagrams visible.
        const camera = g.camera() as PerspectiveCamera;
        if (camera.near !== 1 || camera.far !== 4000000) {
          camera.near = 1;
          camera.far = 4000000;
          camera.updateProjectionMatrix();
        }
        const time = performance.now();
        routes.current.forEach((route) => {
          if (route.visible) route.tick(time);
        });
        blocks.current.forEach((block) => {
          block.routes.forEach((route) => {
            if (route.visible) route.tick(time);
          });
        });
      };
      const renderer = g.renderer();
      renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
      const canvas = renderer.domElement;
      canvas.tabIndex = 0;
      canvas.setAttribute(
        'aria-label',
        'Grafo 3D: arraste com o botão esquerdo para deslocar; botão direito gira; roda aproxima no cursor; duplo clique aproxima uma caixa. Setas giram, Home enquadra e F centraliza a seleção.',
      );
      // Pick from the current camera at click time. The library's cached hover can lag a fast click.
      const raycaster = new Raycaster();
      let press: { x: number; y: number; dragged: boolean } | undefined;
      const down = (event: PointerEvent) => {
        if (event.button === 0) press = { x: event.clientX, y: event.clientY, dragged: false };
      };
      const drag = (event: PointerEvent) => {
        if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5)
          press.dragged = true;
      };
      const hitAt = (x: number, y: number) => {
        const rect = canvas.getBoundingClientRect();
        raycaster.setFromCamera(
          new Vector2(
            ((x - rect.left) / rect.width) * 2 - 1,
            (-(y - rect.top) / rect.height) * 2 + 1,
          ),
          g.camera(),
        );
        // Match the annotation layer: nearest card first, then exposed routes.
        const hit =
          raycaster.intersectObjects(
            [...cards.current.values(), ...blocks.current.map((b) => b.card)].filter(
              (c) => c.visible,
            ),
            false,
          )[0] ??
          raycaster.intersectObjects(
            [...routes.current.values(), ...blocks.current.flatMap((b) => b.routes)].filter(
              (r) => r.visible,
            ),
            true,
          )[0];
        let object: Object3D | undefined = hit?.object;
        while (object) {
          if (object.userData.sceneNode) {
            return { node: object.userData.sceneNode as SceneNode };
          }
          if (object instanceof RoutedLink) {
            return {
              route: object,
              node: nodes.current.find((n) => n.id === object!.userData.targetId),
            };
          }
          object = object.parent ?? undefined;
        }
      };
      const pick = (event: MouseEvent) => {
        const dragged = press?.dragged;
        press = undefined;
        if (dragged || event.button !== 0 || layoutPending.current) return;
        const hit = hitAt(event.clientX, event.clientY);
        if (hit?.node) selectInScene(hit.node);
      };
      const read = (event: MouseEvent) => {
        if (layoutPending.current) return;
        const hit = hitAt(event.clientX, event.clientY);
        if (hit?.node && !hit.route) focus(hit.node.block?.nodes[0].id ?? hit.node.id, true, true);
      };
      let hoverTimer: ReturnType<typeof setTimeout> | undefined;
      const clearHover = () => {
        clearTimeout(hoverTimer);
        canvas.title = '';
        setHover('');
      };
      const hoverAt = (event: PointerEvent) => {
        clearTimeout(hoverTimer);
        if (event.buttons || layoutPending.current) {
          clearHover();
          return;
        }
        hoverTimer = setTimeout(() => {
          if (!active) return;
          const hit = hitAt(event.clientX, event.clientY);
          const label = hit?.route
            ? `${edgeDescription(hit.route.link.edge)}: ${live.current.model.nodeById.get(hit.route.link.edge.source)?.title} → ${hit.node?.node.title}`
            : hit?.node?.block
              ? `Bloco sequencial · ${hit.node.block.nodes.length} trechos, incluindo chamadas e arquivos. Clique para aproximar e abrir.`
              : (hit?.node?.node.title ?? '');
          canvas.title = label;
          setHover(label);
        }, 100);
      };
      let wheelFrame = 0,
        wheelDelta = 0;
      const pointer = new Vector2();
      const wheel = (event: WheelEvent) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        clearHover();
        if (layoutPending.current) return;
        const rect = canvas.getBoundingClientRect();
        pointer.set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          1 - ((event.clientY - rect.top) / rect.height) * 2,
        );
        wheelDelta +=
          event.deltaY *
          (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1) *
          (event.ctrlKey ? 4 : 1);
        if (!wheelFrame)
          wheelFrame = requestAnimationFrame(() => {
            wheelFrame = 0;
            zoom(wheelZoomFactor(wheelDelta), pointer);
            wheelDelta = 0;
          });
      };
      canvas.addEventListener('wheel', wheel, { capture: true, passive: false });
      canvas.addEventListener('dblclick', read);
      canvas.addEventListener('pointermove', hoverAt);
      canvas.addEventListener('pointerleave', clearHover);
      canvas.addEventListener('pointerdown', down);
      canvas.addEventListener('pointermove', drag);
      canvas.addEventListener('click', pick);
      const controls = g.controls() as OrbitControls;
      controls.mouseButtons.LEFT = MOUSE.PAN;
      controls.mouseButtons.RIGHT = MOUSE.ROTATE;
      controls.enableDamping = false;
      controls.minDistance = MIN_ZOOM_DISTANCE;
      controls.maxDistance = MAX_ZOOM_DISTANCE;
      controls.zoomSpeed = 3;
      const reanchor = () => {
        const camera = g.camera() as PerspectiveCamera;
        const target = diagramIntersection(
          camera.position,
          camera.getWorldDirection(new Vector3()),
        );
        // Changing a collinear target preserves the camera pose. Rebase after pan
        // so the next zoom/orbit uses the diagram, not a point behind it.
        if (
          target &&
          camera.position.distanceTo(target) >= controls.minDistance &&
          target.distanceTo(controls.target) > 0.000001
        ) {
          controls.target.copy(target);
          controls.update();
          capture();
        }
        // Refresh projected boxes at gesture end; hit targets must not lag the final pan.
        refresh.current();
      };
      const interruptMotion = () => {
        clearHover();
        opening.current = undefined;
        // Stop a reading transition at the current pose as soon as the user takes over.
        g.cameraPosition(point(g.camera().position), point(controls.target), 0);
      };
      controls.addEventListener('start', interruptMotion);
      controls.addEventListener('end', reanchor);
      // Centers and routes stay in the layout plane; billboards remain readable from either side.
      controls.minAzimuthAngle = -Infinity;
      controls.maxAzimuthAngle = Infinity;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI;
      const update = () => {
        if (!active) return;
        capture();
        const camera = g.camera() as PerspectiveCamera;
        camera.updateMatrixWorld();
        const width = el.clientWidth,
          height = el.clientHeight;
        const projection = new Map<string, Target>();
        const inViewport = new Set<string>();
        const project = (n: SceneNode) => {
          const view = new Vector3(n.x, n.y, n.z).applyMatrix4(camera.matrixWorldInverse);
          if (view.z >= -1) return;
          const center = g.graph2ScreenCoords(n.x, n.y, n.z);
          const scale = height / (2 * -view.z * Math.tan((camera.fov * Math.PI) / 360));
          const left = center.x - (CARD_WIDTH * scale) / 2,
            top = center.y - (CARD_HEIGHT * scale) / 2;
          const target: Target = {
            id: n.id,
            block: n.block,
            label: n.block
              ? `Bloco sequencial: ${n.block.nodes.length} trechos. ${n.node.title} → ${n.block.nodes.at(-1)!.title}. Aproximar para abrir`
              : n.node.title,
            x: left,
            y: top,
            width: CARD_WIDTH * scale,
            height: CARD_HEIGHT * scale,
            depth: -view.z,
            position: { x: n.x, y: n.y, z: n.z },
          };
          projection.set(n.id, target);
          if (
            left + target.width >= 0 &&
            left <= width &&
            top + target.height >= 0 &&
            top <= height
          )
            inViewport.add(n.id);
        };
        nodes.current.forEach(project);
        blocks.current.forEach((b) => project(b.node));
        const hidden = new Set<string>();
        let collapsed = 0;
        for (const b of blocks.current) {
          const { block } = b;
          const forced =
            !autoBlocksRef.current ||
            !!opening.current ||
            block.nodes.some(
              (n) =>
                live.current.focusIds?.has(n.id) ||
                live.current.valueHighlight?.producers.has(n.id) ||
                live.current.valueHighlight?.targets.has(n.id) ||
                live.current.valueHighlight?.kills.has(n.id) ||
                live.current.valueHighlight?.unknowns.has(n.id),
            ) ||
            block.edges.some(
              (e) =>
                live.current.witnessIds?.has(e.id) || live.current.valueHighlight?.edges.has(e.id),
            );
          // A nearby member expands the whole block, even when its summary is outside the viewport.
          let pixels = 0;
          for (const n of block.nodes) {
            if (inViewport.has(n.id)) pixels = Math.max(pixels, projection.get(n.id)!.width);
          }
          pixels ||= projection.get(block.nodes[0].id)?.width ?? 0;
          b.expanded = restoredBlocks.current
            ? !restoredBlocks.current.has(block.id)
            : blockExpanded(b.expanded, framing.current ? 0 : pixels, forced);
          b.card.visible = !b.expanded;
          for (const route of b.routes) {
            route.visible = !b.expanded;
            const original = routes.current.get(route.link.id);
            if (original) original.visible = b.expanded;
          }
          for (const edge of block.edges) {
            const route = routes.current.get(edge.id);
            if (route) route.visible = b.expanded;
          }
          if (!b.expanded) {
            collapsed++;
            block.nodes.forEach((n) => hidden.add(n.id));
          }
        }
        cards.current.forEach((card, id) => {
          card.visible = !hidden.has(id);
        });
        const displayNodes = [
          ...nodes.current.filter((n) => !hidden.has(n.id)),
          ...blocks.current.filter((b) => !b.expanded).map((b) => b.node),
        ];
        const displayCards = new Map(cards.current);
        blocks.current.forEach((b) => displayCards.set(b.node.id, b.card));
        const collapsedBlocks = blocks.current.filter((b) => !b.expanded).map((b) => b.block.id);
        const key = collapsedBlocks.join('|');
        collapsedIds.current = collapsedBlocks;
        if (key !== compactKey.current) {
          // Retain the nearest visible reference while the empty bands open/close.
          // History restoration supplies an exact camera already expressed in the saved layout.
          const controls = g.controls() as OrbitControls;
          const anchor = displayNodes
            .filter((n) => projection.has(n.id) && inViewport.has(n.id))
            .sort((a, b) => {
              const p = projection.get(a.id)!,
                q = projection.get(b.id)!;
              return (
                Math.hypot(p.x + p.width / 2 - width / 2, p.y + p.height / 2 - height / 2) -
                Math.hypot(q.x + q.width / 2 - width / 2, q.y + q.height / 2 - height / 2)
              );
            })[0];
          const before = anchor ? new Vector3(anchor.x, anchor.y, anchor.z) : undefined;
          const transform = collapsed
            ? compactProjection(displayNodes.map((n) => basePositions.current.get(n.id)!))
            : (p: Point3D) => p;
          for (const n of [...nodes.current, ...blocks.current.map((b) => b.node)]) {
            const p = transform(basePositions.current.get(n.id)!);
            n.x = n.fx = p.x;
            n.y = n.fy = p.y;
            n.z = n.fz = p.z;
            displayCards.get(n.id)?.position.set(p.x, p.y, p.z);
          }
          routes.current.forEach((route) => {
            if (!baseRoutes.current.has(route)) baseRoutes.current.set(route, route.link.points);
          });
          baseRoutes.current.forEach((points, route) => route.setPoints(points.map(transform)));
          compactKey.current = key;
          if (anchor && before && !framing.current && !restoredBlocks.current) {
            const delta = new Vector3(anchor.x, anchor.y, anchor.z).sub(before);
            g.cameraPosition(
              point(camera.position.clone().add(delta)),
              point(controls.target.clone().add(delta)),
              0,
            );
          }
          camera.updateMatrixWorld();
          projection.clear();
          inViewport.clear();
          nodes.current.forEach(project);
          blocks.current.forEach((b) => project(b.node));
        }
        restoredBlocks.current = undefined;
        if (
          opening.current &&
          performance.now() >= openingUntil.current &&
          (projection.get(opening.current)?.width ?? 0) > 180
        )
          opening.current = undefined;
        capture();
        const projected = displayNodes
          .filter((n) => inViewport.has(n.id) && projection.get(n.id)!.width >= 46)
          .map((n) => projection.get(n.id)!);
        setBlockCount((previous) =>
          previous.collapsed === collapsed &&
          previous.hidden === hidden.size &&
          previous.total === blocks.current.length
            ? previous
            : { collapsed, hidden: hidden.size, total: blocks.current.length },
        );
        surface.current?.setAttribute('data-collapsed-blocks', String(collapsed));
        surface.current?.setAttribute('data-rendered-nodes', String(displayNodes.length));
        const ys = displayNodes.map((n) => n.y);
        const originalYs = nodes.current.map((n) => basePositions.current.get(n.id)!.y);
        surface.current?.setAttribute(
          'data-rendered-height',
          String(ys.length ? Math.max(...ys) - Math.min(...ys) : 0),
        );
        surface.current?.setAttribute(
          'data-full-height',
          String(originalYs.length ? Math.max(...originalYs) - Math.min(...originalYs) : 0),
        );
        projected.sort((a, b) => (isSelected(a) ? -1 : isSelected(b) ? 1 : a.depth - b.depth));
        const visible = projected.slice(0, DETAIL_LIMIT),
          ids = new Set(visible.map((p) => p.id));
        const particleChanges =
          ids.size !== detailIds.current.size || [...ids].some((id) => !detailIds.current.has(id));
        detailIds.current = ids;
        for (const n of displayNodes) {
          const card = displayCards.get(n.id);
          if (!card) continue;
          const role = live.current.valueHighlight?.kills.has(n.id)
            ? 'kill'
            : live.current.valueHighlight?.unknowns.has(n.id)
              ? 'unknown'
              : live.current.valueHighlight?.producers.has(n.id)
                ? 'definition'
                : live.current.valueHighlight?.targets.has(n.id)
                  ? 'destination'
                  : undefined;
          const key = n.id + (isSelected(n) ? '/selected' : '') + (role ?? '');
          if (ids.has(n.id)) {
            const texture = textures.current.get(key) ?? cardTexture(n, isSelected(n), role);
            textures.current.delete(key);
            textures.current.set(key, texture);
            card.material.map = texture;
          } else {
            const sharedKey = n.category + (role ?? '');
            if (!shared.current.has(sharedKey))
              shared.current.set(sharedKey, cardTexture(n.category, false, role));
            card.material.map = shared.current.get(sharedKey)!;
          }
          card.material.opacity =
            !isSelected(n) &&
            ((live.current.highlightCalls &&
              !(n.block?.nodes ?? [n.node]).some((m) => m.siteIds.length)) ||
              (live.current.highlightFiles &&
                !(n.block?.nodes ?? [n.node]).some((m) => m.fileSiteIds.length)) ||
              (live.current.focusIds && !live.current.focusIds.has(n.id)))
              ? 0.25
              : 1;
        }
        const used = new Set(
          visible.map(
            (t) =>
              t.id +
              (isSelected(t) ? '/selected' : '') +
              (live.current.valueHighlight?.kills.has(t.id)
                ? 'kill'
                : live.current.valueHighlight?.unknowns.has(t.id)
                  ? 'unknown'
                  : live.current.valueHighlight?.producers.has(t.id)
                    ? 'definition'
                    : live.current.valueHighlight?.targets.has(t.id)
                      ? 'destination'
                      : ''),
          ),
        );
        textures.current.forEach((t, key) => {
          if (textures.current.size > DETAIL_LIMIT && !used.has(key)) {
            t.dispose();
            textures.current.delete(key);
          }
        });
        if (particleChanges) updateParticles();
        blocks.current.forEach((b) =>
          b.routes.forEach((route) => {
            route.animated =
              motionRef.current &&
              (nodes.current.length <= 500 ||
                ids.has(b.node.id) ||
                ids.has(route.link.edge.target));
          }),
        );
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
        controls.removeEventListener('end', reanchor);
        controls.removeEventListener('start', interruptMotion);
        cancelAnimationFrame(wheelFrame);
        clearTimeout(hoverTimer);
        canvas.removeEventListener('wheel', wheel, true);
        canvas.removeEventListener('dblclick', read);
        canvas.removeEventListener('pointermove', hoverAt);
        canvas.removeEventListener('pointerleave', clearHover);
        document.removeEventListener('visibilitychange', visibility);
        canvas.removeEventListener('webglcontextlost', lost);
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('pointermove', drag);
        canvas.removeEventListener('click', pick);
        clearCards();
        shared.current.forEach((t) => t.dispose());
        shared.current.clear();
        scene.onBeforeRender = previousRender;
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
    routes.current.forEach((route) => {
      route.animated =
        motionRef.current &&
        (nodes.current.length <= 500 ||
          detailIds.current.has(route.link.edge.source) ||
          detailIds.current.has(route.link.edge.target));
    });
  }
  useEffect(() => {
    updateParticles();
    refresh.current();
  }, [motion]);
  useEffect(() => {
    refresh.current();
  }, [autoBlocks]);
  useEffect(() => {
    if (!instanceReady) return;
    let cancelled = false;
    let worker: Worker | undefined;
    let frame = 0;
    if (cachedModel.current !== props.model) {
      layouts.current.clear();
      installedLayout.current = undefined;
      cachedModel.current = props.model;
      initialized.current = false;
      restored.current = 0;
    }
    const layoutKey = JSON.stringify([
      props.visibleNodes.map((n) => n.id),
      props.visibleEdges.map((e) => e.id),
    ]);
    if (installedLayout.current === layoutKey && !layoutPending.current) return;
    layoutPending.current = true;
    setBusy(true);
    setError('');
    const install = (layout: PlanarLayout) => {
      if (cancelled) return;
      layouts.current.delete(layoutKey);
      layouts.current.set(layoutKey, layout);
      if (layouts.current.size > 16) layouts.current.delete(layouts.current.keys().next().value!);
      const positions = new Map(layout.nodes.map((p) => [p.id, p]));
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
      const paths = new Map(layout.routes.map((route) => [route.id, route.points]));
      const links: SceneLink[] = props.visibleEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        edge,
        points: paths.get(edge.id)!,
      }));

      graph.current!.graphData({ nodes: nodes.current, links });
      const sceneById = new Map(nodes.current.map((n) => [n.id, n]));
      const outgoing = new Map<string, SceneLink[]>();
      for (const link of links) {
        const list = outgoing.get(link.edge.source) ?? [];
        list.push(link);
        outgoing.set(link.edge.source, list);
      }
      if (!shared.current.has('BLOCO')) shared.current.set('BLOCO', cardTexture('BLOCO'));
      blocks.current = linearBlocks(props.visibleNodes, props.visibleEdges, props.model.edges).map(
        (block) => {
          const first = sceneById.get(block.nodes[0].id)!;
          const node: SceneNode = {
            ...first,
            id: block.id,
            category: block.nodes.at(-1)!.kind === 'BRANCH' ? 'DECISÃO' : 'BLOCO',
            block,
          };
          const card = new Sprite(
            new SpriteMaterial({
              map: shared.current.get('BLOCO'),
              depthTest: false,
              depthWrite: false,
              transparent: true,
              alphaTest: 0.2,
            }),
          );
          card.scale.set(CARD_WIDTH, CARD_HEIGHT, 1);
          card.position.set(node.x, node.y, node.z);
          card.renderOrder = 1;
          card.userData.sceneNode = node;
          card.visible = false;
          graph.current!.scene().add(card);
          const tails = outgoing.get(block.nodes.at(-1)!.id) ?? [];
          const summaryRoutes = tails.map((tail) => {
            const route = new RoutedLink({
              ...tail,
              points: blockRoute([...block.edges.map((e) => paths.get(e.id)!), tail.points]),
            });
            route.style(
              live.current.witnessIds,
              live.current.valueHighlight?.edges,
              live.current.valueHighlight?.killedEdges,
            );
            route.visible = false;
            graph.current!.scene().add(route);
            return route;
          });
          return { block, node, card, routes: summaryRoutes, expanded: true };
        },
      );
      for (const n of [...nodes.current, ...blocks.current.map((b) => b.node)])
        basePositions.current.set(n.id, { x: n.x, y: n.y, z: n.z });
      for (const route of [...routes.current.values(), ...blocks.current.flatMap((b) => b.routes)])
        baseRoutes.current.set(route, route.link.points);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (cancelled) return;
          const restore = live.current.restoreView;
          if (restore && restore.id !== restored.current) {
            restored.current = restore.id;
            restoredBlocks.current = new Set(restore.viewport.collapsed ?? []);
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
          installedLayout.current = layoutKey;
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
    else if (!props.visibleNodes.length) install({ nodes: [], routes: [] });
    else {
      const fail = (message: string) => {
        if (cancelled) return;
        layoutPending.current = false;
        setError(
          `Falha ao distribuir as caixas no plano: ${message}. Recarregue a página para tentar novamente.`,
        );
        setBusy(false);
        worker?.terminate();
      };
      const elk = new ELK({
        workerFactory: () => {
          worker = new Worker(elkWorkerUrl);
          worker.addEventListener('error', () => fail('worker indisponível'));
          return worker;
        },
      });
      planarLayout(
        {
          nodes: props.visibleNodes.map((n) => n.id),
          links: props.visibleEdges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
        },
        elk,
      )
        .then(install)
        .catch((e) => fail(e.message))
        .finally(() => elk.terminateWorker());
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
      restoredBlocks.current = new Set(props.restoreView.viewport.collapsed ?? []);
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
    for (const route of [...routes.current.values(), ...blocks.current.flatMap((b) => b.routes)])
      route.style(props.witnessIds, props.valueHighlight?.edges, props.valueHighlight?.killedEdges);
  }, [
    props.highlightCalls,
    props.highlightFiles,
    props.focusIds,
    props.witnessIds,
    props.valueHighlight,
  ]);

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
      data-value-edges={props.valueHighlight?.edges.size ?? 0}
      data-value-producers={props.valueHighlight?.producers.size ?? 0}
      data-value-kills={props.valueHighlight?.kills.size ?? 0}
      data-value-unknowns={props.valueHighlight?.unknowns.size ?? 0}
      data-value-killed-edges={props.valueHighlight?.killedEdges.size ?? 0}
      data-value-highlight={props.valueHighlight ? 'on' : 'off'}
      data-layout="planar"
      data-linear-blocks={blockCount.total}
      data-auto-blocks={autoBlocks ? 'on' : 'off'}
      data-motion={motion ? 'on' : 'off'}
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
      <div
        ref={host}
        className="graph3d-canvas"
        style={{ visibility: busy || error ? 'hidden' : undefined }}
      />
      <div
        className="graph3d-targets"
        aria-label="Caixas visíveis no espaço 3D"
        hidden={busy || !!error}
      >
        {targets.map((t) => (
          <button
            key={t.id}
            className={`${t.block ? 'graph-block-target' : 'graph-node-target'} ${isSelected(t) ? 'is-selected' : ''}`}
            aria-label={t.label}
            aria-pressed={isSelected(t)}
            data-node-id={t.block ? undefined : t.id}
            data-block-id={t.block?.id}
            data-member-ids={t.block ? JSON.stringify(t.block.nodes.map((n) => n.id)) : undefined}
            data-internal-edge-ids={
              t.block ? JSON.stringify(t.block.edges.map((e) => e.id)) : undefined
            }
            data-position={JSON.stringify(t.position)}
            data-original-position={JSON.stringify(basePositions.current.get(t.id))}
            style={{ left: t.x, top: t.y, width: t.width, height: t.height }}
            onClick={() => {
              if (t.block) {
                focus(t.block.nodes[0].id, true, true);
                return;
              }
              props.onSelect(t.id);
              appliedSelection.current = t.id;
            }}
          >
            <span className="sr-only">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="graph3d-controls" role="group" aria-label="Navegação do grafo 3D">
        <span title="Navegação 3D">
          <Box size={15} />
          <b>3D</b>
        </span>
        <button
          className="block-toggle"
          aria-label="Agrupar trechos lineares pelo zoom"
          aria-pressed={autoBlocks}
          title={
            autoBlocks
              ? 'Compactar sequências até as decisões. Aproximar revela os trechos; desativar mostra todos.'
              : 'Ativar blocos por zoom'
          }
          onClick={() => setAutoBlocks((value) => !value)}
        >
          <Layers3 size={16} /> Blocos
        </button>
        <button aria-label="Aumentar zoom" title="Aproximar (+)" onClick={() => zoom(0.8)}>
          <Plus size={16} />
        </button>
        <button aria-label="Diminuir zoom" title="Afastar (-)" onClick={() => zoom(1.25)}>
          <Minus size={16} />
        </button>
        <button
          aria-label="Enquadrar recorte"
          title="Enquadrar recorte (Home)"
          onClick={() => fit()}
        >
          <Scan size={16} />
        </button>
        {props.valueHighlight && (
          <button
            className="value-fit"
            aria-label="Enquadrar valores destacados"
            title="Enquadrar definições e destino"
            onClick={() => fit(true)}
          >
            <Scan size={16} /> Valores
          </button>
        )}
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
          caixas no plano…
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
        title="Arraste: esquerdo desloca · direito gira · roda aproxima no cursor; duplo clique para ler. Partículas indicam a direção do CFG."
      >
        <span>
          {hover ||
            (blockCount.collapsed
              ? 'Sequências compactadas · aproxime ou clique para abrir'
              : 'Esquerdo desloca · direito gira · roda aproxima no cursor · duplo clique para ler')}
        </span>
        <span>
          {blockCount.collapsed > 0
            ? `${blockCount.collapsed} ${blockCount.collapsed === 1 ? 'bloco' : 'blocos'} · ${props.visibleNodes.length - blockCount.hidden} trechos`
            : `${props.visibleNodes.length} trechos`}{' '}
          · {props.visibleEdges.length} transições
        </span>
      </div>
    </div>
  );
}
