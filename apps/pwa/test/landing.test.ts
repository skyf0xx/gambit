import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build, LANDING_LOCALES, localize, pieces } from '../scripts/landing-i18n.mjs';

const app = resolve(__dirname, '..');
const english = readFileSync(resolve(app, 'index.html'), 'utf8');

describe('translated landing pages', () => {
  it('there is at least one', () => {
    expect(LANDING_LOCALES).toContain('fr');
  });

  for (const locale of LANDING_LOCALES) {
    describe(locale, () => {
      const map = JSON.parse(readFileSync(resolve(app, `src/landing/${locale}.json`), 'utf8')) as Record<string, string>;

      it('translates every piece of English copy on the page', () => {
        expect(pieces(english).filter((p) => !(p in map))).toEqual([]);
      });

      it('holds no translation for copy the page no longer has', () => {
        const now = new Set(pieces(english));
        expect(Object.keys(map).filter((k) => !now.has(k))).toEqual([]);
      });

      it(`${locale}/index.html is built from the current index.html (npm run landing -w @gambit/pwa)`, () => {
        expect(readFileSync(resolve(app, locale, 'index.html'), 'utf8')).toBe(build(locale));
      });

      it('opens the app in its language and links back to English', () => {
        const page = localize(english, locale, map);
        expect(page).toContain(`<html lang="${locale}">`);
        expect(page).not.toMatch(/href="\/app"/);
        expect(page).toContain(`href="/app?lang=${locale}"`);
        expect(page).toContain('href="/?lang=en"');
      });
    });
  }
});
