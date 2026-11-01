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
  }
});
