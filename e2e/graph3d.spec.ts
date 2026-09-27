import { test, expect, type Page } from '@playwright/test';
import { visibleBoxPixels, expectCamera } from './graph-helpers';

async function open(page: Page, example = 'files-values') {
  await page.goto('/?example=' + example);
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.graph-node-target.is-selected')).toBeVisible();
}
const camera = (page: Page) => page.getByTestId('graph').getAttribute('data-camera');
const canvas = (page: Page) => page.locator('.graph3d-canvas canvas');

for (const example of ['files-values', 'order-router']) {
  test(`WebGL draws bright boxes with COBOL content on a dark scene: ${example}`, async ({
    page,
  }) => {
    await open(page, example);
    const pixels = await visibleBoxPixels(page);
    expect(pixels.light).toBeGreaterThan(15000);
    expect(pixels.dark / pixels.total).toBeGreaterThan(0.4);
    const selected = page.locator('.graph-node-target.is-selected');
    const title = await page
      .getByRole('complementary', { name: 'Inspetor' })
      .getByRole('heading', { level: 2 })
      .innerText();
    await expect(selected).toHaveAttribute('aria-label', title);
    // Readable initial card; farther cards keep their geometry and gain text as the camera approaches.
    expect((await selected.boundingBox())!.width).toBeGreaterThan(250);
    expect(
      Number(await page.getByTestId('graph').getAttribute('data-textures')),
    ).toBeLessThanOrEqual(128);
  });
}

