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

module.exports = { captureBrowserErrors, isKnownThirdPartyTelemetry };
