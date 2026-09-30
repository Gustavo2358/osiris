import type { Point3D } from './graph3d';
import { CARD_WIDTH, CARD_HEIGHT } from './graph-dimensions';

// Monotone axis compression preserves route order and orthogonal segments.
// Bands occupied by visible cards keep their full size; empty bands shrink.
export function compactAxis(centers: number[], size: number, gap = 64) {
  const bands: { low: number; high: number; shift: number }[] = [];
  for (const center of [...centers].sort((a, b) => a - b)) {
    const low = center - size / 2,
      high = center + size / 2;
    const last = bands.at(-1);
    if (last && low <= last.high) last.high = Math.max(last.high, high);
    else bands.push({ low, high, shift: 0 });
  }
  for (let i = 1; i < bands.length; i++)
    bands[i].shift = bands[i - 1].shift + Math.max(0, bands[i].low - bands[i - 1].high - gap);
  return (value: number) => {
    if (!bands.length) return value;
    let low = 0,
      high = bands.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (bands[mid].high < value) low = mid + 1;
      else high = mid;
    }
    const next = bands[low],
      prev = bands[low - 1];
    if (!next) return value - bands.at(-1)!.shift;
    if (!prev || value >= next.low) return value - next.shift;
    const fraction = (value - prev.high) / (next.low - prev.high);
    return prev.high - prev.shift + fraction * Math.min(gap, next.low - prev.high);
  };
}

export function compactProjection(visible: Point3D[]): (point: Point3D) => Point3D {
  const x = compactAxis(
    visible.map((p) => p.x),
    CARD_WIDTH,
  );
  const y = compactAxis(
    visible.map((p) => p.y),
    CARD_HEIGHT,
  );
  return (p) => ({ x: x(p.x), y: y(p.y), z: p.z });
}
