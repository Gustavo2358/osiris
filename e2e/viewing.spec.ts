import { test, expect, type Page } from '@playwright/test';

async function open(page: Page, example = 'files-values') {
  await page.goto('/?example=' + example);
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
}
const pane = (page: Page) => page.getByRole('region', { name: 'Código fonte original' });
const nav = (page: Page) => page.getByRole('complementary', { name: 'Navegação do programa' });
const separator = (page: Page) =>
  page.getByRole('separator', { name: 'Ajustar tamanho do grafo e do código' });
const zoom = (page: Page) =>
  page
    .locator('.react-flow__viewport')
    .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);

async function dragDivider(page: Page, delta: number) {
  const box = (await separator(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + delta, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
}

for (const example of ['files-values', 'order-router']) {
  test(`dark canvas and minimap keep nodes visible inside and outside the viewport: ${example}`, async ({
    page,
  }) => {
    await open(page, example);
    const contrast = await page.getByTestId('graph').evaluate((root) => {
      const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const lum = (s: string) =>
        rgb(s)
          .map((v) => {
            v /= 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          })
          .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
      const ratio = (a: string, b: string) =>
        (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
      const bg = getComputedStyle(root).backgroundColor;
      const minimap = root.querySelector('.react-flow__minimap')!;
      const minimapBg = getComputedStyle(minimap).backgroundColor;
      const mask = getComputedStyle(minimap.querySelector('.react-flow__minimap-mask')!);
      // Check the rendered result of the mask, not just each node's unmasked fill.
      const maskChannels = (mask.fill.match(/[\d.]+/g) ?? []).map(Number);
      const masked = (color: string) => {
        const alpha = maskChannels[3] ?? 1;
        return `rgb(${rgb(color)
          .map((v, i) => v * (1 - alpha) + maskChannels[i] * alpha)
          .join(',')})`;
      };
      const nodes = [...minimap.querySelectorAll('.react-flow__minimap-node')];
      return {
        minimapNodes: nodes.map((el) => ({
          inside: ratio(getComputedStyle(el).fill, minimapBg),
          outside: ratio(masked(getComputedStyle(el).fill), masked(minimapBg)),
        })),
        minimapViewport: ratio(mask.stroke, minimapBg),
        luminance: lum(bg),
        cards: [...root.querySelectorAll('.graph-card')].map((el) =>
          ratio(getComputedStyle(el).backgroundColor, bg),
        ),
        edges: [...root.querySelectorAll('.react-flow__edge-path')].map((el) =>
          ratio(getComputedStyle(el).stroke, bg),
        ),
        labels: [...root.querySelectorAll('.edge-label')].map((el) =>
          ratio(getComputedStyle(el).color, bg),
        ),
      };
    });
    expect(contrast.minimapNodes.length).toBeGreaterThan(0);
    expect(contrast.minimapNodes.every((v) => v.inside >= 3 && v.outside >= 3)).toBe(true);
    expect(contrast.minimapViewport).toBeGreaterThanOrEqual(3);
    expect(contrast.luminance).toBeLessThan(0.04);
    expect(contrast.cards.length).toBeGreaterThan(0);
    expect(contrast.edges.length).toBeGreaterThan(0);
    expect(contrast.cards.every((v) => v >= 7)).toBe(true);
    expect(contrast.edges.every((v) => v >= 3)).toBe(true);
    expect(contrast.labels.every((v) => v >= 4.5)).toBe(true);
  });
}

test('sidebar references recenter source on repeat, and paragraphs use their own provenance', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await open(page);
  await page.getByRole('button', { name: 'Código fonte', exact: true }).click();
  const first = pane(page).locator('.selected-line').first();
  await expect(first).toContainText('EXEC CICS ENDBR');
  const doc = pane(page).locator('.source-document');
  await doc.focus();
  await page.keyboard.press('Control+Home');
  await expect(first).not.toBeInViewport();
  await nav(page).locator('.nav-item').click(); // Same site must still navigate.
  await expect(first).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Voltar', exact: true })).toBeDisabled();
  // An explicit opt-out remains respected for both graph and sidebar selections.
  await pane(page).getByLabel('Acompanhar seleção').uncheck();
  await doc.focus();
  await page.keyboard.press('Control+Home');
  await nav(page).locator('.nav-item').click();
  await expect(first).not.toBeInViewport();
  await pane(page).getByRole('button', { name: 'Ir para a seleção no código' }).click();
  await expect(first).toBeInViewport();

  await open(page, 'order-router');
  await page.getByRole('button', { name: 'Código fonte', exact: true }).click();
  await nav(page).getByRole('tab', { name: 'Paragraphs' }).click();
  await nav(page)
    .getByRole('button', { name: /VALIDATE-ORDER/ })
    .click();
  await expect(pane(page).locator('.selected-line').first()).toContainText('VALIDATE-ORDER.');
  await expect(pane(page).locator('.selected-line').first()).toBeInViewport();
  await nav(page).getByRole('tab', { name: 'Trechos' }).click();
  await page.getByLabel('Buscar no programa').fill("MOVE 'BRANCH'");
  await nav(page).locator('.nav-item').click();
  await expect(pane(page).locator('.selected-line').first()).toContainText("MOVE 'BRANCH'");
});

test('viewing mode keeps only graph and source, preserves scope and zoom, Escape restores tools', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Caminhos até aqui' }).click();
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
  const context = await page.locator('.graph-context').innerText();
  await page.getByRole('button', { name: 'Diminuir zoom', exact: true }).click();
  const before = await zoom(page);
  await page.getByRole('button', { name: 'Modo de visualização' }).click();
  await expect(nav(page)).not.toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Inspetor' })).not.toBeVisible();
  await expect(page.locator('.workspace-heading')).not.toBeVisible();
  await expect(page.locator('.graph-toolbar')).not.toBeVisible();
  await expect(pane(page)).toBeVisible();
  await expect(page.locator('.viewing-context')).toContainText('Caminhos');
  expect((await page.locator('.app-header').boundingBox())!.height).toBeLessThanOrEqual(50);
  await expect.poll(() => zoom(page)).toBeCloseTo(before, 5);
  await expect(page.locator('.graph-card.is-selected')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(nav(page)).toBeVisible();
  await expect(page.locator('.graph-context')).toHaveText(context);
  await expect(page.locator('.path-banner')).toBeVisible(); // Escape exits the mode before history.
  await expect(pane(page)).toHaveCount(0); // Restore the previously closed pane.
  await expect.poll(() => zoom(page)).toBeCloseTo(before, 5);
});

test('mouse and keyboard resize both panes with bounds, reset and retained size', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page);
  await page.getByRole('button', { name: 'Modo de visualização' }).click();
  await expect(separator(page)).toHaveAttribute('aria-orientation', 'vertical');
  const initial = (await page.getByTestId('graph').boundingBox())!.width;
  const sourceInitial = (await pane(page).boundingBox())!.width;
  await dragDivider(page, 100);
  await expect(pane(page).locator('.selected-line').first()).toBeInViewport();
  expect((await page.getByTestId('graph').boundingBox())!.width).toBeGreaterThan(initial + 80);
  expect((await pane(page).boundingBox())!.width).toBeLessThan(sourceInitial - 80);
  await dragDivider(page, -160);
  expect((await pane(page).boundingBox())!.width).toBeGreaterThan(sourceInitial + 40);
  await separator(page).press('Home');
  expect((await page.getByTestId('graph').boundingBox())!.width).toBeCloseTo(240, 0);
  await separator(page).press('End');
  expect((await pane(page).boundingBox())!.width).toBeCloseTo(240, 0);
  await separator(page).press('Enter');
  expect((await page.getByTestId('graph').boundingBox())!.width).toBeCloseTo(initial, 0);
  await separator(page).press('ArrowLeft');
  const saved = await separator(page).getAttribute('aria-valuenow');
  await page.getByRole('button', { name: 'Sair da visualização' }).click();
  await page.getByRole('button', { name: 'Código fonte', exact: true }).click();
  await expect(separator(page)).toHaveAttribute('aria-valuenow', saved!);
  const normalWidth = (await pane(page).boundingBox())!.width;
  await dragDivider(page, -20);
  expect((await pane(page).boundingBox())!.width).toBeGreaterThan(normalWidth + 10);
  await page.getByRole('button', { name: 'Modo de visualização' }).click();
  await separator(page).dblclick();
  for (const width of [800, 1280, 1440]) {
    await page.setViewportSize({ width, height: 720 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollHeight))
      .toBeLessThanOrEqual(720);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    const graph = (await page.getByTestId('graph').boundingBox())!;
    const code = (await pane(page).boundingBox())!;
    expect(graph.width).toBeGreaterThanOrEqual(240);
    expect(code.width).toBeGreaterThanOrEqual(240);
    expect(code.x).toBeCloseTo(graph.x + graph.width + 12, 0);
    expect(code.y).toBeCloseTo(graph.y, 0);
    expect(code.height).toBeCloseTo(graph.height, 0);
    expect(code.x + code.width).toBeLessThanOrEqual(width);
    expect(code.y + code.height).toBeLessThanOrEqual(721);
  }
  await page.screenshot({ path: 'test-results/viewing-mode.png', fullPage: true });
});
