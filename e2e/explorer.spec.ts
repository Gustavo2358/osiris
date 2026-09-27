import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
async function ready(page: any, example = 'order-router') {
  await page.goto('/?example=' + example);
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.graph-card').first()).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
}
test('call navigation, provenance, candidates, paths, witness, source and debug', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page, 'cics');
  const nav = page.getByRole('complementary', { name: 'Navegação do programa' }),
    inspector = page.getByRole('complementary', { name: 'Inspetor' });
  await nav.getByRole('button', { name: /LINK PROGRAM\(WS-PGM\)/ }).click();
  await expect(
    inspector.locator('section').first().getByText('DETAIL', { exact: true }),
  ).toBeVisible();
  await expect(
    inspector.locator('section').first().getByText('SUMMARY', { exact: true }),
  ).toBeVisible();
  await inspector.getByRole('button', { name: 'Caminhos até aqui' }).click();
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.path-banner')).toContainText('caminhos conhecidos');
  await page.getByLabel('Um caminho', { exact: true }).check();
  await expect(page.locator('.react-flow__edge-path[style*="stroke-width: 3"]')).not.toHaveCount(0);
  await inspector.getByRole('tab', { name: 'Fonte', exact: true }).click();
  await expect(inspector.locator('.source-code')).toContainText('LINK PROGRAM(WS-PGM)');
  await inspector.getByRole('tab', { name: 'Internos', exact: true }).click();
  await inspector.getByText('Nó CFG', { exact: true }).click();
  await expect(inspector.locator('pre').first()).toContainText('publication');
  await inspector.getByRole('tab', { name: 'Evidências', exact: true }).click();
  await page.screenshot({ path: 'test-results/cics-paths.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('search, paragraph navigation and local neighborhood', async ({ page }) => {
  await ready(page);
  const nav = page.getByRole('complementary', { name: 'Navegação do programa' });
  await page.getByLabel('Buscar no programa').fill('AUDITLOG');
  await expect(nav.locator('.nav-item')).toHaveCount(1);
  await nav.locator('.nav-item').click();
  await page.getByRole('button', { name: 'Vizinhança', exact: true }).click();
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
  const text = await page.locator('.graph-context').innerText();
  expect(text).not.toMatch(/^16 de 16/);
  await page.getByRole('button', { name: 'Limpar busca' }).click();
  await nav.getByRole('tab', { name: 'Paragraphs' }).click();
  await nav.getByRole('button', { name: /VALIDATE-ORDER/ }).click();
  await expect(page.locator('.graph-context')).toContainText('recorte do paragraph');
  await page.getByRole('button', { name: 'Programa inteiro', exact: true }).click();
  await expect(page.locator('.graph-context')).toContainText('16 de 16');
});
test('503 node graph stays navigable and limits DOM to viewport', async ({ page }) => {
  await ready(page, 'large');
  await expect(page.locator('.graph-context')).toContainText('503 de 503');
  expect(await page.locator('.graph-card').count()).toBeLessThan(503);
  await page.getByLabel('Buscar no programa').fill('SRV099');
  const nav = page.getByRole('complementary', { name: 'Navegação do programa' });
  await expect(nav.locator('.nav-item')).toHaveCount(1);
  await nav.locator('.nav-item').click();
  await page.getByRole('button', { name: 'Caminhos até aqui' }).click();
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
  await expect(page.locator('.path-banner')).toContainText('caminhos conhecidos');
  await page.getByRole('button', { name: 'Vizinhança', exact: true }).click();
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
  expect(await page.locator('.graph-card').count()).toBeLessThan(30);
});
test('nested program entry switches exact identity scopes', async ({ page }) => {
  await ready(page, 'nested');
  const select = page.getByRole('combobox', { name: 'Entrada do programa' });
  const options = await select.locator('option').allTextContents();
  expect(options).toHaveLength(2);
  await select.selectOption({ index: 1 });
  await expect(
    page.getByRole('complementary', { name: 'Navegação do programa' }).locator('.nav-item'),
  ).toHaveCount(1);
  await expect(page.locator('.graph-context')).toContainText('4 de 8');
});
test('import real bundle; malformed and mismatched files preserve the current program', async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel('Selecionar artefatos').setInputFiles('public/examples/copy.json.gz');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('COPY-DEMO');
  await page
    .getByLabel('Selecionar artefatos')
    .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(page.getByRole('alert')).toContainText('JSON inválido');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('COPY-DEMO');
  const bundle = JSON.parse(
    gunzipSync(readFileSync('public/examples/order-router.json.gz')).toString(),
  );
  const cfg = JSON.parse(bundle.artifacts['cfg.json']);
  cfg.publication.localId = 'other';
  bundle.artifacts['cfg.json'] = JSON.stringify(cfg);
  await page.getByLabel('Selecionar artefatos').setInputFiles({
    name: 'mixed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(bundle)),
  });
  await expect(page.getByRole('alert')).toContainText('publicações diferentes');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('COPY-DEMO');
});
test('local files remain local; no unexpected network destination', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await ready(page, 'copy');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('COPY-DEMO');
  expect(
    requests.filter((u) => !u.startsWith('http://127.0.0.1:4173/') && !u.startsWith('blob:')),
  ).toEqual([]);
});
test('keyboard selection and tablet width keep program tools available', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await ready(page);
  const nav = page.getByRole('complementary', { name: 'Navegação do programa' });
  await nav.getByRole('button', { name: /AUDITLOG/ }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('complementary', { name: 'Inspetor' }).getByRole('heading', { level: 2 }),
  ).toContainText('AUDITLOG');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(800);
  await page.getByRole('button', { name: 'Ajuda', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar ajuda' }).click();
});
