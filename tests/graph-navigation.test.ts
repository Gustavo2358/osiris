import { describe, it, expect } from 'vitest';
import { PerspectiveCamera, Vector2, Vector3 } from 'three';
import { diagramIntersection, zoomView, wheelZoomFactor } from '../src/graph-navigation';
function camera(position: Vector3, target: Vector3) {
  const c = new PerspectiveCamera(50, 1.5, 1, 4e6);
  c.position.copy(position);
  c.lookAt(target);
  c.updateMatrixWorld();
  return c;
}
describe('Zoom anchored to the diagram rather than a stale orbit pivot', () => {
  it.each([0, -30000, 30000])('has the same zoom scale at tree position %s', (y) => {
    const target = new Vector3(100, y, 0),
      c = camera(target.clone().add(new Vector3(150, 100, 600)), target);
    const v = zoomView(c, target, wheelZoomFactor(-120));
    expect(v.position.z / c.position.z).toBeCloseTo(Math.exp(-0.24));
    expect(v.target.z).toBe(0);
  });
  it.each([1, -1])('keeps the pointer anchor stationary on side %s', (side) => {
    const target = new Vector3(100, -28000, 0),
      c = camera(target.clone().add(new Vector3(100, 200, side * 800)), target);
    const anchor = new Vector3(200, -27900, 0),
      screen = anchor.clone().project(c);
    const v = zoomView(c, target, 0.6, new Vector2(screen.x, screen.y));
    c.position.copy(v.position);
    c.lookAt(v.target);
    c.updateMatrixWorld();
    const next = anchor.clone().project(c);
    expect(next.x).toBeCloseTo(screen.x, 10);
    expect(next.y).toBeCloseTo(screen.y, 10);
    expect(Math.sign(c.position.z)).toBe(side);
    expect(v.target.z).toBe(0);
  });
  it('recovers from a pivot thousands of units behind the graph after panning', () => {
    const c = camera(new Vector3(300, -25000, 9000), new Vector3(300, -29000, -8000));
    const stale = new Vector3(300, -29000, -8000),
      v = zoomView(c, stale, 0.5);
    expect(v.target.z).toBe(0);
    expect(v.position.z).toBeCloseTo(4500);
  });
  it('keeps edge-on views finite and preserves the viewing direction', () => {
    const t = new Vector3(0, -30000, 0),
      c = camera(new Vector3(1000, -30000, 0), t),
      direction = c.getWorldDirection(new Vector3());
    expect(diagramIntersection(c.position, direction)).toBeUndefined();
    const v = zoomView(c, t, 0.8, new Vector2(0.3, 0.2));
    expect(v.position.toArray().every(Number.isFinite)).toBe(true);
    expect(v.target.clone().sub(v.position).normalize().distanceTo(direction)).toBeLessThan(1e-10);
  });
  it('clamps zoom before crossing the plane and limits trackpad bursts', () => {
    const t = new Vector3(0, 0, 0),
      c = camera(new Vector3(0, 0, 160), t);
    const v = zoomView(c, t, 0.01);
    expect(v.position.z).toBe(150);
    expect(wheelZoomFactor(-10000)).toBe(0.25);
    expect(wheelZoomFactor(10000)).toBe(4);
    expect(wheelZoomFactor(-2)).toBeGreaterThan(0.99);
    expect(wheelZoomFactor(-120) ** 2).toBeCloseTo(wheelZoomFactor(-240));
  });
});
