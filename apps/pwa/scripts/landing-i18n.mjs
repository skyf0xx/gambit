// Builds each translated landing page from the English one. index.html is
// the only source of the page's markup; src/landing/<locale>.json maps each
// piece of English text on it (a text node, or an alt / content / data-label
// / aria-label value, whitespace collapsed) to that language. The output
// goes to <locale>/index.html, committed so Vite serves and builds it like
// any other page. test/landing.test.ts fails when a page is out of date or
// a piece of English has no translation, so editing index.html means
// running `npm run landing -w @gambit/pwa` and filling in what it lists.
// The masthead's language switcher is generated too (langNav), on every
// page including index.html, from the languages that have a map.
//
//   node scripts/landing-i18n.mjs          write every <locale>/index.html
//   node scripts/landing-i18n.mjs --check  exit 1 if one is stale

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BR, ES, FR, GB, IT } from 'country-flag-icons/string/3x2';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** @type {string[]} */
export const LANDING_LOCALES = readdirSync(resolve(app, 'src/landing'))
  .map((f) => /^([a-z]{2})\.json$/.exec(f)?.[1])
  .filter((l) => l !== undefined);

/** Each language in its own words, and the switcher's label in it. */
const LANGUAGES = {
  en: ['English', 'Language'],
  fr: ['Français', 'Langue'],
  it: ['Italiano', 'Lingua'],
  es: ['Español', 'Idioma'],
  pt: ['Português', 'Idioma'],
};

// A small flag beside each language's name, from country-flag-icons,
// inlined when the page is built (emoji flags show as bare letters on
// Windows, and nothing loads from elsewhere at runtime). The flag only
// helps the eye; the name says the language, so Portuguese can sit under
// Brazil's flag and English under the UK's.
const FLAGS = { en: GB, fr: FR, it: IT, es: ES, pt: BR };
const NAV = /<nav class="lang-switch"[\s\S]*?<\/nav>/;

/** The masthead's language switcher on one page: every language, flag and
 * name, the page's own marked as current; English as /?lang=en so the
 * language redirect in vercel.json lets it be. */
export function langNav(locale) {
  const items = ['en', ...LANDING_LOCALES].map((l) => {
    const inner = `<span class="flag" aria-hidden="true">${FLAGS[l]}</span><span class="lang-name">${LANGUAGES[l][0]}</span>`;
    return l === locale
      ? `      <span class="lang-current" lang="${l}" aria-current="page" title="${LANGUAGES[l][0]}">${inner}</span>`
      : `      <a href="${l === 'en' ? '/?lang=en' : `/${l}/`}" hreflang="${l}" lang="${l}" title="${LANGUAGES[l][0]}">${inner}</a>`;
  });
  return `<nav class="lang-switch" aria-label="${LANGUAGES[locale][1]}">\n${items.join('\n')}\n    </nav>`;
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const ATTRS = /\b(alt|content|data-label|aria-label)="([^"]*)"/g;
// <meta content> values that are copy; the rest (image sizes, types) aren't.
const COPY_META = /<meta\s+(?:name|property)="(?:description|og:title|og:description|og:image:alt|twitter:title|twitter:description)"\s+content="/;

/** Every piece of English copy on the page, in order, deduplicated. */
export function pieces(html) {
  const out = new Set();
  const body = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(NAV, '');
  for (const m of body.matchAll(/>([^<]+)</g)) if (norm(m[1])) out.add(norm(m[1]));
  for (const tag of body.matchAll(/<[a-z][^>]*>/g)) {
    for (const [, name, value] of tag[0].matchAll(ATTRS)) {
      if (name === 'content' && !COPY_META.test(tag[0])) continue;
      if (norm(value)) out.add(norm(value));
    }
  }
  return [...out];
}

/**
 * The page in another language. Copy is swapped piece by piece; links into
 * the app carry the language (?lang=), so the app opens in it; the English
 * page is linked as /?lang=en, which the language rewrite in vercel.json
 * leaves alone. Throws on a piece with no translation.
 */
export function localize(html, locale, map) {
  const missing = pieces(html).filter((p) => !(p in map));
  if (missing.length) throw new Error(`landing ${locale}: no translation for\n${missing.map((m) => `  ${JSON.stringify(m)}`).join('\n')}`);
  const say = (s) => {
    const key = norm(s);
    if (!key) return s;
    const [lead] = s.match(/^\s*/);
    const [trail] = s.match(/\s*$/);
    return `${lead}${map[key]}${trail}`;
  };
  const nav = langNav(locale);
  const [head, ...rest] = html.replace(NAV, '<!--lang-nav-->').split(/(?=<script type="module")/);
  let out = head
    .replace(/>([^<]+)</g, (_, text) => `>${say(text)}<`)
    .replace(/<[a-z][^>]*>/g, (tag) => tag.replace(ATTRS, (all, name, value) =>
      name === 'content' && !COPY_META.test(tag) ? all : `${name}="${say(value)}"`));
  out = [out, ...rest].join('')
    .replace('<!--lang-nav-->', nav)
    .replace('<html lang="en">', `<html lang="${locale}">`)
    .replace(/href="\/app"/g, `href="/app?lang=${locale}"`)
    .replace(/src="\.\/src\//g, 'src="/src/')
    .replace(/<a class="wordmark" href="\/">/, `<a class="wordmark" href="/${locale}/">`);
  return out;
}

const target = (locale) => resolve(app, locale, 'index.html');
const build = (locale) => localize(readFileSync(resolve(app, 'index.html'), 'utf8'), locale, JSON.parse(readFileSync(resolve(app, `src/landing/${locale}.json`), 'utf8')));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  let stale = false;
  const source = resolve(app, 'index.html');
  const english = readFileSync(source, 'utf8');
  const withNav = english.replace(NAV, langNav('en'));
  if (withNav !== english) {
    if (check) { stale = true; console.error('index.html lists the wrong languages; run npm run landing -w @gambit/pwa'); }
    else { writeFileSync(source, withNav); console.log('updated the language switcher in index.html'); }
  }
  for (const locale of LANDING_LOCALES) {
    const page = build(locale);
    if (check) {
      let now = '';
      try { now = readFileSync(target(locale), 'utf8'); } catch { /* missing counts as stale */ }
      if (now !== page) { stale = true; console.error(`${locale}/index.html is out of date; run npm run landing -w @gambit/pwa`); }
    } else {
      mkdirSync(dirname(target(locale)), { recursive: true });
      writeFileSync(target(locale), page);
      console.log(`wrote ${locale}/index.html`);
    }
  }
  if (stale) process.exit(1);
}

export { build };
