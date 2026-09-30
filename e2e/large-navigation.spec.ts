import { test, expect, type Page } from '@playwright/test';
import { expectCamera } from './graph-helpers';
const graph = (p: Page) => p.getByTestId('graph');
const camera = async (p: Page) => JSON.parse((await graph(p).getAttribute('data-camera'))!);
const canvas = (p: Page) => p.locator('.graph3d-canvas canvas');
async function open(p: Page) {
  await p.goto('/?example=large');
  await expect(graph(p)).toHaveAttribute('aria-busy', 'false');
  await expect(graph(p)).toHaveAttribute('data-nodes', '503');
}
async function pan(p: Page, fraction: number) {
  const r = (await canvas(p).boundingBox())!;
  await p.mouse.move(r.x + r.width * 0.8, r.y + r.height * 0.8);
  await p.mouse.down({ button: 'left' });
  await p.mouse.move(r.x + r.width * 0.8, r.y + r.height * (0.8 - fraction), { steps: 10 });
  await p.mouse.up({ button: 'left' });
}

test('long pan keeps zoom referenced to the diagram plane, including near the bottom', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Enquadrar recorte', exact: true }).click();
  await canvas(page).press('ArrowUp');
  await canvas(page).press('ArrowUp');
  const before = await camera(page);
  await pan(page, 0.42);
  const after = await camera(page);
  expect(Math.abs(after.target.y - before.target.y)).toBeGreaterThan(10000);
  expect(Math.abs(after.target.z)).toBeLessThan(0.001);
  const distance = Math.abs(after.position.z);
  const r = (await canvas(page).boundingBox())!;
  await page.mouse.move(r.x + r.width * 0.5, r.y + r.height * 0.5);
  await page.mouse.wheel(0, -600);
  await expect
    .poll(async () => Math.abs((await camera(page)).position.z) / distance)
    .toBeLessThan(0.4);
});

test('wheel zoom stays on an off-center card at the last service instead of pulling toward the old pivot', async ({
  page,
}) => {
  await open(page);
  const nav = page.getByRole('complementary', { name: 'Navegação do programa' });
  await nav.getByRole('button', { name: /→ SRV099/ }).click();
  await page.getByRole('button', { name: 'Ler seleção de perto', exact: true }).click();
  const box = page.locator('.graph-node-target.is-selected');
  await expect.poll(async () => (await box.boundingBox())?.width ?? 0).toBeGreaterThan(250);
  await pan(page, 0.12);
  const b = (await box.boundingBox())!,
    x = b.x + b.width * 0.65,
    y = b.y + b.height * 0.5;
  const r = (await canvas(page).boundingBox())!;
  expect(y).toBeGreaterThan(r.y + 70);
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -120);
  await expect.poll(async () => (await box.boundingBox())!.width / b.width).toBeGreaterThan(1.2);
  const a = (await box.boundingBox())!;
  expect(Math.abs(a.x + a.width * 0.65 - x)).toBeLessThan(5);
  expect(Math.abs(a.y + a.height * 0.5 - y)).toBeLessThan(5);
  expect(Math.abs((await camera(page)).target.z)).toBeLessThan(0.001);
  const view = (await graph(page).getAttribute('data-camera'))!;
  await page.getByRole('button', { name: 'Caminhos até aqui', exact: true }).click();
  await expect(graph(page)).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(graph(page)).toHaveAttribute('aria-busy', 'false');
  await expectCamera(page, view);
});

test('double click reads a distant card without pinning it or changing the graph', async ({
  page,
}) => {
  await open(page);
  const selected = page.locator('.graph-node-target.is-selected');
  const id = await selected.getAttribute('data-node-id'),
    position = await selected.getAttribute('data-original-position');
  await page.getByRole('button', { name: 'Diminuir zoom', exact: true }).click();
  await page.getByRole('button', { name: 'Diminuir zoom', exact: true }).click();
  await expect.poll(async () => (await selected.boundingBox())?.width ?? 999).toBeLessThan(220);
  const b = (await selected.boundingBox())!;
  await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
  await expect.poll(async () => (await selected.boundingBox())!.width).toBeGreaterThan(250);
  await expect(selected).toHaveAttribute('data-node-id', id!);
  // Semantic zoom can compact empty bands; the underlying layout and identity stay fixed.
  await expect(selected).toHaveAttribute('data-original-position', position!);
  await expect(graph(page)).toHaveAttribute('data-nodes', '503');
  expect(Number(await graph(page).getAttribute('data-textures'))).toBeLessThanOrEqual(128);
});
