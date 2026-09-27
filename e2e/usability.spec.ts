import { expectCamera } from './graph-helpers';
import { test, expect, type Page } from '@playwright/test';

async function open(page: Page, example = 'files-values') {
  await page.goto('/?example=' + example);
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.graph-node-target').first()).toBeVisible();
}
const inspector = (page: Page) => page.getByRole('complementary', { name: 'Inspetor' });
const navigator = (page: Page) =>
  page.getByRole('complementary', { name: 'Navegação do programa' });
const zoom = (page: Page) =>
  page.getByTestId('graph').evaluate((el) => Number(el.getAttribute('data-distance')));

test('UX-01 producer and flow navigation preserve the investigation and Back restores it', async ({
  page,
}) => {
  await open(page);
  await inspector(page).getByRole('button', { name: 'Caminhos até aqui' }).click();
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
  const context = await page.locator('.graph-context').innerText();
  const viewport = await page.getByTestId('graph').getAttribute('data-camera');
  await inspector(page).locator('.candidate-supports .producer-link').first().click();
  await expect(inspector(page).getByRole('heading', { level: 2 })).toContainText("MOVE 'ACCOUNTS'");
  await expect(page.locator('.path-banner')).toBeVisible();
  await expect(page.locator('.graph-context')).toHaveText(context);
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(inspector(page).getByRole('heading', { level: 2 })).toContainText('ENDBR');
  await expect(page.locator('.path-banner')).toBeVisible();
  await expectCamera(page, viewport!);
  await inspector(page)
    .getByRole('button', { name: /→ GOBACK/ })
    .click();
  await expect(page.locator('.path-banner')).toHaveCount(0);
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.locator('.path-banner')).toBeVisible();
});

test('UX-02 selecting another statement preserves user zoom and exposes recenter', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: /Zoom Out|Diminuir zoom/, exact: true }).click();
  const previous = await zoom(page);
  await inspector(page).locator('.candidate-supports .producer-link').first().click();
  await expect(inspector(page).getByRole('heading', { level: 2 })).toContainText('MOVE');
  await expect.poll(() => zoom(page)).toBeCloseTo(previous, 5);
  await page.getByRole('button', { name: 'Centralizar seleção', exact: true }).click();
  await expect.poll(() => zoom(page)).toBeCloseTo(previous, 5);
  const card = await page.locator('.graph-node-target.is-selected').boundingBox();
  const graph = await page.getByTestId('graph').boundingBox();
  expect(card!.x).toBeGreaterThanOrEqual(graph!.x);
  expect(card!.x + card!.width).toBeLessThanOrEqual(graph!.x + graph!.width);
});

test('UX-03 category searches are independent and empty results can recover', async ({ page }) => {
  await open(page, 'order-router');
  const input = page.getByLabel('Buscar no programa');
  await input.fill('AUDITLOG');
  await expect(navigator(page).locator('.nav-item')).toHaveCount(1);
  await navigator(page).getByRole('tab', { name: 'Paragraphs', exact: true }).click();
  await expect(input).toHaveValue('');
  await input.fill('NOT-A-PARAGRAPH');
  await expect(navigator(page).locator('.empty-note')).toContainText('NOT-A-PARAGRAPH');
  await navigator(page).getByRole('button', { name: 'Mostrar todos', exact: true }).click();
  await expect(input).toHaveValue('');
  await navigator(page).getByRole('tab', { name: 'Chamadas', exact: true }).click();
  await expect(input).toHaveValue('AUDITLOG');
  await expect(navigator(page).locator('.list-caption')).toContainText('1 de 3');
});

test('UX-04 list previews distinguish sites and provenance shows precise spans', async ({
  page,
}) => {
  await open(page);
  await expect(navigator(page).locator('.nav-item')).toContainText('ACCOUNTS');
  await expect(navigator(page).locator('.nav-item')).toContainText('CUSTOMER');
  await expect(navigator(page).locator('.nav-item')).toContainText('computed-closed.cbl:20');
  const spans = await inspector(page)
    .locator('.candidate-supports .producer-link')
    .allTextContents();
  expect(spans[0]).toContain('col. 22–42');
  expect(spans.length).toBeGreaterThan(1);
  expect(new Set(spans).size).toBe(spans.length);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({ path: 'test-results/ux-discovery-list.png', fullPage: true });
});

