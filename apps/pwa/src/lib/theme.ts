import { useSyncExternalStore } from 'react';

export type Theme = 'system' | 'light' | 'dark';

const KEY = 'gambit:theme';
const COLORS = { light: '#F8F5EE', dark: '#1D1B18' } as const;

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

/** Put the choice on <html> (styles.css keys off `data-theme`), and point the
 * browser bar at the same colour. Under "system" both are left to the media
 * queries. */
export function applyTheme(t: Theme = getTheme()) {
  const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  const head = document.head;
  let meta = head.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-override]');
  if (t === 'system') { meta?.remove(); return; }
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.dataset.override = '';
    head.prepend(meta);
  }
  meta.content = COLORS[t];
}

const listeners = new Set<() => void>();

export function setTheme(t: Theme) {
  try { if (t === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { /* the choice lasts until reload */ }
  applyTheme(t);
  listeners.forEach((l) => l());
  // The marks layer draws in resolved colours, so it redraws on this.
  window.dispatchEvent(new Event('gambit:theme'));
}

export function useTheme(): Theme {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, getTheme, () => 'system' as Theme);
}
