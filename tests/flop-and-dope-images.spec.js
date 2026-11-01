const { test, expect } = require('@playwright/test');

test('Flop and Dope renders complete artwork at a readable size', async ({ page }) => {
  await page.goto('/flop-and-dope/index.html', { waitUntil: 'networkidle' });

  const reportVisibleImages = async (selector) => page.locator(selector).evaluateAll((images) => images.map((image) => {
    const box = image.getBoundingClientRect();
    return {
      alt: image.alt,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      renderedWidth: box.width,
      renderedHeight: box.height,
      complete: image.complete,
      lowerVisiblePixels: (() => {
        if (!image.naturalWidth || !image.naturalHeight) return 0;
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, Math.floor(canvas.height * 0.55), canvas.width, Math.ceil(canvas.height * 0.45)).data;
        let visible = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          const alpha = pixels[index + 3];
          const colorTotal = pixels[index] + pixels[index + 1] + pixels[index + 2];
          if (alpha > 20 && (alpha < 245 || colorTotal < 735)) visible += 1;
        }
        return visible;
      })(),
    };
  }));

  const heroReport = await reportVisibleImages('.hero-card-img');
  await page.locator('#tab-guide').click();
  const guideReport = await reportVisibleImages('.guide-img');
  const imageReport = [...heroReport, ...guideReport];

  expect(imageReport.length).toBeGreaterThanOrEqual(12);
  for (const image of imageReport) {
    expect(image.complete, `${image.alt} did not finish loading`).toBe(true);
    expect(image.naturalWidth, `${image.alt} is missing or low-resolution`).toBeGreaterThanOrEqual(512);
    expect(image.naturalHeight, `${image.alt} is missing or low-resolution`).toBeGreaterThanOrEqual(512);
    expect(image.renderedWidth, `${image.alt} is rendered too narrowly`).toBeGreaterThanOrEqual(100);
    expect(image.renderedHeight, `${image.alt} is rendered too short`).toBeGreaterThanOrEqual(100);
    expect(image.lowerVisiblePixels, `${image.alt} contains only the upper part of the artwork`).toBeGreaterThan(50);
  }
});