test('UX-05 both tab groups follow keyboard and panel semantics', async ({ page }) => {
  await open(page);
  for (const group of [navigator(page), inspector(page)]) {
    const tabs = group.getByRole('tab');
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(tabs.last()).toBeFocused();
    await page.keyboard.press('Home');
    await expect(tabs.first()).toBeFocused();
    const panelId = await tabs.first().getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    await expect(group.getByRole('tabpanel')).toHaveAttribute('id', panelId!);
    await expect(group.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
  }
});

test('UX-06 help traps focus, Escape closes it and restores the trigger without going Back', async ({
  page,
}) => {
  await open(page);
  await inspector(page).getByRole('button', { name: 'Caminhos até aqui' }).click();
  await page.getByRole('button', { name: 'Ajuda', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ajuda', exact: true })).toBeFocused();
  await expect(page.locator('.path-banner')).toBeVisible();
});

test('UX-07 readable metadata and usable clear action at desktop and tablet sizes', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('Buscar no programa').fill('ACCOUNTS');
  const size = await page.getByRole('button', { name: 'Limpar busca' }).boundingBox();
  expect(size!.width).toBeGreaterThanOrEqual(24);
  expect(size!.height).toBeGreaterThanOrEqual(24);
  for (const selector of ['.list-caption', '.nav-item-body > span', '.location-label', '.micro']) {
    const ratio = await page
      .locator(selector)
      .first()
      .evaluate((el) => {
        const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number);
        let bg = [255, 255, 255];
        for (let p: Element | null = el; p; p = p.parentElement) {
          const c = rgb(getComputedStyle(p).backgroundColor);
          if (c.length === 3 || c[3] === 1) {
            bg = c;
            break;
          }
        }
        const lum = (c: number[]) =>
          c
            .slice(0, 3)
            .map((v) => {
              v /= 255;
              return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            })
            .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
        const a = lum(rgb(getComputedStyle(el).color)),
          b = lum(bg);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
    expect(ratio, selector).toBeGreaterThanOrEqual(4.5);
  }
  for (const width of [800, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await expect(page.getByRole('button', { name: 'Caminhos', exact: true })).toBeVisible();
  }
});

test('UX-08 active entry counts and path destination remain unambiguous', async ({ page }) => {
  await open(page, 'nested');
  await page
    .getByRole('combobox', { name: 'Entrada do programa', exact: true })
    .selectOption({ index: 1 });
  await expect(page.locator('.graph-context')).toContainText('4 de 4');
  await expect(page.locator('.graph-context')).toContainText('entrada');
  await open(page);
  await inspector(page).getByRole('button', { name: 'Caminhos até aqui' }).click();
  await inspector(page).locator('.candidate-supports .producer-link').first().click();
  await expect(page.locator('.path-banner')).toContainText('ENDBR FILE(FN)');
  await page.getByRole('button', { name: 'Inspecionar destino do caminho', exact: true }).click();
  await expect(inspector(page).getByRole('heading', { level: 2 })).toContainText('ENDBR');
  await expect(page.locator('.path-banner')).toBeVisible();
});

test('UX-09 paths and source remain fully accessible in a short laptop window', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page);
  await inspector(page).getByRole('button', { name: 'Caminhos até aqui' }).click();
  await page.getByRole('button', { name: 'Código fonte', exact: true }).click();
  const pane = page.getByRole('region', { name: 'Código fonte original' });
  const workspace = page.locator('.graph-source-workspace');
  for (let i = 0; i < 2; i++) {
    const box = await pane.boundingBox(),
      area = await workspace.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(area!.y + area!.height + 1);
    const graph = await page.getByTestId('graph').boundingBox();
    for (const button of await page.locator('.graph3d-controls button').all()) {
      const control = await button.boundingBox();
      expect(control!.y).toBeGreaterThanOrEqual(graph!.y);
      expect(control!.y + control!.height).toBeLessThanOrEqual(graph!.y + graph!.height - 30);
    }
    const code = pane.locator('.source-document');
    await code.focus();
    await page.keyboard.press('Control+End');
    await expect(pane.locator('.source-line').filter({ hasText: 'GOBACK' })).toBeInViewport();
    if (!i) await pane.getByRole('button', { name: 'Ampliar painel de código' }).click();
  }
  await page.screenshot({ path: 'test-results/ux-paths-source-1280.png', fullPage: true });
});
