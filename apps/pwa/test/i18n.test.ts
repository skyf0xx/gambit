import { describe, expect, it, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { catalogs, detectLocale, LOCALES, setLocaleForTest, t } from '../src/lib/i18n';

const src = resolve(__dirname, '../src');
const core = resolve(__dirname, '../../../packages/core/src');

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });

const placeholders = (msg: unknown): string[] => {
  const texts = typeof msg === 'string' ? [msg] : Object.values(msg as Record<string, string>);
  return [...new Set(texts.flatMap((s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].sort();
};

const en = catalogs.en;

describe('catalogs', () => {
  it('English has keys', () => {
    expect(Object.keys(en).length).toBeGreaterThan(0);
  });

  for (const loc of Object.keys(LOCALES).filter((l) => l !== 'en')) {
    describe(loc, () => {
      const cat = catalogs[loc] ?? {};

      it('has every English key', () => {
        expect(Object.keys(en).filter((k) => !(k in cat))).toEqual([]);
      });

      it('has no key English lacks', () => {
        expect(Object.keys(cat).filter((k) => !(k in en))).toEqual([]);
      });

      it('fills the same {placeholders} as English', () => {
        const off = Object.keys(en).filter((k) => k in cat && placeholders(en[k]).join() !== placeholders(cat[k]).join());
        expect(off).toEqual([]);
      });

      it('gives a plural wherever English has one, with an "other" form', () => {
        const off = Object.keys(en).filter((k) => typeof en[k] !== 'string' && k in cat && (typeof cat[k] === 'string' || !(cat[k] as Record<string, string>).other));
        expect(off).toEqual([]);
      });
    });
  }
});

describe('every key the code names exists', () => {
  it("t('…') in src", () => {
    const missing: string[] = [];
    for (const f of files(src)) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(/\bt\(\s*'([^'$]+)'/g)) if (!(m[1] in en)) missing.push(`${f.slice(src.length + 1)}: ${m[1]}`);
    }
    expect(missing).toEqual([]);
  });

  it("each due item core can suggest (flow.mjs say ids)", () => {
    const flow = readFileSync(join(core, 'flow.mjs'), 'utf8');
    const ids = [...flow.matchAll(/say: \{ id: '(\w+)'/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(20);
    expect(ids.filter((id) => !(`due.${id}` in en))).toEqual([]);
  });
});

describe('t', () => {
  afterEach(() => setLocaleForTest('en'));

  it('fills placeholders and picks plurals', () => {
    expect(t('due.scoreForecasts', { count: 1 })).toBe('Score a forecast');
    expect(t('due.scoreForecasts', { count: 3 })).toBe('Score 3 forecasts');
    expect(t('due.escalate', { name: 'Ana' })).toBe('Take it to Ana');
  });

  it('falls back to English, then to the key', () => {
    setLocaleForTest('fr');
    expect(t('no.such.key')).toBe('no.such.key');
  });
});

describe('detectLocale', () => {
  it('takes the first supported language in the browser list', () => {
    expect(detectLocale(['fr-CA', 'en-US'])).toBe('fr');
    expect(detectLocale(['de-DE', 'fr'])).toBe('fr');
    expect(detectLocale(['en-GB', 'fr-FR'])).toBe('en');
  });

  it('falls back to English', () => {
    expect(detectLocale(['de', 'ja'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });
});
