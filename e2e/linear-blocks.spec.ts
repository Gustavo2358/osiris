import { test, expect, type Page } from '@playwright/test';
import { expectCamera } from './graph-helpers';
const graph = (p: Page) => p.getByTestId('graph');
const toggle = (p: Page) => p.getByRole('button', { name: 'Agrupar trechos lineares pelo zoom' });
async function overview(p: Page, example = 'goto') {
  await p.goto('/?example=' + example);
  await expect(graph(p)).toHaveAttribute('aria-busy', 'false', {
    timeout: example === 'carddemo-coactupc' ? 60000 : 5000,
  });
  await p.getByRole('button', { name: 'Enquadrar recorte', exact: true }).click();
}

test('maximal blocks compact the diagram, retain branch choices, and open from a real WebGL click', async ({
  page,
}) => {
  await overview(page);
  await expect(graph(page)).toHaveAttribute('data-nodes', '10');
  await expect(graph(page)).toHaveAttribute('data-edges', '10');
  await expect(graph(page)).toHaveAttribute('data-collapsed-blocks', '3');
  await expect(graph(page)).toHaveAttribute('data-rendered-nodes', '4');
  await expect(page.locator('.graph-block-target')).toHaveCount(3);
  const compactHeight = Number(await graph(page).getAttribute('data-rendered-height'));
  expect(compactHeight).toBeLessThan(
    Number(await graph(page).getAttribute('data-full-height')) * 0.7,
  );
  // The original decision is readable on the block that ends in it; CALL is also grouped.
  await expect(page.locator('.graph-block-target').filter({ hasText: /IF FLAG/ })).toHaveCount(1);
  await expect(page.locator('.graph-block-target.is-selected')).toContainText('CALL WS-PGM');
  const distance = Number(await graph(page).getAttribute('data-distance'));
  await toggle(page).click();
  await expect(graph(page)).toHaveAttribute('data-rendered-nodes', '10');
  expect(Number(await graph(page).getAttribute('data-distance'))).toBeCloseTo(distance, 5);
  await toggle(page).click();
  await expect(graph(page)).toHaveAttribute('data-rendered-nodes', '4');
  expect(Number(await graph(page).getAttribute('data-rendered-height'))).toBe(compactHeight);
  const block = page.locator('.graph-block-target').filter({ hasText: /MOVE 'PROGB'/ });
  const ids: string[] = JSON.parse((await block.getAttribute('data-member-ids'))!);
  expect(ids).toHaveLength(3);
  const box = (await block.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(graph(page)).toHaveAttribute('data-collapsed-blocks', '0');
  await expect(graph(page)).toHaveAttribute('data-rendered-nodes', '10');
  await expect(
    page.locator('.graph-node-target').filter({ hasText: /MOVE 'PROGB'/ }),
  ).toBeInViewport();
  await expect(
    page.getByRole('complementary', { name: 'Inspetor' }).getByRole('heading', { level: 2 }),
  ).toContainText('CALL');
  // Zooming out again must compact automatically, without pressing Fit or toggling the feature.
  for (let i = 0; i < 5; i++)
    await page.getByRole('button', { name: 'Diminuir zoom', exact: true }).click();
  await expect(graph(page)).toHaveAttribute('data-collapsed-blocks', '3');
});

test('evidence exposes definitions and kills; Back restores the compact layout and its exact camera', async ({
  page,
}) => {
  await overview(page);
  const camera = (await graph(page).getAttribute('data-camera'))!;
  await page.getByRole('button', { name: 'Iluminar definição de PROGA', exact: true }).click();
  await page.getByRole('button', { name: 'Enquadrar recorte', exact: true }).click();
  await expect(graph(page)).toHaveAttribute('data-value-kills', '1');
  await expect(graph(page)).toHaveAttribute('data-collapsed-blocks', '0');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(graph(page)).toHaveAttribute('data-collapsed-blocks', '3');
  await expectCamera(page, camera);
  await page.getByRole('button', { name: 'Ler seleção de perto', exact: true }).click();
  await expect(page.locator('.graph-node-target.is-selected')).toBeInViewport();
  await expect
    .poll(
      async () => (await page.locator('.graph-node-target.is-selected').boundingBox())?.width ?? 0,
    )
    .toBeCloseTo(300, 0);
});

test('a complete sequential PERFORM program becomes one block and zoom restores all contexts', async ({
  page,
}) => {
  await overview(page, 'perform');
  await expect(graph(page)).toHaveAttribute('data-rendered-nodes', '1');
  const block = page.locator('.graph-block-target');
  expect(JSON.parse((await block.getAttribute('data-member-ids'))!)).toHaveLength(10);
  await block.press('Enter');
  await expect(graph(page)).toHaveAttribute('data-rendered-nodes', '10');
  await expect(graph(page)).toHaveAttribute('data-collapsed-blocks', '0');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('COACTUPC reduces actual layout height and cards while retaining every published node and edge', async ({
  page,
}) => {
  test.setTimeout(60000);
  await overview(page, 'carddemo-coactupc');
  await expect(graph(page)).toHaveAttribute('data-nodes', '5037');
  await expect(graph(page)).toHaveAttribute('data-edges', '6293');
  await expect(graph(page)).toHaveAttribute('data-rendered-nodes', '2324');
  await expect(graph(page)).toHaveAttribute('data-collapsed-blocks', '889');
  expect(Number(await graph(page).getAttribute('data-rendered-height'))).toBeLessThan(
    Number(await graph(page).getAttribute('data-full-height')),
  );
  await toggle(page).click();
  await expect(graph(page)).toHaveAttribute('data-rendered-nodes', '5037');
  await toggle(page).click();
  await expect(graph(page)).toHaveAttribute('data-rendered-nodes', '2324');
});
