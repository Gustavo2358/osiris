import { forceSimulation, forceLink, forceManyBody, forceCollide, forceCenter } from 'd3-force-3d';

// Presentation only. The worker receives copies; it never changes analyzer products.
self.onmessage = ({ data }) => {
  try {
    const nodes = data.nodes.map((id) => ({ id }));
    const links = data.links.map((link) => ({ ...link }));
    const simulation = forceSimulation(nodes, 3)
      .force(
        'link',
        forceLink(links)
          .id((n) => n.id)
          .distance(260)
          .strength(0.22),
      )
      .force('charge', forceManyBody().strength(-1500).distanceMax(1800).theta(1.1))
      .force('collision', forceCollide(115).strength(0.8))
      .force('center', forceCenter())
      .stop();
    for (let i = 0; i < 180; i++) simulation.tick();
    self.postMessage({ nodes: nodes.map(({ id, x, y, z }) => ({ id, x, y, z })) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
