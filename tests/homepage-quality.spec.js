const { test, expect } = require('@playwright/test');

const localInteractions = {
  '/flop-and-dope/index.html': async (page) => {
    await page.locator('.character-card').first().click();
    const startButton = page.locator('#start-game-btn');
    await expect(startButton).toBeEnabled();
    await startButton.click();
    await expect(page.locator('#gameplay-screen')).toHaveClass(/active/);
  },
  '/10-military-mills/index.html': async (page) => {
    const canvas = page.locator('#gameCanvas');
    await expect(canvas).toBeVisible();
    await canvas.click({ position: { x: 450, y: 300 } });
    await canvas.click({ position: { x: 90, y: 135 } });
    await page.keyboard.press('d');
  },
  '/spooky-time/index.html': async (page) => {
    await page.locator('[data-costume="witch"]').click();
    await page.locator('#startGame').click();
    await expect(page.locator('#costumes')).toBeHidden();
  },
  '/build-to-survive-apocalypse/index.html': async (page) => {
    await expect(page.locator('#game')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#message')).toBeHidden();
  },
};

const knownTelemetryHosts = new Set([
  'www.googletagmanager.com',
  'www.google-analytics.com',
  'region1.google-analytics.com',
  'browser.sentry-cdn.com',
]);

function isKnownThirdPartyTelemetry(url) {
  try {
    const { hostname } = new URL(url);
    return knownTelemetryHosts.has(hostname) || hostname.endsWith('.ingest.us.sentry.io');
  } catch {
    return false;
  }
}

function isResourceLoadError(message) {
  return message.text().startsWith('Failed to load resource:');
}

function captureBrowserErrors(page) {
  const errors = new Set();
  page.on('pageerror', (error) => errors.add(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;

    const location = message.location();
    if (isResourceLoadError(message) && isKnownThirdPartyTelemetry(location.url)) return;
    errors.add(`console.error: ${message.text()} (${location.url || 'unknown source'})`);
  });
  page.on('response', (response) => {
    if (!response.ok() && !isKnownThirdPartyTelemetry(response.url())) {
      errors.add(`resource returned HTTP ${response.status()}: ${response.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (!isKnownThirdPartyTelemetry(request.url())) {
      errors.add(`resource request failed: ${request.url()} (${request.failure()?.errorText || 'unknown error'})`);
    }
  });
  return errors;
}

test('every homepage Play link is publicly reachable and each local game starts without browser errors', async ({ page, request }) => {
  test.setTimeout(60_000);
  const failures = [];
  const homepageErrors = captureBrowserErrors(page);
  const homepageResponse = await page.goto('/');
  expect(homepageResponse, 'homepage did not return a response').not.toBeNull();
  expect(homepageResponse.ok(), `homepage returned HTTP ${homepageResponse.status()}`).toBe(true);

  const cards = await page.locator('.game-card').evaluateAll((gameCards) => gameCards.map((card) => {
    const link = card.querySelector('a.play-button');
    return {
      title: card.querySelector('h3')?.textContent?.trim(),
      href: link?.href,
    };
  }));

  expect(cards, 'every homepage game card needs one Play link').toHaveLength(await page.locator('.game-card').count());
  expect(cards).not.toHaveLength(0);
  expect(cards.every((card) => card.title && card.href), 'every Play link needs a game title and destination').toBe(true);
  expect([...homepageErrors], 'homepage emitted browser errors').toEqual([]);

  for (const card of cards) {
    const destination = new URL(card.href);
    const isLocal = destination.origin === new URL(page.url()).origin;

    if (!isLocal) {
      const response = await request.get(destination.href, {
        failOnStatusCode: false,
        maxRedirects: 5,
      });
      if (!response.ok()) {
        failures.push(`${card.title} Play link must be publicly reachable without authentication; ${response.url()} returned HTTP ${response.status()}`);
      }
      continue;
    }

    const browserErrors = captureBrowserErrors(page);
    let response;
    try {
      response = await page.goto(destination.href, { waitUntil: 'domcontentloaded' });
    } catch (error) {
      failures.push(`${card.title} could not be opened: ${error.message}`);
      continue;
    }
    if (!response || !response.ok()) {
      failures.push(`${card.title} returned ${response ? `HTTP ${response.status()}` : 'no response'}`);
      continue;
    }

    const interaction = localInteractions[destination.pathname];
    if (!interaction) {
      failures.push(`${card.title} has no quality-gate interaction`);
      continue;
    }

    try {
      await interaction(page);
    } catch (error) {
      failures.push(`${card.title} did not start/respond to its minimal interaction: ${error.message}`);
    }
    await page.waitForTimeout(300);
    failures.push(...[...browserErrors].map((error) => `${card.title} emitted ${error}`));
  }

  expect(failures).toEqual([]);
});
