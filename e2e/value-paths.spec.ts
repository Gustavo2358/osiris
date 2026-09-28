import { test, expect } from '@playwright/test';
import { expectCamera } from './graph-helpers';

test('illuminate candidate definitions, switch values, inspect source and clear without losing the graph', async ({
  page,
}) => {
  await page.goto('/?example=cics');
  const graph = page.getByTestId('graph');
  const inspector = page.getByRole('complementary', { name: 'Inspetor' });
  const banner = page.getByRole('region', { name: 'Caminhos dos valores possíveis' });
  await expect(graph).toHaveAttribute('aria-busy', 'false');
  const call = page.locator('.graph-node-target.is-selected');
  await expect(call).toBeVisible();
  const box = (await call.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); // actual WebGL picking
  const viewport = await graph.getAttribute('data-camera');
  const nodes = await graph.getAttribute('data-nodes');
  await inspector
    .getByRole('button', { name: 'Iluminar definições dos valores', exact: true })
    .click();
  await expect(banner).toBeVisible();
  await expect(graph).toHaveAttribute('data-value-producers', '2');
  await expect(graph).toHaveAttribute('data-value-edges', /^[1-9]\d*$/);
  await expect(graph).toHaveAttribute('data-nodes', nodes!);
  await expectCamera(page, viewport!);
  await page.getByLabel('Valor a destacar').selectOption({ label: 'SUMMARY' });
  await expect(graph).toHaveAttribute('data-value-producers', '1');
  await expectCamera(page, viewport!);
  await banner.getByText('Ver definições e limites do destaque').click();
  await expect(banner).toContainText('Definição publicada');
  await banner.getByRole('button', { name: /CICS-ROUTER.cbl:/ }).click();
  await expect(inspector.getByRole('heading', { level: 2 })).toContainText("MOVE 'SUMMARY'");
  await expect(page.getByRole('region', { name: 'Código fonte original' })).toBeVisible();
  await expect(banner).toBeVisible();
  await page.getByRole('button', { name: 'Enquadrar valores destacados' }).click();
  await page.screenshot({ path: 'test-results/value-paths.png' });
  await banner.getByRole('button', { name: 'Limpar destaque' }).click();
  await expect(banner).toHaveCount(0);
  await expect(graph).toHaveAttribute('data-value-highlight', 'off');
  await expect(graph).toHaveAttribute('data-nodes', nodes!);
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(banner).toBeVisible();
  await expect(page.getByLabel('Valor a destacar')).toHaveValue('1');
});

test('per-candidate action and Escape restore the previous scope; literals explain their origin', async ({
  page,
}) => {
  await page.goto('/?example=cics');
  const graph = page.getByTestId('graph');
  const inspector = page.getByRole('complementary', { name: 'Inspetor' });
  await expect(graph).toHaveAttribute('aria-busy', 'false');
  await inspector.getByRole('button', { name: 'Caminhos até aqui', exact: true }).click();
  await expect(graph).toHaveAttribute('aria-busy', 'false');
  const count = await graph.getAttribute('data-nodes');
  const camera = await graph.getAttribute('data-camera');
  await inspector
    .getByRole('button', { name: 'Iluminar definição de DETAIL', exact: true })
    .click();
  await expect(graph).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByLabel('Valor a destacar')).toHaveValue('0');
  await page.keyboard.press('Escape');
  await expect(graph).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.path-banner')).toBeVisible();
  await expect(graph).toHaveAttribute('data-value-highlight', 'off');
  await expect(graph).toHaveAttribute('data-nodes', count!);
  await expectCamera(page, camera!);
  await page.getByRole('button', { name: 'Programa inteiro', exact: true }).click();
  await page
    .getByRole('complementary', { name: 'Navegação do programa' })
    .getByRole('button', { name: /LINK PROGRAM\('AUDIT'\)/ })
    .click();
  await inspector.getByRole('button', { name: 'Iluminar definição de AUDIT', exact: true }).click();
  await expect(graph).toHaveAttribute('data-value-edges', '0');
  await page.getByText('Ver definições e limites do destaque').click();
  await expect(page.locator('.value-path-banner')).toContainText('Literal na própria chamada');
});