test('orbit, pan, zoom, keyboard, framing and Back preserve an explored 3D camera', async ({
  page,
}) => {
  await open(page);
  const area = (await canvas(page).boundingBox())!;
  const initial = (await camera(page))!;
  await page.mouse.move(area.x + area.width * 0.8, area.y + area.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(area.x + area.width * 0.8 - 100, area.y + area.height * 0.7 - 50, {
    steps: 10,
  });
  await page.mouse.up();
  await expect.poll(() => camera(page)).not.toBe(initial);
  const orbit = (await camera(page))!;
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(area.x + area.width * 0.8 - 60, area.y + area.height * 0.7 - 30, {
    steps: 5,
  });
  await page.mouse.up({ button: 'right' });
  await expect.poll(() => camera(page)).not.toBe(orbit);
  const pan = (await camera(page))!;
  await page.mouse.wheel(0, 150);
  await expect.poll(() => camera(page)).not.toBe(pan);
  await canvas(page).press('ArrowRight');
  const view = (await camera(page))!;
  await page.getByRole('button', { name: 'Caminhos até aqui' }).click();
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expectCamera(page, view);
  await canvas(page).press('Home');
  await expect.poll(() => camera(page)).not.toBe(view);
  await page.getByRole('button', { name: 'Centralizar seleção' }).click();
  await expect(page.locator('.graph-node-target.is-selected')).toBeInViewport();
});

test('raycast on a real WebGL box selects its COBOL statement and follows source', async ({
  page,
}) => {
  await open(page, 'order-router');
  await page.getByRole('button', { name: 'Código fonte', exact: true }).click();
  // Initially centered card is the nearest visible selected node; use its actual projection.
  const selected = page.locator('.graph-node-target.is-selected');
  const before = await selected.getAttribute('data-node-id');
  const box = (await selected.boundingBox())!;
  const source = page.getByRole('region', { name: 'Código fonte original' });
  await source.locator('.source-document').focus();
  await page.keyboard.press('Control+End');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(source.locator('.selected-line').first()).toContainText('CALL WS-SERVICE');
  await expect(source.locator('.selected-line').first()).toBeInViewport();
  await expect(selected).toHaveAttribute('data-node-id', before!);
  // Keyboard selection of another projected card must update the same inspector.
  const next = page.locator('.graph-node-target:not(.is-selected)').first();
  const label = await next.getAttribute('aria-label');
  await next.press('Enter');
  await expect(
    page.getByRole('complementary', { name: 'Inspetor' }).getByRole('heading', { level: 2 }),
  ).toHaveText(label!);
});

test('particles animate transitions and can be paused without locking the camera', async ({
  page,
}) => {
  await open(page, 'cics');
  await page.getByRole('button', { name: 'Enquadrar recorte' }).click();
  const moving = await canvas(page).screenshot();
  await expect.poll(async () => (await canvas(page).screenshot()).equals(moving)).toBe(false);
  await page.getByRole('button', { name: 'Pausar partículas' }).click();
  await expect(page.getByTestId('graph')).toHaveAttribute('data-motion', 'off');
  let paused = await canvas(page).screenshot();
  await expect
    .poll(async () => {
      const next = await canvas(page).screenshot();
      const equal = next.equals(paused);
      paused = next;
      return equal;
    })
    .toBe(true);
  expect((await canvas(page).screenshot()).equals(paused)).toBe(true);
  const view = (await camera(page))!;
  await canvas(page).press('ArrowLeft');
  await expect.poll(() => camera(page)).not.toBe(view);
  await canvas(page).press(' ');
  await expect(page.getByTestId('graph')).toHaveAttribute('data-motion', 'on');
});

test('reduced motion starts paused and repeated program switches release scenes', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await expect(page.getByTestId('graph')).toHaveAttribute('data-motion', 'off');
  for (const example of ['cycle', 'cics', 'copy', 'files-values']) {
    await page.getByRole('combobox', { name: 'Escolher exemplo' }).selectOption(example);
    await expect(page.getByRole('combobox', { name: 'Escolher exemplo' })).toHaveValue(example);
    await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
    await expect(canvas(page)).toHaveCount(1);
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('reading action approaches the selected box from an overview', async ({ page }) => {
  await open(page, 'large');
  await page.getByRole('button', { name: 'Enquadrar recorte' }).click();
  const distant = Number(await page.getByTestId('graph').getAttribute('data-distance'));
  await page.getByRole('button', { name: 'Ler seleção de perto' }).click();
  await expect
    .poll(async () => Number(await page.getByTestId('graph').getAttribute('data-distance')))
    .toBeLessThan(distant / 2);
  await expect
    .poll(
      async () => (await page.locator('.graph-node-target.is-selected').boundingBox())?.width ?? 0,
    )
    .toBeCloseTo(300, 0);
});

test('layout worker failure ends loading and exposes an actionable error', async ({ page }) => {
  await page.route('**/elk-worker.min-*.js', (route) => route.abort());
  await page.goto('/?example=files-values');
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('alert')).toContainText('Falha ao distribuir');
});

for (const scope of ['all', 'paths']) {
  test(`selecting a box keeps camera, pivot and diagram positions unchanged in ${scope}`, async ({
    page,
  }) => {
    await open(page, 'cics');
    if (scope === 'paths') {
      await page.getByRole('button', { name: 'Caminhos até aqui' }).click();
      await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
    }
    await page.getByRole('button', { name: 'Enquadrar recorte' }).click();
    await page.getByRole('button', { name: 'Pausar partículas' }).click();
    const before = (await camera(page))!;
    const target = page.locator('.graph-node-target:not(.is-selected)').first();
    const id = await target.getAttribute('data-node-id');
    const position = await target.getAttribute('data-position');
    expect(JSON.parse(position!).z).toBe(0);
    const box = (await target.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('.graph-node-target.is-selected')).toHaveAttribute(
      'data-node-id',
      id!,
    );
    // The old click initiated a 550 ms flight. Check the full interval, not only its first frame.
    await page.waitForTimeout(650);
    await expectCamera(page, before);
    await expect(page.locator('.graph-node-target.is-selected')).toHaveAttribute(
      'data-position',
      position!,
    );
    await canvas(page).press('ArrowRight');
    const tilted = JSON.parse((await camera(page))!);
    expect(tilted.target).toEqual(JSON.parse(before).target);
    await expect(page.locator('.graph-node-target.is-selected')).toHaveAttribute(
      'data-position',
      position!,
    );
    await page.getByRole('button', { name: 'Vista frontal' }).click();
    await page.screenshot({ path: `test-results/planar-${scope}.png`, fullPage: true });
  });
}

for (const example of ['cics', 'order-router']) {
  test(`billboards stay readable and selectable through both sides of the layout plane: ${example}`, async ({
    page,
  }) => {
    await open(page, example);
    await page.getByRole('button', { name: 'Código fonte', exact: true }).click();
    await page.getByRole('button', { name: 'Vista frontal', exact: true }).click();
    const selected = page.locator('.graph-node-target.is-selected');
    const id = await selected.getAttribute('data-node-id');
    const position = await selected.getAttribute('data-position');
    const frontal = (await selected.boundingBox())!;
    const pivot = JSON.parse((await camera(page))!).target;
    // 83 degrees almost edge-on, then 172 degrees through the other side of the plane.
    for (const steps of [12, 13]) {
      for (let i = 0; i < steps; i++) await canvas(page).press('ArrowRight');
      const view = (await camera(page))!;
      const box = (await selected.boundingBox())!;
      expect(box.width).toBeCloseTo(frontal.width, 0);
      expect(box.height).toBeCloseTo(frontal.height, 0);
      await expect(selected).toHaveAttribute('data-position', position!);
      const source = page.getByRole('region', { name: 'Código fonte original' });
      await source.locator('.source-document').focus();
      await page.keyboard.press('Control+End');
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(selected).toHaveAttribute('data-node-id', id!);
      await expect(source.locator('.selected-line').first()).toBeInViewport();
      await expectCamera(page, view);
      // Actual WebGL geometry stays visible, beyond the DOM accessibility target.
      expect((await visibleBoxPixels(page)).light).toBeGreaterThan(15000);
    }
    const back = JSON.parse((await camera(page))!);
    expect(back.position.z).toBeLessThan(pivot.z);
    expect(back.target).toEqual(pivot);
    await page.screenshot({ path: `test-results/billboard-${example}-back.png`, fullPage: true });
    await page.getByRole('button', { name: 'Caminhos até aqui', exact: true }).click();
    await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await expectCamera(page, JSON.stringify(back));
    await page.getByRole('button', { name: 'Vista frontal', exact: true }).click();
    expect(JSON.parse((await camera(page))!).position.z).toBeGreaterThan(pivot.z);
  });
}
