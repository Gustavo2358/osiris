import { PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three';

export const MIN_ZOOM_DISTANCE = 150;
export const MAX_ZOOM_DISTANCE = 1_000_000;

/** Intersect the view with the fixed diagram plane, from either side.
 * At grazing angles use the current focal plane instead of an unstable far-away intersection.
 */
export function diagramIntersection(origin: Vector3, direction: Vector3) {
  if (Math.abs(direction.z) < 0.08) return undefined;
  const distance = -origin.z / direction.z;
  if (distance <= 0 || distance > MAX_ZOOM_DISTANCE) return undefined;
  return origin.clone().addScaledVector(direction, distance).setZ(0);
}

export function wheelZoomFactor(delta: number) {
  // 120px mouse-wheel notch: about 27% enlargement, rather than the previous 6%.
  // Small trackpad deltas remain small; coalesced bursts cannot jump through the graph.
  return Math.exp(Math.max(-Math.log(4), Math.min(Math.log(4), delta * 0.002)));
}

export function zoomView(
  camera: PerspectiveCamera,
  target: Vector3,
  factor: number,
  pointer = new Vector2(),
) {
  camera.updateMatrixWorld();
  const direction = camera.getWorldDirection(new Vector3());
  const center = diagramIntersection(camera.position, direction);
  const focal = center ?? target;
  const distance = Math.max(1, camera.position.distanceTo(focal));
  const ratio =
    Math.max(MIN_ZOOM_DISTANCE, Math.min(MAX_ZOOM_DISTANCE, distance * factor)) / distance;
  const ray = new Raycaster();
  ray.setFromCamera(pointer, camera);
  // For an edge-on view, use a screen-parallel focal plane through the existing pivot.
  const anchor =
    (center && diagramIntersection(ray.ray.origin, ray.ray.direction)) ??
    camera.position
      .clone()
      .addScaledVector(
        ray.ray.direction,
        distance / Math.max(0.08, ray.ray.direction.dot(direction)),
      );
  const position = camera.position.clone().sub(anchor).multiplyScalar(ratio).add(anchor);
  const nextTarget =
    (center && diagramIntersection(position, direction)) ??
    position.clone().addScaledVector(direction, distance * ratio);
  return { position, target: nextTarget };
}
