// The page's language. Read from the browser's own language list on first
// open (no network call, nothing leaves the device), and changed for good
// from Settings. Changing it reloads the app, so every t() call reads the
// new language without a provider threaded through the tree.
//
// Copy lives in src/locales/<locale>/<namespace>.json, one flat object per
// namespace: "chat.json" holds the chat.* keys. English is the
// source; any key missing from another language falls back to it.
// test/i18n.test.ts checks that every language has every English key with
// the same {placeholders}, and that every t("…") in src names a real key.
//
// A value is a string, or a plural object picked by Intl.PluralRules:
//   "left": { "one": "{count} day left", "other": "{count} days left" }

export type Locale = 'en' | 'fr' | 'it' | 'es' | 'pt';

/** Each language named in its own words, as the picker shows it. */
export const LOCALES: Record<Locale, string> = { en: 'English', fr: 'Français', it: 'Italiano', es: 'Español', pt: 'Português' };

const STORAGE_KEY = 'gambit:locale';

type Message = string | Partial<Record<Intl.LDMLPluralRule, string>>;
type Catalog = Record<string, Message>;

const files = import.meta.glob('../locales/*/*.json', { eager: true, import: 'default' }) as Record<string, Record<string, Message>>;

/** Every catalog, as { locale: { "namespace.key": message } }. */
export const catalogs: Record<string, Catalog> = {};
for (const [path, messages] of Object.entries(files)) {
  const m = /locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
  if (!m) continue;
  const [, loc, ns] = m;
  catalogs[loc] ??= {};
  for (const [k, v] of Object.entries(messages)) catalogs[loc][`${ns}.${k}`] = v;
}

const isLocale = (l: unknown): l is Locale => typeof l === 'string' && l in LOCALES;

/** The first supported language in the browser's list, else English. */
export function detectLocale(langs: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]): Locale {
  for (const l of langs) {
    const base = l.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return 'en';
}

/** A landing page in one language opens the app in it (/app?lang=fr), and
 * that choice is kept like one made in Settings. */
function initial(): Locale {
  try {
    const asked = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('lang');
    if (isLocale(asked)) {
      try { localStorage.setItem(STORAGE_KEY, asked); } catch { /* this visit only */ }
      // Taken once: left in the URL, it would undo a later pick in Settings on reload.
      const url = new URL(location.href);
      url.searchParams.delete('lang');
      history.replaceState(history.state, '', url);
      return asked;
    }
  } catch { /* no usable URL: go by storage and the browser */ }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch { /* storage blocked: go by the browser */ }
  return detectLocale();
}

let current: Locale = initial();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export const locale = (): Locale => current;

/** Switch language for good, in this browser, and reload into it. */
export function setLocale(l: Locale) {
  try { localStorage.setItem(STORAGE_KEY, l); } catch { /* this session only */ }
  current = l;
  if (typeof location !== 'undefined') location.reload();
}

/** For tests: read in another language without storage or a reload. */
export function setLocaleForTest(l: Locale) {
  current = l;
}

export type Params = Record<string, string | number>;

const fill = (s: string, params?: Params) =>
  params ? s.replace(/\{(\w+)\}/g, (all, k: string) => (k in params ? String(params[k]) : all)) : s;

function pick(msg: Message, params?: Params): string {
  if (typeof msg === 'string') return msg;
  const n = Number(params?.count ?? 0);
  return msg[new Intl.PluralRules(current).select(n)] ?? msg.other ?? '';
}

/** The text for a key in the page's language, with {placeholders} filled. */
export function t(key: string, params?: Params): string {
  const msg = catalogs[current]?.[key] ?? catalogs.en?.[key];
  if (msg === undefined) return key;
  return fill(pick(msg, params), params);
}

/** Whether a key exists in English, the source catalog. */
export const hasKey = (key: string) => key in (catalogs.en ?? {});

/** BCP 47 tag for Intl date and number formatting: en-GB keeps
 * day-before-month, and Portuguese copy is written for Brazil. */
export const intlLocale = () => ({ en: 'en-GB', pt: 'pt-BR' } as Partial<Record<Locale, string>>)[current] ?? current;
