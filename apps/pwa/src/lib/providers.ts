import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { getSetting, setSetting } from './db';

export type ProviderKind = 'google' | 'anthropic' | 'openai' | 'custom';

export interface ProviderSettings {
  kind: ProviderKind;
  model: string;
  /** Optional proxy / custom endpoint. Its origin must be in the build's connect-src. */
  baseURL?: string;
  /** Anthropic only: let the model use provider-side web search. */
  webSearch?: boolean;
}

export const PROVIDERS: Record<ProviderKind, { label: string; defaultModel: string; baseURL?: string; help: string }> = {
  google: { label: 'Google AI Studio', defaultModel: 'gemini-flash-latest', baseURL: 'https://generativelanguage.googleapis.com/v1beta', help: 'Free to start with a Google account.' },
  anthropic: { label: 'Anthropic', defaultModel: 'claude-sonnet-5', baseURL: 'https://api.anthropic.com/v1', help: 'Direct from the browser.' },
  openai: { label: 'OpenAI', defaultModel: 'gpt-4.1', baseURL: 'https://api.openai.com/v1', help: 'Direct from the browser.' },
  custom: { label: 'Custom (OpenAI-compatible)', defaultModel: '', help: 'OpenRouter, your own proxy or a gateway. Its origin must be allowed at build time.' },
};

/** Where a Google key comes from, and the model tried when the default is busy (503). */
export const GOOGLE_KEY_URL = 'https://aistudio.google.com/api-keys';
export const GOOGLE_FALLBACK_MODEL = 'gemini-3.5-flash-lite';
export const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

/** A key as copied, minus what tends to come with it: surrounding quotes or
 * backticks, a "Key:" style label, stray spaces and line breaks. */
export function cleanKey(raw: string): string {
  const k = raw.trim().replace(/^(?:[a-z _]*key)\s*[:=]\s*/i, '').replace(/^["'`]+|["'`,;]+$/g, '');
  return k.replace(/\s+/g, '');
}

/** Guess a key's provider from its prefix. `openrouter` maps to a custom endpoint. */
export function keyProvider(key: string): Exclude<ProviderKind, 'custom'> | 'openrouter' | null {
  const k = cleanKey(key);
  if (k.startsWith('sk-ant-')) return 'anthropic';
  if (k.startsWith('sk-or-')) return 'openrouter';
  if (k.startsWith('sk-')) return 'openai';
  if (k.startsWith('AQ.') || k.startsWith('AIza')) return 'google';
  return null;
}

export const KEY_LABEL = { google: 'Google', anthropic: 'Anthropic', openai: 'OpenAI', openrouter: 'OpenRouter' } as const;

/** Settings for a detected key: the provider's default model, with OpenRouter as a custom endpoint. */
export function settingsForKey(p: NonNullable<ReturnType<typeof keyProvider>>): ProviderSettings {
  if (p === 'openrouter') return { kind: 'custom', model: 'anthropic/claude-sonnet-4.5', baseURL: OPENROUTER_BASE };
  return { kind: p, model: PROVIDERS[p].defaultModel };
}

export type KeyCheck = 'ok' | 'bad' | 'offline' | 'unreachable';

/** A free call that fails on a bad key: each provider's model list (OpenRouter's
 * list is public, so its own key endpoint instead). Runs before a key is saved. */
export async function checkKey(s: Pick<ProviderSettings, 'kind' | 'baseURL'>, key: string): Promise<KeyCheck> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
  const base = (s.baseURL || PROVIDERS[s.kind].baseURL || '').replace(/\/$/, '');
  if (!base) return 'unreachable';
  const k = cleanKey(key);
  let url = `${base}/models`;
  let headers: Record<string, string> = { authorization: `Bearer ${k}` };
  if (s.kind === 'google') { url = `${base}/models?pageSize=1`; headers = { 'x-goog-api-key': k }; }
  else if (s.kind === 'anthropic') {
    url = `${base}/models?limit=1`;
    headers = { 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
  } else if (base.startsWith(OPENROUTER_BASE)) url = `${base}/key`;
  try {
    const r = await fetch(url, { headers });
    if (r.ok) return 'ok';
    return r.status === 400 || r.status === 401 || r.status === 403 ? 'bad' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}

export const getProvider = () => getSetting<ProviderSettings>('provider');
export const saveProvider = (p: ProviderSettings) => setSetting('provider', p);

/** In dev anything goes; in a production build only origins listed in the CSP work. */
export function originAllowed(url: string): boolean {
  if (import.meta.env.DEV) return true;
  try {
    const o = new URL(url).origin;
    return __CONNECT_SRC__.includes(o) || o === location.origin;
  } catch {
    return false;
  }
}

export function makeModel(s: ProviderSettings, apiKey: string): LanguageModel {
  const base = s.baseURL || PROVIDERS[s.kind].baseURL;
  if (base && !originAllowed(base)) throw new Error(`${new URL(base).origin} is not allowed by this build's Content-Security-Policy`);
  if (s.kind === 'google') {
    return createGoogleGenerativeAI({ apiKey, baseURL: s.baseURL || undefined })(s.model);
  }
  if (s.kind === 'anthropic') {
    return createAnthropic({
      apiKey,
      baseURL: s.baseURL || undefined,
      headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
    })(s.model);
  }
  if (!base) throw new Error('A base URL is required for a custom provider');
  return createOpenAICompatible({ name: s.kind, apiKey, baseURL: base })(s.model);
}
