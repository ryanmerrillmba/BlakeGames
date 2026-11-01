const { test, expect } = require('@playwright/test');

const localGames = [
  ['/flop-and-dope/', 'Flope & Dope'],
  ['/10-military-mills/', '10 vs 10'],
  ['/nut-throw-catch/', 'Nut Throw Catch'],
  ['/spooky-time/', 'Spooky Time'],
  ['/build-to-survive-apocalypse/', 'Build to Survive'],
];

async function blockThirdParties(page) {
  await page.route(/googletagmanager|sentry-cdn|\.ingest\.us\.sentry\.io/, (route) => route.fulfill({ status: 204, body: '' }));
}

test('landing page exposes only the five real playable games and required homepage copy', async ({ page }) => {
  await blockThirdParties(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Available games' })).toBeVisible();
  await expect(page.getByText('Last updated October 31, 2026')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pick a game and start playing.' })).toBeVisible();
  await expect(page.getByText("Welcome to Blake's Arcade. Each game has its own world, characters, and challenges.")).toBeVisible();
  await expect(page.locator('.game-card')).toHaveCount(5);
  await expect(page.locator('.coming-soon')).toHaveCount(0);
  await expect(page.getByText(/Next game\s*loading/i)).toHaveCount(0);
  await expect(page.locator('.plus')).toHaveCount(0);
  await expect(page.locator('.game-card h3')).toHaveText([
    'Flope & Dope',
    '10 Military Mills',
    'Nut Throw Catch',
    'Spooky Time',
    'Build to Survive Apocalypse',
  ]);
  await expect(page.locator('a[href="flop-and-dope/index.html"]')).toBeVisible();
  await expect(page.locator('a[href="10-military-mills/index.html"]')).toBeVisible();
  await expect(page.locator('a[href="spooky-time/index.html"]')).toBeVisible();
  await expect(page.locator('a[href="build-to-survive-apocalypse/index.html"]')).toBeVisible();
  await expect(page.locator('a[href="nut-throw-catch/index.html"]')).toBeVisible();
});

for (const [path, title] of localGames) {
  test(`${title} loads without uncaught page errors`, async ({ page }) => {
    const failures = [];
    page.on('pageerror', (error) => failures.push(error.message));
    await blockThirdParties(page);
    await page.goto(path);
    await expect(page).toHaveTitle(new RegExp(title, 'i'));
    if (path === '/flop-and-dope/') {
      await expect(page.locator('#character-select-screen')).toHaveClass(/active/);
    } else if (path === '/nut-throw-catch/') {
      await expect(page.locator('#game')).toBeVisible();
      await expect(page.locator('#throw')).toBeEnabled();
      await expect(page.locator('#nutGuideBtn')).toBeVisible();
      await page.locator('#nutGuideBtn').click();
      await expect(page.locator('#nutGuide')).toBeVisible();
      await expect(page.getByText('Yellow', { exact: true })).toBeVisible();
      await expect(page.getByText('Blue', { exact: true })).toBeVisible();
    } else {
      await expect(page.locator('canvas').first()).toBeVisible();
    }
    await page.waitForTimeout(300);
    expect(failures).toEqual([]);
  });
}

test('Flop & Dope reaches gameplay after hero selection without missing-image draw errors', async ({ page }) => {
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await blockThirdParties(page);
  await page.goto('/flop-and-dope/');
  await page.locator('.character-card').first().click();
  await page.locator('#start-game-btn').click();
  await expect(page.locator('#gameplay-screen')).toHaveClass(/active/);
  await page.waitForTimeout(500);
  expect(failures).toEqual([]);
});

test('Flop & Dope shows the Nippin dungeon guide without retired characters', async ({ page }) => {
  await blockThirdParties(page);
  await page.goto('/flop-and-dope/');

  await expect(page.locator('.character-card')).toHaveCount(5);
  await expect(page.locator('.character-card h3')).not.toContainText('Electro');

  await page.locator('#tab-guide').click();
  await expect(page.locator('.guide-card h3')).toHaveText([
    'Booster (First Boss)',
    'Nippins',
    'Star-Shell Bug',
    'Nippin King (Second Boss)',
    'Spark Bobbies',
    'Madara (Boss)',
    'Blood Shark',
    'Dragon Wing',
    'Gray Pond',
    'Shark Fin Hazard',
    'Dungeon Emperor (Final Boss)',
  ]);
  await expect(page.getByText('Matera', { exact: true })).toHaveCount(0);
  await expect(page.locator('.guide-nippin-art')).toBeVisible();
  await expect(page.locator('.guide-nippin-king-art')).toBeVisible();
});

test('Flop & Dope starts the Booster dungeon level without browser errors', async ({ page }) => {
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await blockThirdParties(page);
  await page.goto('/flop-and-dope/');
  await page.locator('.character-card').first().click();
  await page.locator('.level-select-btn[data-level="3"]').click();
  await page.locator('#start-game-btn').click();
  await expect(page.locator('#gameplay-screen')).toHaveClass(/active/);
  await page.waitForTimeout(800);
  await page.locator('#hud-level-select').selectOption('6');
  await page.waitForTimeout(400);
  await page.locator('#hud-level-select').selectOption('12');
  await page.waitForTimeout(400);
  expect(failures).toEqual([]);
});

test('Nut Throw Catch drops the yellow and blue Bear nuts in their special levels', async ({ page }) => {
  await blockThirdParties(page);
  await page.goto('/nut-throw-catch/');
  await page.locator('#levelsBtn').click();
  await page.getByRole('button', { name: /Bear Level 2/ }).click();
  await expect.poll(() => page.locator('.nut.yellow').count(), { timeout: 5_000 }).toBeGreaterThan(0);
  await page.locator('#levelsBtn').click();
  await page.getByRole('button', { name: /Bear Level 3/ }).click();
  await expect.poll(() => page.locator('.nut.blue').count(), { timeout: 5_000 }).toBeGreaterThan(0);
});

test('Nut Throw Catch includes the locked Lion boss progression and appearance choice', async ({ page }) => {
  await blockThirdParties(page);
  await page.goto('/nut-throw-catch/');
  await expect(page.locator('#lion')).toBeAttached();
  await expect(page.locator('#lion .lion-arm')).toHaveCount(2);
  await expect(page.locator('#lion .lion-leg')).toHaveCount(2);
  await expect(page.locator('#lion .lion-tail')).toBeAttached();
  await expect(page.locator('#lion .lion-tail-tip')).toBeAttached();
  const lionFace = page.locator('#lion .lion-head');
  await expect(lionFace).toHaveCSS('background-color', 'rgb(211, 154, 85)');
  const greenCheek = await lionFace.evaluate((element) => getComputedStyle(element, '::before').backgroundColor);
  expect(greenCheek).toBe('rgb(145, 179, 107)');
  const levelManeColors = await page.evaluate(() => Array.from({ length: 9 }, (_, index) => {
    game.className = `lion-stage1 lion-sage lion-level${index + 1}`;
    return getComputedStyle(document.querySelector('#lion .lion-mane')).backgroundColor;
  }));
  expect(new Set(levelManeColors).size).toBe(9);
  await expect(page.locator('#lionChoice')).toBeAttached();
  await expect(page.locator('[data-lion-look]')).toHaveCount(3);
  await page.locator('#levelsBtn').click();
  await expect(page.getByText('Defeat the Bird to unlock the Lion.')).toBeVisible();
});

test('10 Military Mills progresses from title through a hero selection into gameplay', async ({ page }) => {
  await blockThirdParties(page);
  await page.goto('/10-military-mills/');
  const canvas = page.locator('#gameCanvas');
  await canvas.click({ position: { x: 450, y: 300 } });
  await canvas.click({ position: { x: 90, y: 135 } });
  await page.keyboard.press('d');
  await page.waitForTimeout(300);
  await expect(canvas).toBeVisible();
});

test('Spooky Time starts after costume selection', async ({ page }) => {
  await blockThirdParties(page);
  await page.goto('/spooky-time/');
  await page.locator('[data-costume="witch"]').click();
  await page.locator('#startGame').click();
  await expect(page.locator('#costumes')).toBeHidden();
});

test('Build to Survive starts from a user control', async ({ page }) => {
  await blockThirdParties(page);
  await page.goto('/build-to-survive-apocalypse/');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#message')).toBeHidden();
});

test('telemetry remains inactive before consent-like interaction and records game start after it', async ({ page }) => {
  await blockThirdParties(page);
  await page.goto('/spooky-time/');
  expect(await page.evaluate(() => window.BlakeTelemetry.config.measurementId)).toBe('G-HERDRBQDXN');
  expect(await page.evaluate(() => window.dataLayer)).toBeUndefined();
  const events = [];
  await page.evaluate(() => window.addEventListener('blakegames:telemetry', (event) => window.__testEvents = (window.__testEvents || []).concat(event.detail.name)));
  await page.locator('#startGame').click();
  events.push(...await page.evaluate(() => window.__testEvents));
  expect(events).toEqual(expect.arrayContaining(['game_start']));
});

test('telemetry initializes GA and Sentry with the configured DSN and captures a controlled event', async ({ page }) => {
  await page.route(/googletagmanager/, (route) => route.fulfill({ status: 204, body: '' }));
  await page.route(/sentry-cdn/, (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `window.__sentryCalls=[];window.Sentry={init:c=>window.__sentryInit=c,addBreadcrumb:c=>window.__sentryCalls.push(['breadcrumb',c]),captureMessage:(...c)=>window.__sentryCalls.push(['message',c]),captureException:(...c)=>window.__sentryCalls.push(['exception',c])};`,
  }));
  await page.goto('/?sentry-test');
  await page.locator('body').click({ position: { x: 10, y: 10 } });
  await expect.poll(() => page.evaluate(() => window.__sentryInit?.dsn)).toContain('ingest.us.sentry.io');
  expect(await page.evaluate(() => window.BlakeTelemetry.config.measurementId)).toBe('G-HERDRBQDXN');
  expect(await page.evaluate(() => window.__sentryInit.environment)).toBe('production');
  expect(await page.evaluate(() => window.__sentryCalls.some(([type]) => type === 'message'))).toBe(true);
});
