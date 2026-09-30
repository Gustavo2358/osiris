import { expectCamera } from './graph-helpers';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
async function ready(page: any, example = 'order-router') {
  await page.goto('/?example=' + example);
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
  await expect(page.locator('.graph-node-target').first()).toBeVisible();
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
  await expect
    .poll(async () => Number(await page.getByTestId('graph').getAttribute('data-witness-edges')))
    .toBeGreaterThan(0);
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
  expect(await page.locator('.graph-node-target').count()).toBeLessThan(503);
  await page.getByLabel('Buscar no programa').fill('SRV099');
  const nav = page.getByRole('complementary', { name: 'Navegação do programa' });
  await expect(nav.locator('.nav-item')).toHaveCount(1);
  await nav.locator('.nav-item').click();
  await page.getByRole('button', { name: 'Caminhos até aqui' }).click();
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
  await expect(page.locator('.path-banner')).toContainText('caminhos conhecidos');
  await page.getByRole('button', { name: 'Vizinhança', exact: true }).click();
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
  expect(await page.locator('.graph-node-target').count()).toBeLessThan(30);
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
  await expect(page.locator('.graph-context')).toContainText('4 de 4');
});
test('import real bundle; malformed and mismatched files preserve the current program', async ({
  page,
}) => {
  await ready(page);
  await expect(page).toHaveURL(/example=order-router/);
  await page.getByLabel('Selecionar artefatos').setInputFiles('public/examples/copy.json.gz');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('COPY-DEMO');
  await expect(page).toHaveURL('http://127.0.0.1:4173/');
  await expect(page.getByLabel('Escolher exemplo')).toHaveValue('');
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

test('Back restores paragraph, selection and exact viewport after highlighting paths', async ({
  page,
}) => {
  await ready(page);
  const nav = page.getByRole('complementary', { name: 'Navegação do programa' });
  const inspector = page.getByRole('complementary', { name: 'Inspetor' });
  await nav.getByRole('tab', { name: 'Paragraphs' }).click();
  await nav.getByRole('button', { name: /VALIDATE-ORDER/ }).click();
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
  const context = await page.locator('.graph-context').innerText();
  const selection = await inspector.getByRole('heading', { level: 2 }).innerText();
  // Zoom is part of the user's previous view, not just the node filter.
  await page.getByRole('button', { name: 'Diminuir zoom', exact: true }).click();
  await expect
    .poll(() => page.getByTestId('graph').getAttribute('data-camera'))
    .toContain('position');
  const viewport = await page.getByTestId('graph').getAttribute('data-camera');
  await inspector.getByRole('button', { name: 'Caminhos até aqui' }).click();
  await page.getByLabel('Um caminho', { exact: true }).check();
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Voltar à visão anterior', exact: true }).click();
  await expect(page.locator('.path-banner')).toHaveCount(0);
  await expect(page.locator('.graph-context')).toHaveText(context);
  await expect(inspector.getByRole('heading', { level: 2 })).toHaveText(selection);
  await expectCamera(page, viewport!);
  await page.getByRole('button', { name: 'Caminhos', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.graph-context')).toHaveText(context);
  await expect(page.locator('.path-banner')).toHaveCount(0);
});

test('full source pane follows selection, supports COPY and closes without changing the graph', async ({
  page,
}) => {
  await ready(page, 'copy');
  await page.getByRole('button', { name: 'Código fonte', exact: true }).click();
  const pane = page.getByRole('region', { name: 'Código fonte original' });
  await expect(pane).toBeVisible();
  await expect
    .poll(async () => {
      const card = await page.locator('.graph-node-target.is-selected').boundingBox();
      const graph = await page.getByTestId('graph').boundingBox();
      return (
        !!card &&
        !!graph &&
        card.y >= graph.y &&
        card.y + card.height <= graph.y + graph.height - 30
      );
    })
    .toBe(true);
  const nav = page.getByRole('complementary', { name: 'Navegação do programa' });
  await nav.getByRole('button', { name: /CALL WS-PGM/ }).click();
  await expect(pane.getByLabel('Arquivo de código fonte')).toHaveValue('CALLPART.cpy');
  await expect(pane.locator('.selected-line')).toContainText('CALL WS-PGM');
  await pane.getByLabel('Arquivo de código fonte').selectOption('COPY-DEMO.cbl');
  await expect(pane.getByLabel('Acompanhar seleção')).not.toBeChecked();
  await expect(pane.locator('.source-document')).toContainText('IDENTIFICATION DIVISION');
  await expect(pane.locator('.source-document')).toContainText('GOBACK');
  await pane.getByRole('button', { name: 'Ir para a seleção no código' }).click();
  await expect(pane.getByLabel('Arquivo de código fonte')).toHaveValue('CALLPART.cpy');
  const context = await page.locator('.graph-context').innerText();
  await pane.getByRole('button', { name: 'Fechar código fonte' }).click();
  await expect(pane).toHaveCount(0);
  await expect(page.locator('.graph-context')).toHaveText(context);
});

test('FILE values, producer navigation, SYSID, source pane and control paths', async ({ page }) => {
  await ready(page, 'files-values');
  const nav = page.getByRole('complementary', { name: 'Navegação do programa' });
  const inspector = page.getByRole('complementary', { name: 'Inspetor' });
  await expect(nav.getByRole('tab', { name: 'Arquivos', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByLabel('Buscar no programa').fill('CUSTOMER');
  await expect(nav.locator('.nav-item')).toHaveCount(1);
  await nav.locator('.nav-item').click();
  await expect(
    inspector.getByRole('heading', { name: 'Valores possíveis', exact: true }),
  ).toBeVisible();
  await expect(inspector.locator('.candidate-name')).toContainText(['ACCOUNTS', 'CUSTOMER']);
  await expect(inspector.locator('.file-context')).toContainText('R001');
  await page.getByRole('button', { name: 'Código fonte', exact: true }).click();
  await expect(page.locator('.selected-line')).toContainText(['EXEC CICS ENDBR', 'NOHANDLE']);
  await inspector.locator('.candidate-supports .producer-link').first().click();
  await expect(inspector.getByRole('heading', { level: 2 })).toContainText('MOVE');
  await nav.locator('.nav-item').click();
  await inspector.getByRole('button', { name: 'Caminhos até aqui' }).click();
  await expect(page.locator('.path-banner')).toContainText('caminhos conhecidos');
  await page.getByLabel('Destacar arquivos', { exact: true }).check();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.locator('.path-banner')).toHaveCount(0);
  await expect(page.getByLabel('Destacar arquivos', { exact: true })).not.toBeChecked();
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
  await page.screenshot({ path: 'test-results/files-source.png', fullPage: true });
});

test('source pane fits a tablet and reports a missing original instead of substituting expanded text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await ready(page, 'files-values');
  await page.getByRole('button', { name: 'Código fonte', exact: true }).click();
  const pane = page.getByRole('region', { name: 'Código fonte original' });
  await expect(pane.getByLabel('Arquivo de código fonte')).toHaveValue('computed-closed.cbl');
  await pane.getByRole('button', { name: 'Ampliar painel de código' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(800);
  const bundle = JSON.parse(
    gunzipSync(readFileSync('public/examples/files-values.json.gz')).toString(),
  );
  delete bundle.sources['computed-closed.cbl'];
  await page.getByLabel('Selecionar artefatos').setInputFiles({
    name: 'missing-source.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(bundle)),
  });
  await expect(pane).toContainText('não foi fornecido');
  await expect(pane.locator('.source-document')).toHaveCount(0);
  await pane.getByLabel('Arquivo de código fonte').selectOption('<preprocessed>');
  await expect(pane).toContainText('Fonte expandido');
  await expect(pane.locator('.source-document')).toContainText('EXEC CICS ENDBR');
  await page
    .getByRole('complementary', { name: 'Inspetor' })
    .getByRole('button', { name: /computed-closed.cbl:20/ })
    .click();
  await expect(pane.getByLabel('Arquivo de código fonte')).toHaveValue('computed-closed.cbl');
  await expect(pane).toContainText('não foi fornecido');
});
