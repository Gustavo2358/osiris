import { expect, it } from 'vitest';
import { compactAxis, compactProjection } from '../src/compact-layout';
import { CARD_WIDTH, CARD_HEIGHT } from '../src/graph-dimensions';

it('removes empty bands while keeping card size, order and route bends', () => {
  const centers = [-600, -590, 0, 1000];
  const map = compactAxis(centers, 100, 64);
  for (const center of centers) expect(map(center + 50) - map(center - 50)).toBe(100);
  expect(map(1000) - map(-600)).toBeLessThan(500);
  const values = Array.from({ length: 2000 }, (_, i) => i - 750);
  expect(values.every((v, i) => !i || map(v) > map(values[i - 1]))).toBe(true);
  expect(compactAxis([], 100)(42)).toBe(42);
});
it('preserves orthogonality, exact card endpoints and gaps when hiding many rows', () => {
  const cards = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: -1000, z: 0 },
    { x: 900, y: -1000, z: 0 },
  ];
  const transform = compactProjection(cards);
  const points = [
    { x: 0, y: -CARD_HEIGHT / 2, z: 0 },
    { x: 0, y: -500, z: 0 },
    { x: 900, y: -500, z: 0 },
    { x: 900, y: -1000 + CARD_HEIGHT / 2, z: 0 },
  ].map(transform);
  expect(points[0].y).toBe(transform(cards[0]).y - CARD_HEIGHT / 2);
  expect(points.at(-1)!.y).toBe(transform(cards[2]).y + CARD_HEIGHT / 2);
  expect(points.every((p, i) => !i || p.x === points[i - 1].x || p.y === points[i - 1].y)).toBe(
    true,
  );
  expect(transform(cards[2]).x - transform(cards[1]).x).toBe(CARD_WIDTH + 64);
  expect(transform(cards[0]).y - transform(cards[1]).y).toBe(CARD_HEIGHT + 64);
});
