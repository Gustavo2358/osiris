import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('the URL follows the installed example and refresh preserves it', async ({ page }) => {
  await page.goto('/?example=order-router&keep=yes#graph');
  const select = page.getByLabel('Escolher exemplo');
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
  await select.selectOption('shared-values');
  await expect(select).toHaveValue('shared-values');
  await expect(page).toHaveURL(/example=shared-values&keep=yes#graph$/);
  await expect(page.getByTestId('graph')).toHaveAttribute('data-nodes', '13');
  await page.reload();
  await expect(select).toHaveValue('shared-values');
  await expect(page.getByTestId('graph')).toHaveAttribute('data-nodes', '13');
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
  await select.selectOption('order-router');
  await expect(page).toHaveURL(/example=order-router&keep=yes#graph$/);
  await page.reload();
  await expect(select).toHaveValue('order-router');
  await expect(page.getByTestId('graph')).toHaveAttribute('data-nodes', '16');
});

test('a failed example or import preserves the current publication and URL', async ({ page }) => {
  await page.goto('/?example=shared-values');
  const select = page.getByLabel('Escolher exemplo');
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
  await page.route('**/examples/perform-shared.json.gz', (route) => route.fulfill({ status: 503 }));
  await select.selectOption('perform-shared');
  await expect(page.getByRole('alert')).toContainText('Exemplo indisponível');
  await expect(select).toHaveValue('shared-values');
  await expect(page).toHaveURL(/example=shared-values$/);
  await page.getByLabel('Selecionar artefatos').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{'),
  });
  await expect(page.getByRole('alert')).toContainText('JSON inválido');
  await expect(select).toHaveValue('shared-values');
  await expect(page).toHaveURL(/example=shared-values$/);
  await expect(page.getByTestId('graph')).toHaveAttribute('data-nodes', '13');
});

test('a late response cannot roll the URL or publication back to an older selection', async ({
  page,
}) => {
  await page.goto('/?example=order-router');
  const select = page.getByLabel('Escolher exemplo');
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/examples/perform-shared.json.gz', async (route) => {
    await held;
    await route.fulfill({ body: readFileSync('public/examples/perform-shared.json.gz') });
  });
  const requested = page.waitForRequest('**/examples/perform-shared.json.gz');
  await select.selectOption('perform-shared');
  await requested;
  await select.selectOption('shared-values');
  await expect(select).toHaveValue('shared-values');
  const finished = page.waitForResponse('**/examples/perform-shared.json.gz');
  release();
  await (await finished).finished();
  // Finish decompression, admission and React rendering of the released small bundle.
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false');
  await expect(select).toHaveValue('shared-values');
  await expect(page).toHaveURL(/example=shared-values$/);
  await expect(page.getByTestId('graph')).toHaveAttribute('data-nodes', '13');
});
