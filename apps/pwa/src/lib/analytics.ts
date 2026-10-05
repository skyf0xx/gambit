// Anonymous usage counts, sent to Umami Cloud. No third-party script runs
// in the page: the API key decrypts in this page, so only our own code may.
// This module posts Umami's event payload itself to /u/api/send, which
// vercel.json rewrites to Umami, so the CSP stays 'self'.
//
// What goes out: the page path (no query or hash), screen size, language,
// referrer, an event name and a few fixed-vocabulary properties (a provider
// kind, a skill name, a status word). Never goal text, chat text, names or
// the key. Umami sets no cookie and keeps no visitor id across days.
//
// Off unless the build carries a website id (Vercel builds; see
// vite.config.ts), off under Do Not Track, and off when localStorage holds
// `umami.disabled`.

const website = typeof __UMAMI_WEBSITE_ID__ === 'string' ? __UMAMI_WEBSITE_ID__ : '';
const ENDPOINT = '/u/api/send';

export type EventData = Record<string, string | number | boolean>;

function enabled(): boolean {
  if (!website || typeof window === 'undefined') return false;
  if (navigator.doNotTrack === '1') return false;
  try {
    if (localStorage.getItem('umami.disabled')) return false;
  } catch {
    // Storage blocked: counting still works without it.
  }
  return true;
}

function send(name?: string, data?: EventData) {
  if (!enabled()) return;
  const payload = {
    website,
    hostname: location.hostname,
    url: location.pathname,
    title: 'Gambit',
    referrer: document.referrer,
    language: navigator.language,
    screen: `${screen.width}x${screen.height}`,
    ...(name ? { name } : {}),
    ...(data ? { data } : {}),
  };
  try {
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'event', payload }),
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {});
  } catch {
    // Counting never gets in the way of the app.
  }
}

/** Count a page view of the current path. */
export function trackView() {
  send();
}

/** Count a named event. Properties are fixed words, never user content. */
export function track(name: string, data?: EventData) {
  send(name, data);
}
