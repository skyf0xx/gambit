import { describe, it, expect } from 'vitest';
import { WRITABLE_KEYS, PHASES, DOMAINS, stubGoal, writersOf } from '@gambit/core';
import { PREAMBLE, SECTION_SHAPES, KEY_SHAPES, buildStore, bundledFiles, domainPackOf, packDescriptions, guidedRules, methods, skillFile, skillFlows, skillIndexText, skillShapes, elicitationMethods } from '../src/lib/skills';
import { compactToolResults, trimHistory, keepLastTurns, flowText, CHAT_TURNS, HISTORY_CHAR_BUDGET } from '../src/lib/agent';
import type { ModelMessage } from 'ai';
import type { DisplayMsg } from '../src/lib/db';

describe('skills and preamble', () => {
  const store = buildStore(bundledFiles, 'test');
  it('indexes the 20 core skills, the two native ones and the domain packs, excluding _shared', () => {
    const names = store.index.map((s) => s.name);
    expect(names).toContain('plan');
    expect(names).toContain('intake');
    expect(names).toContain('elicit');
    expect(names).not.toContain('_shared');
    expect(names.length).toBe(22 + Object.keys(domainPackOf).length);
    expect(store.index.every((s) => s.description.length > 20)).toBe(true);
  });
  it('carries the guided-session rules from skills/_shared/GUIDED.md', () => {
    expect(guidedRules).toContain('Guided, not just capable');
    expect(guidedRules).not.toContain('gambit check');
    expect(PREAMBLE).toContain('write_section');
    expect(Object.keys(KEY_SHAPES).sort()).toEqual([...WRITABLE_KEYS].sort());
    for (const k of WRITABLE_KEYS) expect(KEY_SHAPES[k], k).toMatch(new RegExp(`^${k}\\??:`));
    expect(PREAMBLE).toContain(SECTION_SHAPES);
    expect(PREAMBLE).not.toContain(KEY_SHAPES.plan);
  });
  it('gives a skill the shapes of the keys it writes and reads, and a read-only skill every shape', () => {
    const capacity = skillShapes(store, 'capacity');
    expect(capacity).toContain(KEY_SHAPES.capacity);
    expect(capacity).not.toContain(KEY_SHAPES.plan);
    expect(skillShapes(store, 'strategy')).toContain(KEY_SHAPES.systemsNotes);
    for (const k of WRITABLE_KEYS) expect(skillShapes(store, 'brief'), k).toContain(KEY_SHAPES[k]);
    expect(skillShapes(store, 'nope')).toBe('');
  });
  it('serves shared files and rejects traversal', () => {
    expect(skillFile(store, '_shared', 'HUMANIZE.md')).toBeTruthy();
    expect(skillFile(store, 'plan', '../onboard/SKILL.md')).toBeNull();
  });
  it('declares a valid flow in every skill', () => {
    const flows = skillFlows(store);
    const names = flows.map((f) => f.name);
    for (const f of flows) {
      expect(f.errors, f.name).toEqual([]);
      for (const n of f.next) expect(names, `${f.name} next`).toContain(n);
    }
    for (const k of [...WRITABLE_KEYS, 'log']) expect(writersOf(k, flows), k).not.toEqual([]);
    expect(flows.filter((f) => f.checkpoint).map((f) => f.name)).toEqual(['elicit']);
    expect(flows.filter((f) => f.requires === 'any').map((f) => f.name).sort()).toEqual(['elicit', 'intake', 'onboard']);
    expect(flows.filter((f) => f.phase === 'any').map((f) => f.name).sort()).toEqual(['brief', 'elicit', 'onboard']);
    for (const p of PHASES) expect(flows.some((f) => f.phase === p), p).toBe(true);
  });
  it('gates each domain pack skill by the pack its directory names', () => {
    expect(Object.entries(domainPackOf).sort()).toEqual([
      ['backfire', 'activism'], ['demands', 'activism'], ['distribution', 'business'], ['message', 'activism'],
      ['organizing', 'activism'], ['pillars', 'activism'], ['positioning', 'business'], ['pricing', 'business'], ['tactics', 'activism'],
    ]);
    for (const [name, pack] of Object.entries(domainPackOf)) {
      const flow = store.index.find((s) => s.name === name)!.flow;
      expect(flow.pack, name).toBe(pack);
      expect(DOMAINS, name).toContain(pack);
    }
    expect(store.index.filter((s) => s.flow.pack).map((s) => s.name).sort()).toEqual(Object.keys(domainPackOf).sort());
    expect(Object.keys(packDescriptions).sort()).toEqual([...DOMAINS].sort());
    const untagged = skillIndexText(store);
    expect(untagged).not.toContain('- pricing');
    expect(untagged).toContain('- business pack (distribution, positioning, pricing): For a goal that succeeds when someone pays');
    const tagged = skillIndexText(store, ['business']);
    expect(tagged).toContain('- pricing [business pack]: ');
    expect(tagged).not.toContain('- business pack (');
    expect(tagged).toContain('- activism pack (');
    expect(tagged.length).toBeLessThan(skillIndexText(store, DOMAINS).length);
    const goal = { ...stubGoal('g'), domains: ['business'] };
    expect(flowText(store, {}, goal, '2026-10-02')).toContain('Packs on this goal: business (distribution, positioning, pricing).');
    expect(flowText(store, {}, stubGoal('g'), '2026-10-02')).not.toContain('Packs on this goal');
  });
  it('states the active skill and what is due in the turn state', () => {
    const goal = stubGoal('g');
    expect(flowText(store, {}, goal, '2026-10-02')).toBe('No skill is active; every write but remember and forget needs one.\nMethod: define, next intake (the goal is not defined yet).\nDue now: intake (the goal is not defined yet).');
    const t = flowText(store, { active: 'elicit', caller: 'intake' }, goal, '2026-10-02');
    expect(t).toContain('Active skill: elicit, inside intake (writes goal, subGoals');
    expect(t).not.toContain('hands off to');
    expect(flowText(store, { active: 'plan' }, goal, '2026-10-02')).toMatch(/plan hands off to: \w/);
    const routed = flowText(store, {}, goal, '2026-10-02', [{ skill: 'plan', update: 'venue moved' }, { skill: 'capacity', update: 'less time' }]);
    expect(routed).toContain('Routed updates the user confirmed: plan — venue moved; capacity — less time. Load each in turn and write it now');
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

  // A synthetic turn: one user message plus an assistant reply that itself
  // includes a tool-call and its paired tool-result, matching the shape
  // ai's `streamText` response messages actually take.
  function turn(n: number, big = false): ModelMessage[] {
    const pad = big ? 'x'.repeat(2000) : 'x';
    return [
      { role: 'user', content: `user ${n} ${pad}` } as ModelMessage,
      { role: 'assistant', content: [{ type: 'tool-call', toolCallId: `t${n}`, toolName: 'write_section', input: {} }] } as ModelMessage,
      { role: 'tool', content: [{ type: 'tool-result', toolCallId: `t${n}`, toolName: 'write_section', output: { type: 'json', value: { ok: true } } }] } as ModelMessage,
      { role: 'assistant', content: `reply ${n} ${pad}` } as ModelMessage,
    ];
  }

  it('trimHistory drops whole turns and never starts the window mid-turn', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => turn(i, true)).flat();
    const budget = JSON.stringify(turn(0, true)).length * 3.5; // room for ~3 turns
    const { messages, trimmed } = trimHistory(msgs, budget);
    expect(trimmed).toBe(true);
    expect(messages[0].role).toBe('user');
    // No dangling tool-result at the start.
    expect(messages[0].role).not.toBe('tool');
    // Turns are intact: every tool-call is immediately followed later by its matching tool-result within the kept slice.
    const toolCallIds = messages.filter((m) => m.role === 'assistant' && Array.isArray(m.content)).flatMap((m) => (m.content as { toolCallId?: string }[]).map((p) => p.toolCallId).filter(Boolean));
    const toolResultIds = messages.filter((m) => m.role === 'tool').flatMap((m) => (m.content as { toolCallId?: string }[]).map((p) => p.toolCallId));
    expect(toolResultIds.sort()).toEqual(toolCallIds.sort());
  });

  it('trimHistory always keeps at least the latest user message even over budget', () => {
    const msgs = turn(0, true);
    const { messages } = trimHistory(msgs, 10); // tiny budget
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toContain('user 0');
  });

  it('trimHistory keeps everything when under budget', () => {
    const msgs = Array.from({ length: 3 }, (_, i) => turn(i)).flat();
    const { messages, trimmed } = trimHistory(msgs, HISTORY_CHAR_BUDGET);
    expect(trimmed).toBe(false);
    expect(messages).toEqual(msgs);
  });

  it('keepLastTurns keeps the newest N whole turns of model history', () => {
    const msgs = Array.from({ length: 20 }, (_, i) => turn(i)).flat(); // 20 turns, 80 messages
    const windowed = keepLastTurns(msgs, CHAT_TURNS);
    expect(windowed.filter((m) => m.role === 'user')).toHaveLength(CHAT_TURNS);
    expect(windowed).toHaveLength(CHAT_TURNS * 4);
    expect(windowed[0].role).toBe('user');
    expect(windowed.at(-1)).toEqual(msgs.at(-1));
  });

  it('keepLastTurns is a no-op under the limit', () => {
    const msgs = turn(0);
    expect(keepLastTurns(msgs, CHAT_TURNS)).toEqual(msgs);
  });

  function displayTurn(i: number): DisplayMsg[] {
    return [
      { id: `u${i}`, role: 'user', text: `hi ${i}` },
      { id: `a${i}`, role: 'assistant', text: `reply ${i}`, tools: [], summary: [] },
    ];
  }

  it('keepLastTurns keeps the display to the same turns as the model history', () => {
    const model = Array.from({ length: 30 }, (_, i) => turn(i)).flat();
    const display = Array.from({ length: 30 }, (_, i) => displayTurn(i)).flat();
    const keptModel = keepLastTurns(model, CHAT_TURNS);
    const keptDisplay = keepLastTurns(display, CHAT_TURNS);
    expect(keptDisplay).toHaveLength(CHAT_TURNS * 2);
    expect(keptDisplay[0]).toEqual({ id: 'u18', role: 'user', text: 'hi 18' });
    expect(keptModel[0]).toEqual(model[18 * 4]);
  });
});
