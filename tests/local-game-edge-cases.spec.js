const { test, expect } = require('@playwright/test');
const { captureBrowserErrors } = require('./browser-error-capture');

async function expectNoBrowserErrors(page, errors) {
  await page.waitForTimeout(350);
  expect([...errors]).toEqual([]);
}

const mobileGames = [
  ['/flop-and-dope/', 'Flope & Dope', '#character-select-screen'],
  ['/10-military-mills/', '10 Military Mills', '#gameCanvas'],
  ['/spooky-time/', 'Spooky Time', '#game'],
  ['/build-to-survive-apocalypse/', 'Build to Survive Apocalypse', '#game'],
];

test.describe('local game edge cases', () => {
  test('Flope & Dope ignores repeated hero selection before a normal start', async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto('/flop-and-dope/');

    const start = page.locator('#start-game-btn');
    await expect(start).toBeDisabled();
    await page.locator('.character-card').first().click();
    await page.locator('.character-card').first().click();
    await expect(start).toBeEnabled();
    await start.click();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#gameplay-screen')).toHaveClass(/active/);
    await expectNoBrowserErrors(page, errors);
  });

  test('10 Military Mills accepts repeated title/hero clicks and keyboard movement', async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto('/10-military-mills/');

    const canvas = page.locator('#gameCanvas');
    await expect(canvas).toBeVisible();
    await page.keyboard.press('e');
    await canvas.click({ position: { x: 450, y: 300 } });
    await canvas.click({ position: { x: 90, y: 135 } });
    await page.keyboard.press('d');
    await page.keyboard.press('Space');
    await expectNoBrowserErrors(page, errors);
  });

  test('Spooky Time safely resets before and after its normal costume start', async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto('/spooky-time/');

    await page.locator('#again').click();
    await page.locator('[data-costume="witch"]').click();
    await page.locator('#startGame').click();
    await expect(page.locator('#costumes')).toBeHidden();
    await page.locator('#again').click();
    await page.keyboard.press('ArrowRight');
    await expectNoBrowserErrors(page, errors);
  });

  test('Build to Survive Apocalypse starts safely from repeated keyboard input', async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto('/build-to-survive-apocalypse/');

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#message')).toBeHidden();
    await page.keyboard.press('d');
    await expectNoBrowserErrors(page, errors);
  });
});

test.describe('local games on a small viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const [path, title, readySelector] of mobileGames) {
    test(`${title} loads its playable surface on mobile`, async ({ page }) => {
      const errors = captureBrowserErrors(page);
      const response = await page.goto(path);

      expect(response, `${title} did not return a response`).not.toBeNull();
      expect(response.ok(), `${title} returned HTTP ${response.status()}`).toBe(true);
      await expect(page.locator(readySelector)).toBeVisible();
      await expectNoBrowserErrors(page, errors);
    });
  }
});
