import { describe, expect, it } from 'vitest';
import { cleanKey, keyProvider, settingsForKey, OPENROUTER_BASE } from '../src/lib/providers';
import { titleFrom } from '../src/lib/onboarding';

describe('keyProvider', () => {
  it('recognises each provider by its key prefix', () => {
    expect(keyProvider('AQ.Ab8RN6Kx2vQm9pLw4TzY7hJcE1sFuD0g')).toBe('google');
    expect(keyProvider('AIzaSyD-legacy-format-key-0000000')).toBe('google');
    expect(keyProvider('sk-ant-api03-abc')).toBe('anthropic');
    expect(keyProvider('sk-or-v1-abc')).toBe('openrouter');
    expect(keyProvider('sk-proj-abc')).toBe('openai');
    expect(keyProvider('  sk-ant-api03-abc  ')).toBe('anthropic');
    expect(keyProvider('something-else')).toBeNull();
  });

  it('maps a detected key to working settings', () => {
    expect(settingsForKey('anthropic')).toEqual({ kind: 'anthropic', model: 'claude-sonnet-5' });
    expect(settingsForKey('openrouter')).toMatchObject({ kind: 'custom', baseURL: OPENROUTER_BASE });
  });
});

describe('titleFrom', () => {
  it('takes the first sentence, at most ten words', () => {
    expect(titleFrom('I want to open a third salon. The lease is ten years.')).toBe('I want to open a third salon');
    expect(titleFrom('one two three four five six seven eight nine ten eleven twelve')).toBe('one two three four five six seven eight nine ten');
    expect(titleFrom('Land a job offer by March —\nmore detail')).toBe('Land a job offer by March');
    expect(titleFrom('   ')).toBe('My goal');
  });
});

describe('cleanKey', () => {
  it('strips what tends to come along when a key is copied', () => {
    expect(cleanKey('  AQ.Ab8RN6Kx2vQm9pLw\n')).toBe('AQ.Ab8RN6Kx2vQm9pLw');
    expect(cleanKey('"sk-ant-api03-abc"')).toBe('sk-ant-api03-abc');
    expect(cleanKey('`sk-or-v1-abc`,')).toBe('sk-or-v1-abc');
    expect(cleanKey('API key: AQ.Ab8RN6Kx2vQm9pLw')).toBe('AQ.Ab8RN6Kx2vQm9pLw');
    expect(cleanKey('GEMINI_API_KEY=AIzaSyD-abc')).toBe('AIzaSyD-abc');
    expect(cleanKey('AQ.Ab8R N6Kx')).toBe('AQ.Ab8RN6Kx');
  });
});
