import { expect, type Page } from '@playwright/test';

export async function expectCamera(page: Page, serialized: string) {
  const expected = JSON.parse(serialized);
  // OrbitControls converts spherical coordinates back to Cartesian; allow floating point roundoff.
  await expect
    .poll(async () => {
      const actual = JSON.parse((await page.getByTestId('graph').getAttribute('data-camera'))!);
      return Math.max(
        ...['position', 'target', 'up'].flatMap((key) =>
          ['x', 'y', 'z'].map((axis) => Math.abs(actual[key][axis] - expected[key][axis])),
        ),
      );
    })
    .toBeLessThan(1e-7);
}

export async function visibleBoxPixels(page: Page) {
  const png = await page.locator('.graph3d-canvas canvas').screenshot();
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
    let light = 0,
      dark = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 210 && pixels[i + 1] > 210 && pixels[i + 2] > 210) light++;
      if (pixels[i] < 40 && pixels[i + 1] < 50 && pixels[i + 2] < 65) dark++;
    }
    return { light, dark, total: image.width * image.height };
  }, png.toString('base64'));
}
