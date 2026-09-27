import { test, expect } from '@playwright/test';

test('real COACTUPC: graph, COPY, source evidence, FILE limits, paths and paragraphs', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?example=carddemo-coactupc');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('COACTUPC', { timeout: 30000 });
  await expect(page.getByTestId('graph')).toHaveAttribute('aria-busy', 'false', { timeout: 60000 });
  await expect(page.locator('.graph-context')).toContainText('3048 de 3048');
  await expect(page.locator('.graph-context')).toContainText('3887 transições');
  expect(await page.locator('.graph-card').count()).toBeLessThan(3048);
  const nav = page.getByRole('complementary', { name: 'Navegação do programa' });
  const inspector = page.getByRole('complementary', { name: 'Inspetor' });
  await expect(nav.locator('.nav-item')).toHaveCount(5); // Four control contexts and one source-only XCTL.
  await expect(inspector).toContainText('Site inalcançável no modelo selecionado');
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
  await expect(inspector.getByRole('button', { name: 'Caminhos até aqui' })).toBeDisabled();
  await nav.getByRole('tab', { name: 'Arquivos', exact: true }).click();
  await expect(nav.locator('.nav-item')).toHaveCount(7);
  await nav.locator('.nav-item').first().click();
  await expect(inspector.getByRole('heading', { name: 'Valores possíveis' })).toBeVisible();
  await expect(inspector).toContainText('Site inalcançável no modelo selecionado');
  await inspector.getByRole('button', { name: 'Caminhos até aqui' }).click();
  await expect(page.locator('.path-banner')).toContainText('Sem caminho conhecido');
  await expect(page.locator('.graph-context')).toContainText('0 de 3048');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.locator('.graph-context')).toContainText('3048 de 3048');
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
  await page.screenshot({ path: 'test-results/carddemo-coactupc.png', fullPage: true });
});
