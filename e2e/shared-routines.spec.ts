import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { visibleBoxPixels } from './graph-helpers';

test('shared CALL: one node, matched paths, source and explicit value-path limit', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?example=shared-values');
  const graph = page.getByTestId('graph'),
    nav = page.getByRole('complementary', { name: 'Navegação do programa' }),
    inspector = page.getByRole('complementary', { name: 'Inspetor' });
  await expect(graph).toHaveAttribute('aria-busy', 'false');
  await expect(graph).toHaveAttribute('data-nodes', '13');
  await expect(nav.locator('.nav-item')).toHaveCount(3);
  await nav.locator('.nav-item').filter({ hasText: 'shared-caller-values.cbl:15' }).click();
  await expect(inspector).toContainText('Corpo compartilhado · 2 contextos de execução');
  await expect(inspector).toContainText('PROGA001');
  await expect(inspector).toContainText('PROGB001');
  await inspector
    .getByRole('button', { name: 'Iluminar definição de PROGA001', exact: true })
    .click();
  await expect(page.locator('.value-path-banner')).toContainText(
    'não comprovam kills por chamador',
  );
  await expect(graph).toHaveAttribute('data-value-edges', /^[1-9]\d*$/);
  await page.getByRole('button', { name: 'Limpar destaque' }).click();
  await nav.locator('.nav-item').filter({ hasText: 'shared-caller-values.cbl:9' }).click();
  await inspector.getByRole('button', { name: 'Caminhos até aqui' }).click();
  await expect(graph).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.path-banner')).toContainText(
    'Retornos de PERFORM respeitam o chamador',
  );
  await page.getByRole('checkbox', { name: 'Um caminho', exact: true }).check();
  await expect(graph).toHaveAttribute('data-witness-edges', /^[1-9]\d*$/);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar subgrafo selecionado' }).click();
  const download = await downloadPromise,
    file = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(file.version).toBe('2.0.0');
  expect(file.localControl).toHaveLength(3);
  expect(file.transitions.every((e: any) => e.derivedFrom !== 'CFG_LOCAL_RULE')).toBe(true);
  expect(
    file.displayTransitions.some((e: any) => e.kind === 'LOCAL_RESUME' && e.from && e.to),
  ).toBe(true);
  await page.getByRole('button', { name: 'Código fonte', exact: true }).click();
  const source = page.getByRole('region', { name: 'Código fonte original' });
  await expect(source.getByLabel('Arquivo de código fonte')).toHaveValue(
    'shared-caller-values.cbl',
  );
  await expect(source.locator('.selected-line').first()).toContainText('CALL TARGET-NAME');
  await page.screenshot({ path: 'test-results/shared-call.png' });
  expect(errors).toEqual([]);
});

