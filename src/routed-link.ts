import {
  BufferGeometry,
  ConeGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Vector3,
} from 'three';
import { edgeColor, type SceneLink, type Point3D } from './graph3d';

export function routeLength(points: Point3D[]) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(
      lengths[i - 1] +
        Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].y - points[i - 1].y,
          points[i].z - points[i - 1].z,
        ),
    );
  return lengths;
}
export function pointOnRoute(
  points: Point3D[],
  lengths: number[],
  fraction: number,
  result = new Vector3(),
) {
  const distance = Math.max(0, Math.min(1, fraction)) * lengths.at(-1)!;
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < distance) i++;
  const size = lengths[i] - lengths[i - 1];
  const t = size ? (distance - lengths[i - 1]) / size : 0;
  const a = points[i - 1],
    b = points[i];
  return result.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
}

// Lines, arrows and particles all use the same ELK route in source → target order.
export class RoutedLink extends Group {
  private lengths: number[];
  private line: Line<BufferGeometry, LineBasicMaterial>;
  private arrow: Mesh<ConeGeometry, MeshBasicMaterial>;
  private particles: Points<BufferGeometry, PointsMaterial>;
  private scratch = new Vector3();
  animated = false;
  constructor(public link: SceneLink) {
    super();
    this.userData.targetId = link.edge.target;
    this.lengths = routeLength(link.points);
    this.line = new Line(
      new BufferGeometry().setFromPoints(link.points.map((p) => new Vector3(p.x, p.y, p.z))),
      new LineBasicMaterial({ transparent: true }),
    );
    this.arrow = new Mesh(new ConeGeometry(4, 12, 3), new MeshBasicMaterial());
    const total = this.lengths.at(-1)!;
    const end = pointOnRoute(link.points, this.lengths, 1);
    const near = pointOnRoute(link.points, this.lengths, Math.max(0, 1 - 6 / total));
    this.arrow.position.copy(near);
    this.arrow.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), end.sub(near).normalize());
    this.particles = new Points(
      new BufferGeometry().setAttribute(
        'position',
        new Float32BufferAttribute(new Float32Array(6), 3),
      ),
      new PointsMaterial({ size: 4, sizeAttenuation: true }),
    );
    // Selection belongs to the complete route; no extra graph nodes or edges for its bends.
    this.add(this.line, this.arrow, this.particles);
    this.style();
  }
  style(witness?: Set<string>) {
    const color = edgeColor(this.link.edge, witness);
    this.line.material.color.set(color);
    this.line.material.opacity = witness?.has(this.link.id) ? 1 : 0.7;
    this.arrow.material.color.set(color);
    this.arrow.scale.setScalar(witness?.has(this.link.id) ? 1.4 : 1);
    this.particles.material.color.set(color);
  }
  tick(time: number) {
    this.particles.visible = this.animated;
    if (!this.animated) return;
    const positions = this.particles.geometry.getAttribute('position');
    for (let i = 0; i < 2; i++) {
      const p = pointOnRoute(
        this.link.points,
        this.lengths,
        (time / 4200 + i / 2) % 1,
        this.scratch,
      );
      positions.setXYZ(i, p.x, p.y, p.z);
    }
    positions.needsUpdate = true;
    this.particles.geometry.computeBoundingSphere();
  }
  dispose() {
    this.line.geometry.dispose();
    this.line.material.dispose();
    this.arrow.geometry.dispose();
    this.arrow.material.dispose();
    this.particles.geometry.dispose();
    this.particles.material.dispose();
  }
}
