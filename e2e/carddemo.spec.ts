import { test, expect } from '@playwright/test';
import { visibleBoxPixels } from './graph-helpers';

test('real COACTUPC: graph, COPY, source evidence, FILE candidates, paths and paragraphs', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?example=carddemo-coactupc');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('COACTUPC', { timeout: 30000 });
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false', { timeout: 60000 });
  await expect(page.locator('.graph-context')).toContainText('5037 de 5037');
  await expect(page.locator('.graph-context')).toContainText('6293 transições');
  expect(await page.locator('.graph-node-target').count()).toBeLessThan(5037);
  // Check the actual WebGL raster; nearby boxes must remain visible against the dark scene.
  expect(Number(await page.getByTestId('graph').getAttribute('data-textures'))).toBeLessThanOrEqual(
    128,
  );
  expect((await visibleBoxPixels(page)).light).toBeGreaterThan(15000);
  // A layered 5,037-node program also needs to remain visible beyond the default far plane.
  await page.getByRole('button', { name: 'Enquadrar recorte' }).click();
  // Individual boxes are subpixel here; check the rendered diagram, excluding overlay controls.
  expect((await visibleBoxPixels(page)).visible).toBeGreaterThan(200);
  await page.screenshot({ path: 'test-results/planar-carddemo-overview.png', fullPage: true });
  await page.getByRole('button', { name: 'Ler seleção de perto' }).click();
  await expect(page.locator('.graph-node-target.is-selected')).toBeVisible();
  const nav = page.getByRole('complementary', { name: 'Navegação do programa' });
  const inspector = page.getByRole('complementary', { name: 'Inspetor' });
  await expect(nav.locator('.nav-item')).toHaveCount(8);
  await nav
    .getByRole('button', { name: /^CALL 'CSUTLDTC'/ })
    .first()
    .click();
  await expect(inspector).not.toContainText('Site inalcançável no modelo selecionado');
  await expect(
    inspector.getByRole('heading', { name: 'Candidatos da evidência fonte' }),
  ).toBeVisible();
  await expect(inspector.locator('.source-evidence')).toContainText('CSUTLDTC');
  await page.getByRole('button', { name: 'Código fonte', exact: true }).click();
  const source = page.getByRole('region', { name: 'Código fonte original' });
  await expect(source.getByLabel('Arquivo de código fonte')).toHaveValue('CSUTLDPY.cpy');
  await expect(source.locator('.selected-line').first()).toContainText("CALL 'CSUTLDTC'");
  await source.getByRole('button', { name: 'Fechar código fonte' }).click();
  await nav.getByRole('button', { name: /EXEC CICS XCTL/ }).click();
  await expect(inspector.getByRole('button', { name: 'Caminhos até aqui' })).toBeEnabled();
  await expect(inspector).toContainText('COMEN01C');
  await page.getByRole('button', { name: 'Código fonte', exact: true }).click();
  await expect(source.locator('.selected-line').first()).toContainText('EXEC CICS XCTL');
  await expect(source.locator('.selected-line').first()).toBeInViewport();
  await nav.getByRole('tab', { name: 'Arquivos', exact: true }).click();
  await expect(nav.locator('.nav-item')).toHaveCount(14);
  await nav.locator('.nav-item').first().click();
  await expect(source.locator('.selected-line').first()).toContainText('EXEC CICS');
  await expect(source.locator('.selected-line').first()).toBeInViewport();
  await source.getByRole('button', { name: 'Fechar código fonte' }).click();
  await expect(inspector.getByRole('heading', { name: 'Valores possíveis' })).toBeVisible();
  await expect(inspector).not.toContainText('Site inalcançável no modelo selecionado');
  await inspector.getByRole('button', { name: 'Caminhos até aqui' }).click();
  await expect(page.locator('.path-banner')).toContainText('trechos em caminhos conhecidos até:');
  await page.getByRole('checkbox', { name: 'Um caminho', exact: true }).check();
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false', { timeout: 60000 });
  expect(
    Number(await page.getByTestId('graph').getAttribute('data-witness-edges')),
  ).toBeGreaterThan(0);
  expect(Number(await page.getByTestId('graph').getAttribute('data-nodes'))).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.locator('.graph-context')).toContainText('5037 de 5037');
  await nav.getByRole('tab', { name: 'Paragraphs', exact: true }).click();
  await page.getByLabel('Buscar no programa').fill('9000-READ-ACCT');
  await nav.getByRole('button', { name: /^9000-READ-ACCT\./ }).click();
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
  await expect(page.locator('.graph-context')).toContainText('recorte do paragraph');
  await page.getByRole('button', { name: 'Código fonte', exact: true }).click();
  await expect(source.getByLabel('Arquivo de código fonte')).toHaveValue('COACTUPC.cbl');
  await expect(source.locator('.source-document')).toContainText('PROGRAM-ID.');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(errors).toEqual([]);
  await expect(source.locator('.selected-line').first()).toContainText('9000-READ-ACCT.');
  await page.screenshot({ path: 'test-results/carddemo-coactupc.png', fullPage: true });
  await page.getByRole('button', { name: 'Modo de visualização' }).click();
  await expect(nav).not.toBeVisible();
  await expect(source.locator('.selected-line').first()).toBeInViewport();
  const divider = page.getByRole('separator', { name: 'Ajustar tamanho do grafo e do código' });
  await divider.press('ArrowLeft');
  await divider.press('ArrowLeft');
  await expect(source.locator('.selected-line').first()).toBeInViewport();
  await page.screenshot({ path: 'test-results/carddemo-viewing.png', fullPage: true });
  await page.getByRole('button', { name: 'Sair da visualização' }).click();
  await expect(page.locator('.graph-context')).toContainText('recorte do paragraph');
  await expect(source).toBeVisible();
  expect(errors).toEqual([]);
});
