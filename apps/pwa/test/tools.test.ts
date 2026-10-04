import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stubGoal, type FlowSession } from '@gambit/core';

let goal: Record<string, unknown> = stubGoal('g');
const applied: string[] = [];
vi.mock('../src/lib/db', () => ({ db: { goals: { get: async () => ({ id: 'g' }) } } }));
vi.mock('../src/lib/goals', () => ({
  readRecord: async () => ({ status: 'ok', data: goal }),
  applyOp: async (_id: string, op: (g: unknown) => { ok: boolean }) => { applied.push('op'); return { ...op(goal), warnings: [] }; },
}));
const { makeTools } = await import('../src/lib/tools');

const run = (t: unknown, input: object) => (t as { execute: (i: object, o: object) => Promise<Record<string, unknown>> }).execute(input, {});
const defined = { ...stubGoal('g'), successCriteria: [{ text: 'ship it', kind: 'control' }] };

describe('flow gates on the tools', () => {
  let session: FlowSession;
  let tools: ReturnType<typeof makeTools>;
  beforeEach(() => {
    goal = defined;
    applied.length = 0;
    session = { fresh: [] };
    tools = makeTools({ goalId: 'g', session, onSkillLoaded: () => {} });
  });

  it('refuses a goal-requiring skill on a stub', async () => {
    goal = stubGoal('g');
    expect(await run(tools.load_skill, { name: 'plan' })).toMatchObject({ ok: false, error: expect.stringContaining('intake') });
    expect(session.active).toBeUndefined();
    expect(await run(tools.load_skill, { name: 'intake' })).toMatchObject({ ok: true });
  });

  it('loads a skill that skips ahead of the method, with a warning naming the phase', async () => {
    const r = await run(tools.load_skill, { name: 'plan' });
    expect(r).toMatchObject({ ok: true, warning: expect.stringContaining('the method is at direct (no focus set yet)') });
    expect(session.active).toBe('plan');
    expect(await run(tools.load_skill, { name: 'strategy' })).not.toHaveProperty('warning');
  });

  it('refuses writes without the right active skill, and a write_section in the loading turn', async () => {
    const plan = { linesOfOperation: [{ label: 'L', criticalPath: [], nextActions: [{ action: 'call them', who: 'me', if: { event: 'no word by Friday' } }] }] };
    expect(await run(tools.write_section, { key: 'plan', value: plan })).toMatchObject({ ok: false });
    await run(tools.load_skill, { name: 'plan' });
    expect(await run(tools.write_section, { key: 'plan', value: plan })).toMatchObject({ ok: false, errors: [{ message: expect.stringContaining('confirm') }] });
    expect(await run(tools.write_section, { key: 'riskNotes', value: [] })).toMatchObject({ ok: false });
    expect(applied).toEqual([]);
    session.fresh = [];
    expect(await run(tools.write_section, { key: 'plan', value: plan })).toMatchObject({ ok: true });
  });

  it('routes updates only from sitrep, and a cleared skill writes in the turn it loads', async () => {
    const items = [{ skill: 'capacity', update: 'two hours a week less' }];
    expect(await run(tools.route_updates, { items })).toMatchObject({ ok: false, error: expect.stringContaining('sitrep') });
    await run(tools.load_skill, { name: 'sitrep' });
    expect(await run(tools.route_updates, { items: [{ skill: 'nope', update: 'x' }] })).toMatchObject({ ok: false });
    expect(await run(tools.route_updates, { items })).toMatchObject({ ok: true, routed: items });
    expect(session.routed).toEqual(items);

    // The next turn: the user said yes.
    session = { fresh: [], cleared: ['capacity'] };
    tools = makeTools({ goalId: 'g', session, onSkillLoaded: () => {} });
    await run(tools.load_skill, { name: 'capacity' });
    const capacity = { availableHrsPerWeek: 3, runway: '3 months', lastReviewed: '2026-10-03' };
    expect(await run(tools.write_section, { key: 'capacity', value: capacity })).toMatchObject({ ok: true });
  });

  it('runs elicit inside the active skill and hands back on finish', async () => {
    await run(tools.load_skill, { name: 'plan' });
    await run(tools.load_skill, { name: 'elicit' });
    expect(session).toMatchObject({ active: 'elicit', caller: 'plan' });
    expect(await run(tools.finish_skill, {})).toMatchObject({ ok: true, resumed: 'plan', text: expect.any(String) });
    expect(session).toMatchObject({ active: 'plan', caller: undefined });
    expect(await run(tools.finish_skill, {})).toEqual({ ok: true, finished: 'plan' });
    expect(session.active).toBeUndefined();
    expect(await run(tools.finish_skill, {})).toMatchObject({ ok: false });
  });
});
