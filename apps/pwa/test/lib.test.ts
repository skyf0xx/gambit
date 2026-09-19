import { describe, it, expect } from 'vitest';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { WRITABLE_KEYS } from '@gambit/core';
import { compareVersions, evaluateManifest, verifyIntegrity } from '../src/lib/update';
import { gunzip, untar } from '../src/lib/tar';
import { diffPacks } from '../src/lib/diff';
import { PREAMBLE, SECTION_SHAPES, buildStore, bundledFiles, guidedRules, methods, skillFile, elicitationMethods } from '../src/lib/skills';
import { compactToolResults, trimHistory } from '../src/lib/agent';

function tarOf(files: Record<string, string>): Uint8Array {
  const blocks: Uint8Array[] = [];
  for (const [name, text] of Object.entries(files)) {
    const body = new TextEncoder().encode(text);
    const h = new Uint8Array(512);
    h.set(new TextEncoder().encode(name));
    h.set(new TextEncoder().encode(body.length.toString(8).padStart(11, '0') + '\0'), 124);
    h[156] = '0'.charCodeAt(0);
    blocks.push(h, body, new Uint8Array((512 - (body.length % 512)) % 512));
  }
  blocks.push(new Uint8Array(1024));
  const out = new Uint8Array(blocks.reduce((n, b) => n + b.length, 0));
  let o = 0;
  for (const b of blocks) { out.set(b, o); o += b.length; }
  return out;
}

describe('update gate', () => {
  const m = (version: string, min?: string) => ({ name: 'x', version, dist: { tarball: 'https://registry.npmjs.org/x.tgz' }, gambit: { appVersionMin: min } });
  it('compares versions', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });
  it('gates on installed version and appVersionMin', () => {
    expect(evaluateManifest(m('1.0.0'), '1.0.0', '0.1.0').status).toBe('up_to_date');
    expect(evaluateManifest(m('1.1.0', '0.2.0'), '1.0.0', '0.1.0').status).toBe('needs_app_update');
    expect(evaluateManifest(m('1.1.0', '0.1.0'), '1.0.0', '0.1.0').status).toBe('available');
  });
});

describe('tarball handling', () => {
  it('verifies sha512 integrity and refuses mismatches or missing hashes', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const good = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    await expect(verifyIntegrity(bytes, good)).resolves.toBeUndefined();
    await expect(verifyIntegrity(new Uint8Array([9]), good)).rejects.toThrow(/integrity/);
    await expect(verifyIntegrity(bytes, undefined)).rejects.toThrow(/no sha512/);
  });
  it('unpacks a gzipped tar and skips path traversal', async () => {
    const gz = new Uint8Array(gzipSync(tarOf({ 'package/skills/a/SKILL.md': 'hello', 'package/../evil.md': 'x' })));
    const files = untar(await gunzip(gz as Uint8Array<ArrayBuffer>));
    expect(files).toEqual({ 'package/skills/a/SKILL.md': 'hello' });
  });
  it('diffs packs', () => {
    const d = diffPacks({ 'skills/a.md': 'one\ntwo', 'skills/b.md': 'b' }, { 'skills/a.md': 'one\n2', 'skills/c.md': 'c' });
    expect(d.added).toEqual(['skills/c.md']);
    expect(d.removed).toEqual(['skills/b.md']);
    expect(d.changed[0].lines.filter((l) => l.t !== ' ').map((l) => l.t + l.s)).toEqual(['-two', '+2']);
  });
});

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
  it('rebinds CLI machinery in the preamble without repeating it from AGENTS.md', () => {
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
