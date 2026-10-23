import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FREE_SETTINGS, takeFreeKeyReturn } from '../src/lib/freekey';
import { OPENROUTER_BASE, OPENROUTER_FREE_MODEL } from '../src/lib/providers';

// Node has no page: a URL, history that rewrites it, and session storage.
function page(url: string, pending?: { verifier: string; state: string }) {
  const store = new Map<string, string>();
  if (pending) store.set('gambit:freekey', JSON.stringify(pending));
  const loc = new URL(url);
  vi.stubGlobal('location', loc);
  vi.stubGlobal('history', { state: null, replaceState: (_: unknown, __: string, next: string) => { loc.href = new URL(next, loc).href; } });
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
  return { loc, store };
}

describe('takeFreeKeyReturn', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('hands over the code when the state matches, and cleans the URL', () => {
    const { loc, store } = page('https://gambit.test/app?code=abc&state=s1&lang=fr', { verifier: 'v1', state: 's1' });
    expect(takeFreeKeyReturn()).toEqual({ kind: 'code', code: 'abc', verifier: 'v1' });
    expect(loc.href).toBe('https://gambit.test/app?lang=fr');
    expect(store.size).toBe(0);
  });

  it('reads a return without a code as cancelled', () => {
    page('https://gambit.test/app', { verifier: 'v1', state: 's1' });
    expect(takeFreeKeyReturn()).toEqual({ kind: 'cancelled' });
  });

  it('refuses a code carrying another state', () => {
    const { loc } = page('https://gambit.test/app?code=abc&state=other', { verifier: 'v1', state: 's1' });
    expect(takeFreeKeyReturn()).toEqual({ kind: 'cancelled' });
    expect(loc.search).toBe('');
  });

  it('ignores a page load with no sign-in started', () => {
    page('https://gambit.test/app');
    expect(takeFreeKeyReturn()).toBeNull();
  });
});

describe('FREE_SETTINGS', () => {
  it('saves like a pasted OpenRouter key, on the free model', () => {
    expect(FREE_SETTINGS).toEqual({ kind: 'custom', baseURL: OPENROUTER_BASE, model: OPENROUTER_FREE_MODEL });
    expect(OPENROUTER_FREE_MODEL).toMatch(/:free$/);
  });
});

describe('dailyLimit', () => {
  it("tells OpenRouter's daily cap from a per-minute one", async () => {
    const { dailyLimit, errorText } = await import('../src/lib/agent');
    vi.stubGlobal('navigator', { onLine: true });
    const day = { statusCode: 429, message: 'Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day' };
    const minute = { statusCode: 429, message: 'Rate limit exceeded: free-models-per-min.' };
    expect(dailyLimit(day)).toBe(true);
    expect(dailyLimit({ lastError: day })).toBe(true);
    expect(dailyLimit(minute)).toBe(false);
    expect(errorText(day, 'custom')).toMatch(/^Daily limit reached/);
    expect(errorText(minute, 'custom')).toMatch(/^Too many requests/);
    vi.unstubAllGlobals();
  });
});
