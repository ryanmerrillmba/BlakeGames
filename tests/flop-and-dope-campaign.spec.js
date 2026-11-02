const { test, expect } = require('@playwright/test');

async function blockThirdParties(page) {
  await page.route(/googletagmanager|sentry-cdn|\.ingest\.us\.sentry\.io/, (route) => route.fulfill({ status: 204, body: '' }));
}

test('Flop & Dope exposes the complete Nippin campaign and optional bosses', async ({ page }) => {
  await blockThirdParties(page);
  await page.goto('/flop-and-dope/');

  await expect(page.locator('.level-select-btn')).toHaveCount(34);
  await expect(page.locator('.level-select-btn')).toHaveText([
    'Level 1', 'Level 2', 'Level 3: Nippin King 👑', 'Level 4', 'Level 5',
    'Level 6: Poster 👹', 'Level 7', 'Level 8', 'Level 9: Blood Shark 🦈',
    'Level 10', 'Level 11', 'Level 12: Dragon 🐉', 'Level 13', 'Level 14',
    'Level 15: Ladybug 🐞', 'Level 16', 'Level 17', 'Level 18: Mada 🟣',
    'Level 19', 'Level 20', 'Level 21', 'Level 22', 'Level 23', 'Level 24',
    'Level 25', 'Level 26', 'Level 27', 'Level 28: Shine the Shine ✨',
    'Level 29', 'Level 30', 'Level 31: Galler Lord 🌌', 'Level 32', 'Level 33',
    'Level 34: Final Boss 👑',
  ]);

  await page.locator('#tab-guide').click();
  await expect(page.locator('.guide-card')).toHaveCount(13);
  await expect(page.locator('.guide-card h3')).toHaveText([
    'Nippin King (First Boss)', 'Nippins', 'Poster (Second Boss)', 'Shine the Shine',
    'Secret Boss', 'Galler Lord (Boss)', 'Mada (Boss)', 'Blood Shark', 'Dragon Wing',
    'Ladybug (Boss)', 'Gray Pond', 'Shark Fin Hazard', 'Dungeon Emperor (Final Boss)',
  ]);
  await expect(page.locator('.guide-shine-placeholder')).toBeVisible();
  await expect(page.locator('.guide-secret-placeholder')).toBeVisible();
});

test('Flop & Dope can enter every new boss stage without browser errors', async ({ page }) => {
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await blockThirdParties(page);
  await page.goto('/flop-and-dope/');
  await page.locator('.character-card').first().click();
  await page.locator('.level-select-btn[data-level="3"]').click();
  await page.locator('#start-game-btn').click();
  await expect(page.locator('#gameplay-screen')).toHaveClass(/active/);

  for (const level of ['3', '6', '9', '12', '15', '18', '28', '31', '34']) {
    await page.locator('#hud-level-select').selectOption(level);
    await expect(page.locator('#hud-level-select')).toHaveValue(level);
    await page.waitForTimeout(180);
  }

  expect(failures).toEqual([]);
});