test('shared FILE: candidates, source and clear highlight', async ({ page }) => {
  await page.goto('/?example=shared-files');
  const graph = page.getByTestId('graph'),
    inspector = page.getByRole('complementary', { name: 'Inspetor' });
  await expect(graph).toHaveAttribute('aria-busy', 'false');
  await expect(
    page.getByRole('complementary', { name: 'Navegação do programa' }).locator('.nav-item'),
  ).toHaveCount(1);
  await expect(inspector).toContainText('Corpo compartilhado · 2 contextos de execução');
  await inspector
    .getByRole('button', { name: 'Iluminar definição de ACCOUNT', exact: true })
    .click();
  await expect(page.locator('.value-path-banner')).toContainText('acesso ao arquivo');
  await expect(page.locator('.value-path-banner')).toContainText(
    'não comprovam kills por chamador',
  );
  await page.getByLabel('Valor a destacar').selectOption({ label: 'CUSTOMER' });
  await expect(graph).toHaveAttribute('data-value-edges', /^[1-9]\d*$/);
  await page.getByRole('button', { name: 'Limpar destaque' }).click();
  await expect(graph).toHaveAttribute('data-value-highlight', 'off');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('COACTUPC v5: 3065 visible nodes, 3827 displayed transitions, COPY and matched FILE paths', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?example=carddemo-coactupc-shared');
  const graph = page.getByTestId('graph'),
    nav = page.getByRole('complementary', { name: 'Navegação do programa' }),
    inspector = page.getByRole('complementary', { name: 'Inspetor' });
  await expect(graph).toHaveAttribute('aria-busy', 'false', { timeout: 60000 });
  await expect(graph).toHaveAttribute('data-nodes', '3065');
  await expect(graph).toHaveAttribute('data-edges', '3827');
  await expect(nav.locator('.nav-item')).toHaveCount(6);
  expect((await visibleBoxPixels(page)).light).toBeGreaterThan(1000);
  await nav
    .getByRole('button', { name: /^CALL 'CSUTLDTC'/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Código fonte', exact: true }).click();
  const source = page.getByRole('region', { name: 'Código fonte original' });
  await expect(source.getByLabel('Arquivo de código fonte')).toHaveValue('CSUTLDPY.cpy');
  await expect(source.locator('.selected-line').first()).toContainText("CALL 'CSUTLDTC'");
  await source.getByRole('button', { name: 'Fechar código fonte' }).click();
  await nav.getByRole('tab', { name: 'Arquivos', exact: true }).click();
  await expect(nav.locator('.nav-item')).toHaveCount(14);
  await nav.locator('.nav-item').first().click();
  await expect(inspector.getByRole('heading', { name: 'Valores possíveis' })).toBeVisible();
  await inspector.getByRole('button', { name: 'Caminhos até aqui' }).click();
  await expect(graph).toHaveAttribute('aria-busy', 'false', { timeout: 60000 });
  await expect(page.locator('.path-banner')).toContainText(
    'Retornos de PERFORM respeitam o chamador',
  );
  await page.getByRole('checkbox', { name: 'Um caminho', exact: true }).check();
  await expect(graph).toHaveAttribute('data-witness-edges', /^[1-9]\d*$/);
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(graph).toHaveAttribute('data-nodes', '3065');
  await page.getByRole('button', { name: /PARTIAL Cobertura publicada/ }).click();
  await expect(page.locator('.coverage-details')).toContainText('67 saídas defensivas');
  await page.getByRole('checkbox', { name: 'Mostrar saídas defensivas (67)', exact: true }).check();
  await expect(graph).toHaveAttribute('data-nodes', '3132');
  await expect(graph).toHaveAttribute('data-edges', '3827');
  await nav.getByRole('tab', { name: 'Trechos', exact: true }).click();
  await page.getByLabel('Buscar no programa').fill('Retorno sem PERFORM ativo');
  await expect(nav.locator('.nav-item')).toHaveCount(67);
  await page
    .getByRole('checkbox', { name: 'Mostrar saídas defensivas (67)', exact: true })
    .uncheck();
  await expect(graph).toHaveAttribute('data-nodes', '3065');
  await expect(nav.locator('.nav-item')).toHaveCount(0);
  await page.getByRole('button', { name: 'Limpar busca', exact: true }).click();
  await nav.getByRole('tab', { name: 'Chamadas', exact: true }).click();
  await page.getByRole('button', { name: /PARTIAL Cobertura publicada/ }).click();
  await page.screenshot({ path: 'test-results/shared-coactupc.png', fullPage: true });
  expect(errors).toEqual([]);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('defensive exits can be inspected explicitly; hiding and Back restore a coherent view', async ({
  page,
}) => {
  await page.goto('/?example=shared-values');
  const graph = page.getByTestId('graph'),
    nav = page.getByRole('complementary', { name: 'Navegação do programa' }),
    inspector = page.getByRole('complementary', { name: 'Inspetor' });
  await expect(graph).toHaveAttribute('aria-busy', 'false');
  await expect(graph).toHaveAttribute('data-nodes', '13');
  await expect(page.locator('.coverage-bar')).toContainText('1 saída defensiva oculta');
  await page.locator('.coverage-bar').click();
  const toggle = page.getByRole('checkbox', { name: 'Mostrar saídas defensivas (1)', exact: true });
  await toggle.check();
  await expect(graph).toHaveAttribute('data-nodes', '14');
  await nav.getByRole('tab', { name: 'Trechos', exact: true }).click();
  await page.getByLabel('Buscar no programa').fill('Retorno sem PERFORM ativo');
  await expect(nav.locator('.nav-item')).toHaveCount(1);
  await nav.locator('.nav-item').click();
  await expect(inspector).toContainText('SAÍDA DEFENSIVA');
  await expect(inspector).toContainText('Sem caminho conhecido nesta entrada');
  await inspector.getByRole('tab', { name: 'Internos', exact: true }).click();
  await inspector.getByText('Nó CFG', { exact: true }).click();
  await expect(inspector.locator('pre').first()).toContainText('invalid_local_return');
  await inspector.getByRole('tab', { name: 'Evidências', exact: true }).click();
  await inspector.getByRole('button', { name: 'Caminhos até aqui' }).click();
  await expect(page.locator('.path-banner')).toContainText('Sem caminho conhecido');
  await toggle.uncheck();
  await expect(graph).toHaveAttribute('data-nodes', '13');
  await expect(nav.locator('.nav-item')).toHaveCount(0);
  await expect(page.locator('.path-banner')).toHaveCount(0);
  await expect(inspector.getByRole('heading', { level: 2 })).toHaveText('Siga uma pergunta.');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(toggle).toBeChecked();
  await expect(page.locator('.path-banner')).toContainText('Sem caminho conhecido');
  await expect(inspector.getByRole('heading', { level: 2 })).toHaveText(
    'Retorno sem PERFORM ativo',
  );
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(graph).toHaveAttribute('data-nodes', '14');
  await expect(graph).toHaveAttribute('aria-busy', 'false');
  await page.screenshot({ path: 'test-results/defensive-inspection.png', fullPage: true });
});
