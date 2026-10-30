import { describe, it, expect } from 'vitest';
import { viaOllamaProxy } from '../src/lib/providers';

const site = 'https://gambit.example';
const custom = (baseURL: string, model = 'gemma4:31b') => ({ kind: 'custom' as const, model, baseURL });

describe('viaOllamaProxy', () => {
  it.each(['https://ollama.com/v1', 'https://ollama.com', 'ollama.com/v1', ' https://www.ollama.com/v1/ '])('sends %s through this site', (url) => {
    expect(viaOllamaProxy(custom(url), site, true)?.baseURL).toBe(`${site}/ollama/v1`);
  });

  it('drops the local app\'s -cloud from the model', () => {
    expect(viaOllamaProxy(custom('https://ollama.com/v1', 'gemma4:31b-cloud'), site, true)?.model).toBe('gemma4:31b');
  });

  it('leaves everything else alone', () => {
    expect(viaOllamaProxy(custom(`${site}/ollama/v1`), site, true)).toBeNull();
    expect(viaOllamaProxy(custom('https://notollama.com/v1'), site, true)).toBeNull();
    expect(viaOllamaProxy(custom('https://ollama.com.evil.example/v1'), site, true)).toBeNull();
    expect(viaOllamaProxy({ kind: 'openai', model: 'x', baseURL: 'https://ollama.com/v1' }, site, true)).toBeNull();
  });

  it('does nothing on a build without the rewrite', () => {
    expect(viaOllamaProxy(custom('https://ollama.com/v1'), site, false)).toBeNull();
  });
});
