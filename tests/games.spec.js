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
  expect(events).toEqual(expect.arrayContaining(['page_view', 'game_start']));
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
