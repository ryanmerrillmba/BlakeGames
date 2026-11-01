(() => {
  'use strict';

  const measurementId = 'G-HERDRBQDXN';
  const productionHost = 'blakegames.pages.dev';
  const isProduction = location.hostname === productionHost;
  // A DSN is a public client identifier, not an auth token. Static Pages code
  // needs it at runtime to report browser faults without build-time secrets.
  const sentryDsn = 'https://42b1f53e8f6f353e4975b2207dd25944@o4512352222576640.ingest.us.sentry.io/4512352378028032';
  const pageName = document.documentElement.dataset.game || 'landing';
  const release = 'blakegames@' + (document.querySelector('meta[name="build-version"]')?.content || 'dev');
  let loaded = false;
  let analyticsLoaded = false;
  let sentryReady = false;
  const queue = [];

  function emit(name, data = {}) {
    const payload = { game: pageName, ...data };
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: name, ...payload });
    window.dispatchEvent(new CustomEvent('blakegames:telemetry', { detail: { name, payload } }));
    if (analyticsLoaded && typeof window.gtag === 'function') window.gtag('event', name, payload);
    if (sentryReady && window.Sentry) window.Sentry.addBreadcrumb({ category: 'game', message: name, data: payload, level: 'info' });
    else queue.push({ name, payload });
  }

  function script(src, onload, onerror) {
    const node = document.createElement('script');
    node.src = src;
    node.async = true;
    node.crossOrigin = 'anonymous';
    node.onload = onload;
    node.onerror = () => {
      console.warn(`Telemetry dependency unavailable: ${src}`);
      onerror?.();
    };
    document.head.appendChild(node);
  }

  function startAnalytics() {
    if (!isProduction || analyticsLoaded) return;
    const verificationRun = new URLSearchParams(location.search).has('analytics-test');
    analyticsLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      anonymize_ip: true
    });
    script(
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`,
      () => {
        // This event is deliberately sent only after gtag.js has loaded. It gives
        // a one-time, unambiguous check that the production tag can send data.
        if (verificationRun) emit('analytics_verification', { source: 'tag_loaded' });
      }
    );
    if (pageName !== 'landing') emit('game_start', { entry: 'page_load' });
  }

  function loadTelemetry() {
    if (loaded) return;
    loaded = true;
    script('https://browser.sentry-cdn.com/8.55.0/bundle.tracing.replay.min.js', () => {
      if (!window.Sentry) return;
      window.Sentry.init({
        dsn: sentryDsn,
        environment: location.hostname.endsWith('.pages.dev') ? 'development' : 'production',
        release,
        tracesSampleRate: 0,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        beforeSend(event) {
          event.tags = { ...event.tags, game: pageName };
          return event;
        }
      });
      sentryReady = true;
      queue.splice(0).forEach(({ name, payload }) => window.Sentry.addBreadcrumb({ category: 'game', message: name, data: payload, level: 'info' }));
      if (new URLSearchParams(location.search).has('sentry-test')) {
        window.Sentry.captureMessage('BlakeGames telemetry verification', { level: 'warning', tags: { verification: 'true', game: pageName } });
      }
    });
  }

  ['pointerdown', 'keydown', 'touchstart'].forEach((event) => window.addEventListener(event, loadTelemetry, { once: true, passive: event !== 'keydown' }));
  window.addEventListener('error', (event) => {
    emit('game_error', { message: event.message || 'Unknown error', source: event.filename || '' });
    if (sentryReady && window.Sentry) window.Sentry.captureException(event.error || new Error(event.message));
  });
  window.addEventListener('unhandledrejection', (event) => {
    emit('game_error', { message: String(event.reason || 'Unhandled rejection'), source: 'unhandledrejection' });
    if (sentryReady && window.Sentry) window.Sentry.captureException(event.reason);
  });

  startAnalytics();

  window.BlakeTelemetry = { activate: loadTelemetry, track: emit, config: { measurementId, sentryDsn, pageName, release, analyticsEnabled: isProduction } };
})();
