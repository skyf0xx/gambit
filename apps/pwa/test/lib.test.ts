import { describe, it, expect } from 'vitest';
import { WRITABLE_KEYS } from '@gambit/core';
import { PREAMBLE, SECTION_SHAPES, buildStore, bundledFiles, guidedRules, methods, skillFile, elicitationMethods } from '../src/lib/skills';
import { compactToolResults, trimHistory } from '../src/lib/agent';

describe('skills and preamble', () => {
  const store = buildStore(bundledFiles, 'test');
  it('indexes the 18 pack skills plus the two native ones, excluding _shared', () => {
    const names = store.index.map((s) => s.name);
    expect(names).toContain('plan');
    expect(names).toContain('intake');
    expect(names).toContain('elicit');
    expect(names).not.toContain('_shared');
    expect(names.length).toBe(20);
    expect(store.index.every((s) => s.description.length > 20)).toBe(true);
  });
  it('carries the guided-session rules from skills/_shared/GUIDED.md', () => {
    expect(guidedRules).toContain('Guided, not just capable');
    expect(guidedRules).not.toContain('gambit check');
    expect(PREAMBLE).toContain('write_section');
    for (const k of WRITABLE_KEYS) expect(SECTION_SHAPES, k).toContain(`${k}:`);
  });
  it('serves shared files and rejects traversal', () => {
    expect(skillFile(store, '_shared', 'HUMANIZE.md')).toBeTruthy();
    expect(skillFile(store, 'plan', '../onboard/SKILL.md')).toBeNull();
  });
  it('parses the elicitation catalog', () => {
    expect(methods.length).toBeGreaterThan(60);
    expect(elicitationMethods({ command: 'random', n: 5 })).toHaveLength(5);
  });
});

describe('history', () => {
  it('trims to a user message and stubs loaded skill text', () => {
    const msgs = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(500) }) as never);
    const t = trimHistory(msgs, 3000);
    expect(t.trimmed).toBe(true);
    expect(t.messages[0].role).toBe('user');
    const c = compactToolResults([{ role: 'tool', content: [{ type: 'tool-result', toolCallId: '1', toolName: 'load_skill', output: { type: 'json', value: { text: 'BIG' } } }] }]);
    expect(JSON.stringify(c)).not.toContain('BIG');
  });
});
