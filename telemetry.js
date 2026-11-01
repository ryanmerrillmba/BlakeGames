(() => {
  'use strict';

  const measurementId = 'G-HERDRBQDXN';
  const productionHost = 'blakegames.pages.dev';
  const isProduction = location.hostname === productionHost;
  const consentKey = 'blakegames-analytics-consent';
  // A DSN is a public client identifier, not an auth token. Static Pages code
  // needs it at runtime to report browser faults without build-time secrets.
  const sentryDsn = 'https://42b1f53e8f6f353e4975b2207dd25944@o4512352222576640.ingest.us.sentry.io/4512352378028032';
  const pageName = document.documentElement.dataset.game || 'landing';
  const release = 'blakegames@' + (document.querySelector('meta[name="build-version"]')?.content || 'dev');
  let loaded = false;
  let analyticsLoaded = false;
  let sentryReady = false;
  const queue = [];

  function consent() {
    try { return localStorage.getItem(consentKey); } catch { return null; }
  }

  function saveConsent(value) {
    try { localStorage.setItem(consentKey, value); } catch {}
  }

  function emit(name, data = {}) {
    const payload = { game: pageName, ...data };
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: name, ...payload });
    window.dispatchEvent(new CustomEvent('blakegames:telemetry', { detail: { name, payload } }));
    if (analyticsLoaded && typeof window.gtag === 'function') window.gtag('event', name, payload);
    if (sentryReady && window.Sentry) window.Sentry.addBreadcrumb({ category: 'game', message: name, data: payload, level: 'info' });
    else queue.push({ name, payload });
  }

  function script(src, onload) {
    const node = document.createElement('script');
    node.src = src;
    node.async = true;
    node.crossOrigin = 'anonymous';
    node.onload = onload;
    node.onerror = () => console.warn(`Telemetry dependency unavailable: ${src}`);
    document.head.appendChild(node);
  }

  function startAnalytics() {
    if (!isProduction || analyticsLoaded || consent() !== 'granted') return;
    analyticsLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied' });
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('config', measurementId, { send_page_view: false, anonymize_ip: true, transport_type: 'beacon' });
    script(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`);
    emit('page_view', { page_title: document.title, page_location: location.href });
    if (pageName !== 'landing') emit('game_start', { entry: 'first_interaction' });
  }

  function showConsentPrompt() {
    if (!isProduction || consent() || document.querySelector('#blake-analytics-consent')) return;
    const style = document.createElement('style');
    style.textContent = '#blake-analytics-consent{position:fixed;z-index:2147483647;right:16px;bottom:16px;max-width:370px;padding:18px;border:2px solid #172847;border-radius:16px;background:#fffdf8;color:#172847;font:600 14px/1.4 system-ui,sans-serif;box-shadow:6px 7px 0 rgba(23,40,71,.22)}#blake-analytics-consent p{margin:0 0 13px}#blake-analytics-consent strong{display:block;margin-bottom:5px;font-size:16px}#blake-analytics-consent div{display:flex;gap:9px;flex-wrap:wrap}#blake-analytics-consent button{appearance:none;border:1px solid #172847;border-radius:8px;padding:8px 11px;background:#fff;font:inherit;font-weight:800;cursor:pointer}#blake-analytics-consent [data-consent="granted"]{background:#ffc84b}';
    document.head.appendChild(style);

    const banner = document.createElement('section');
    banner.id = 'blake-analytics-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Analytics preference');
    banner.innerHTML = '<strong>Help improve Blake Games?</strong><p>Allow anonymous usage analytics so we can see which games people enjoy.</p><div><button type="button" data-consent="granted">Allow analytics</button><button type="button" data-consent="denied">No thanks</button></div>';
    banner.addEventListener('click', (event) => {
      const choice = event.target?.dataset?.consent;
      if (!choice) return;
      saveConsent(choice);
      banner.remove();
      style.remove();
      if (choice === 'granted') startAnalytics();
    });
    (document.body || document.documentElement).appendChild(banner);
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

  if (consent() === 'granted') startAnalytics();
  else if (!consent()) showConsentPrompt();

  window.BlakeTelemetry = { activate: loadTelemetry, track: emit, config: { measurementId, sentryDsn, pageName, release, analyticsEnabled: isProduction && consent() === 'granted' } };
})();
