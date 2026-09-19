import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { getSetting, setSetting } from './db';

export type ProviderKind = 'anthropic' | 'openai' | 'openrouter' | 'custom';

export interface ProviderSettings {
  kind: ProviderKind;
  model: string;
  /** Optional proxy / custom endpoint. Its origin must be in the build's connect-src. */
  baseURL?: string;
  /** Anthropic only: let the model use provider-side web search. */
  webSearch?: boolean;
}

export const PROVIDERS: Record<ProviderKind, { label: string; defaultModel: string; baseURL?: string; help: string }> = {
  anthropic: { label: 'Anthropic', defaultModel: 'claude-sonnet-5', baseURL: 'https://api.anthropic.com/v1', help: 'Direct from the browser.' },
  openai: { label: 'OpenAI', defaultModel: 'gpt-4.1', baseURL: 'https://api.openai.com/v1', help: 'Direct from the browser.' },
  openrouter: { label: 'OpenRouter', defaultModel: 'anthropic/claude-sonnet-4.5', baseURL: 'https://openrouter.ai/api/v1', help: 'One key for many models.' },
  custom: { label: 'Custom (OpenAI-compatible)', defaultModel: '', help: 'Your own proxy or gateway; its origin must be allowed at build time.' },
};

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