test('FILE values highlight their definitions, follow source, and clear with the same controls', async ({
  page,
}) => {
  await page.goto('/?example=files-values');
  const graph = page.getByTestId('graph');
  const inspector = page.getByRole('complementary', { name: 'Inspetor' });
  const banner = page.getByRole('region', { name: 'Caminhos dos valores possíveis' });
  await expect(graph).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('tab', { name: 'Arquivos', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await inspector
    .getByRole('button', { name: 'Iluminar definições dos valores', exact: true })
    .click();
  await expect(graph).toHaveAttribute('data-value-producers', '2');
  await expect(banner).toContainText('acesso ao arquivo');
  await expect(banner).not.toContainText('chamada');
  const edges = Number(await graph.getAttribute('data-value-edges'));
  expect(edges).toBeGreaterThan(0);
  await page.getByLabel('Valor a destacar').selectOption({ label: 'CUSTOMER' });
  await expect(graph).toHaveAttribute('data-value-producers', '1');
  await banner.getByText('Ver definições e limites do destaque').click();
  await banner.getByRole('button', { name: /computed-closed.cbl:/ }).click();
  await expect(inspector.getByRole('heading', { level: 2 })).toContainText("MOVE 'CUSTOMER'");
  await expect(page.getByRole('region', { name: 'Código fonte original' })).toBeVisible();
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Limpar destaque' }).click();
  await expect(graph).toHaveAttribute('data-value-highlight', 'off');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(graph).toHaveAttribute('data-value-producers', '1');
});

test('literal FILE names explain that there is no dynamic assignment to trace', async ({
  page,
}) => {
  await page.goto('/?example=files-native');
  const graph = page.getByTestId('graph');
  await expect(graph).toHaveAttribute('aria-busy', 'false');
  await page
    .getByRole('complementary', { name: 'Navegação do programa' })
    .getByRole('button', { name: /CLOSE.*CLIENTDD/ })
    .click();
  await page
    .getByRole('complementary', { name: 'Inspetor' })
    .getByRole('button', { name: 'Iluminar definição de CLIENTDD', exact: true })
    .click();
  await page.getByText('Ver definições e limites do destaque').click();
  await expect(page.locator('.value-path-banner')).toContainText('Nome literal do arquivo');
  await expect(graph).toHaveAttribute('data-value-edges', '0');
});

test('PROGA ends at its kill and the surviving branch remains visible; clear and back restore focus', async ({
  page,
}) => {
  await page.goto('/?example=goto');
  const graph = page.getByTestId('graph');
  const inspector = page.getByRole('complementary', { name: 'Inspetor' });
  const banner = page.getByRole('region', { name: 'Caminhos dos valores possíveis' });
  await expect(graph).toHaveAttribute('aria-busy', 'false');
  const camera = await graph.getAttribute('data-camera');
  await inspector.getByRole('button', { name: 'Iluminar definição de PROGA', exact: true }).click();
  await expect(graph).toHaveAttribute('data-value-kills', '1');
  await expect(graph).toHaveAttribute('data-value-edges', '4');
  await expect(graph).toHaveAttribute('data-value-killed-edges', '1');
  await expect(graph).toHaveAttribute('data-value-unknowns', '0');
  await expect(banner).toContainText('Sobrescritas verificadas pelo analisador');
  await expectCamera(page, camera!);
  await banner.getByText('Ver definições e limites do destaque').click();
  await banner.getByRole('button', { name: 'Ver sobrescrita' }).click();
  await expect(inspector.getByRole('heading', { level: 2 })).toContainText("MOVE 'PROGB'");
  await expect(page.getByRole('region', { name: 'Código fonte original' })).toBeVisible();
  await banner.getByText('Evidência do analisador').click();
  await expect(banner).toContainText('fb0e4051dc6c509849ea2c12755aff86');
  await page.screenshot({ path: 'test-results/proga-kill.png' });
  await page.getByLabel('Valor a destacar').selectOption({ label: 'OTHER' });
  await expect(graph).toHaveAttribute('data-value-kills', '0');
  await expect(graph).toHaveAttribute('data-value-edges', '2');
  await banner.getByRole('button', { name: 'Limpar destaque' }).click();
  await expect(graph).toHaveAttribute('data-value-highlight', 'off');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(banner).toBeVisible();
  await expect(page.getByLabel('Valor a destacar')).toHaveValue('0');
});

test('a FILE name uses the same kill controls and code navigation', async ({ page }) => {
  await page.goto('/?example=file-value-kill');
  const graph = page.getByTestId('graph');
  const inspector = page.getByRole('complementary', { name: 'Inspetor' });
  const banner = page.getByRole('region', { name: 'Caminhos dos valores possíveis' });
  await expect(graph).toHaveAttribute('aria-busy', 'false');
  await inspector
    .getByRole('button', { name: 'Iluminar definição de ACCOUNTS', exact: true })
    .click();
  await expect(graph).toHaveAttribute('data-value-kills', '1');
  await expect(banner).toContainText('acesso ao arquivo');
  await banner.getByText('Ver definições e limites do destaque').click();
  await banner.getByRole('button', { name: 'Ver sobrescrita' }).click();
  await expect(inspector.getByRole('heading', { level: 2 })).toContainText("MOVE 'CUSTOMER'");
  await page.getByLabel('Valor a destacar').selectOption({ label: 'CUSTOMER' });
  await expect(graph).toHaveAttribute('data-value-kills', '0');
  await expect(graph).toHaveAttribute('data-value-edges', /^[1-9]\d*$/);
});
