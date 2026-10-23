import { OPENROUTER_BASE, OPENROUTER_FREE_MODEL, settingsForKey, type ProviderSettings } from './providers';

// A free key without copying one: OpenRouter's PKCE sign-in
// (openrouter.ai/docs/guides/overview/auth/oauth). The page leaves for
// openrouter.ai/auth and comes back to itself with ?code, which is traded
// for a key. The verifier waits in sessionStorage across the trip.

const PENDING = 'gambit:freekey';
const AUTH_URL = 'https://openrouter.ai/auth';

/** The settings a free key saves under: OpenRouter, on a free model. */
export const FREE_SETTINGS: ProviderSettings = { ...settingsForKey('openrouter'), model: OPENROUTER_FREE_MODEL };

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = () => b64url(crypto.getRandomValues(new Uint8Array(32)));

/** This page, without its query or hash: where OpenRouter sends them back. */
const here = () => location.origin + location.pathname;

/** Leave for OpenRouter's sign-in. */
export async function startFreeKey(): Promise<void> {
  const verifier = random();
  const state = random();
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  sessionStorage.setItem(PENDING, JSON.stringify({ verifier, state }));
  const q = new URLSearchParams({ callback_url: here(), code_challenge: challenge, code_challenge_method: 'S256', state, key_label: 'Gambit' });
  location.assign(`${AUTH_URL}?${q}`);
}

export type FreeKeyReturn = { kind: 'code'; code: string; verifier: string } | { kind: 'cancelled' } | null;

/** Whether this page load is the way back from OpenRouter, read without side effects. */
export function freeKeyPending(): boolean {
  try { return !!sessionStorage.getItem(PENDING); } catch { return false; }
}

/** Take the result of a sign-in: the code to trade, `cancelled` when they
 * came back without one (a denial, or the back button), or null when no
 * sign-in was started. Clears the pending sign-in and ?code from the URL. */
export function takeFreeKeyReturn(): FreeKeyReturn {
  let pending: { verifier: string; state: string } | null = null;
  try {
    const raw = sessionStorage.getItem(PENDING);
    if (raw) pending = JSON.parse(raw);
    sessionStorage.removeItem(PENDING);
  } catch { /* storage blocked: no sign-in can be pending */ }
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (code !== null || state !== null) {
    params.delete('code');
    params.delete('state');
    const rest = params.toString();
    history.replaceState(history.state, '', here() + (rest ? `?${rest}` : '') + location.hash);
  }
  if (!pending) return null;
  // OpenRouter echoes state on success; a code with another state isn't ours.
  if (!code || state !== pending.state) return { kind: 'cancelled' };
  return { kind: 'code', code, verifier: pending.verifier };
}

/** Trade the code for a key, or null if OpenRouter wouldn't. */
export async function exchangeCode(code: string, verifier: string): Promise<string | null> {
  try {
    const r = await fetch(`${OPENROUTER_BASE}/auth/keys`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return null;
    const { key } = (await r.json()) as { key?: unknown };
    return typeof key === 'string' && key ? key : null;
  } catch {
    return null;
  }
}
