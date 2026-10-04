import { describe, it, expect } from 'vitest';
import { stubGoal } from '@gambit/core';
import { deriveMarks, type SessionSnapshot } from '../src/lib/marks/derive';
import { hashSeed, rng, ellipsePoints, unionBox, type Box } from '../src/components/marks/stroke';
import { noteForMark } from '../src/components/marks/MarksLayer';
import type { Goal } from '../src/lib/types';

const emptySession: SessionSnapshot = { turn: null, dropped: new Map() };

function withPlan(goal: Goal, overrides: Partial<NonNullable<Goal['plan']>['linesOfOperation'][number]> = {}): Goal {
  return {
    ...goal,
    plan: {
      linesOfOperation: [
        {
          label: 'Line A',
          criticalPath: [{ label: 'Step one' }],
          nextActions: [{ action: 'Call Priya', who: 'me', when: '2026-10-09', status: 'pending' as const }],
          ...overrides,
        },
      ],
    },
  };
}

describe('deriveMarks — tick', () => {
  it('marks a done next action', () => {
    const goal = withPlan(stubGoal('Goal') as Goal, {
      nextActions: [{ action: 'Call Priya', who: 'me', when: '2026-10-09', status: 'done' as const }],
    });
    const { byPath } = deriveMarks(goal, 'g1', emptySession);
    expect(byPath.get('plan.linesOfOperation.0.nextActions.0')).toEqual({ kind: 'tick', sr: 'done' });
  });

  it('never ticks a milestone: it becomes true, so its diamond fills instead', () => {
    const goal = withPlan(stubGoal('Goal') as Goal, {
      criticalPath: [{ id: 'one', label: 'Step one', after: ['call'] }],
      nextActions: [{ id: 'call', action: 'Call Priya', who: 'me', when: '2026-10-09', status: 'done' as const }],
    });
    expect(deriveMarks(goal, 'g1', emptySession).byPath.get('plan.linesOfOperation.0.criticalPath.0')).toBeUndefined();
  });

  it('marks a criterion scored met', () => {
    const goal: Goal = {
      ...(stubGoal('Goal') as Goal),
      successCriteria: [{ text: 'ship it', kind: 'control' as const }],
      criteriaStatus: [{ text: 'ship it', kind: 'control' as const, status: 'met' as const }],
    };
    const { byPath } = deriveMarks(goal, 'g1', emptySession);
    expect(byPath.get('successCriteria.0')).toEqual({ kind: 'tick', sr: 'done' });
  });

  it('does not mark a pending item', () => {
    const goal = withPlan(stubGoal('Goal') as Goal);
    const { byPath } = deriveMarks(goal, 'g1', emptySession);
    expect(byPath.get('plan.linesOfOperation.0.nextActions.0')).toBeUndefined();
  });
});

describe('deriveMarks — highlight', () => {
  it('marks the line named by the current focus, past later entries that set none', () => {
    const goal: Goal = {
      ...withPlan(stubGoal('Goal') as Goal),
      log: [
        { date: '2026-01-01', focus: 'earlier', focusLine: 'Step one', notes: [] },
        { date: '2026-01-02', focus: null, notes: [] },
      ],
    };
    const { byPath } = deriveMarks(goal, 'g1', emptySession);
    // the latest entry sets no focus, so the earlier focus still holds
    expect(byPath.get('plan.linesOfOperation.0.criticalPath.0')).toEqual({ kind: 'highlight', sr: 'focus' });
  });

  it('clears when a newer focus names no single line', () => {
    const goal: Goal = {
      ...withPlan(stubGoal('Goal') as Goal),
      log: [
        { date: '2026-01-01', focus: 'earlier', focusLine: 'Step one', notes: [] },
        { date: '2026-01-02', focus: 'broader now', notes: [] },
      ],
    };
    const { byPath } = deriveMarks(goal, 'g1', emptySession);
    expect([...byPath.values()].some((m) => m.kind === 'highlight')).toBe(false);
  });

  it('ignores a focusLine from a skill other than strategy', () => {
    const goal: Goal = {
      ...withPlan(stubGoal('Goal') as Goal),
      log: [{ date: '2026-01-01', focus: 'f', focusLine: 'Step one', source: 'plan', notes: [] }],
    };
    const { byPath } = deriveMarks(goal, 'g1', emptySession);
    expect([...byPath.values()].some((m) => m.kind === 'highlight')).toBe(false);
  });

  it('is absent when no log entry carries a focusLine', () => {
    const goal = withPlan(stubGoal('Goal') as Goal);
    const { byPath } = deriveMarks(goal, 'g1', emptySession);
    expect([...byPath.values()].some((m) => m.kind === 'highlight')).toBe(false);
  });
});

describe('deriveMarks — milestones', () => {
  it('lets the focus highlight land on a milestone', () => {
    const goal: Goal = {
      ...withPlan(stubGoal('Goal') as Goal, { criticalPath: [{ label: 'A step' }] }),
      log: [{ date: '2026-01-01', focus: 'f', focusLine: 'A step', notes: [] }],
    };
    expect(deriveMarks(goal, 'g1', emptySession).byPath.get('plan.linesOfOperation.0.criticalPath.0')).toMatchObject({ kind: 'highlight' });
  });
});

describe('deriveMarks — arrow', () => {
  it('links a risk to a matching person by name', () => {
    const goal: Goal = {
      ...(stubGoal('Goal') as Goal),
      people: [{ name: 'Priya', status: 'confirmed' as const, doing: 'intros' }],
      riskNotes: [{ item: 'vendor lock-in', source: 'threat' as const, accepted: false, dependsOn: 'Priya' }],
    };
    const { byPath, arrows } = deriveMarks(goal, 'g1', emptySession);
    expect(byPath.get('riskNotes.0')).toEqual({ kind: 'arrow', sr: 'depends on Priya', to: 'people.0' });
    expect(arrows).toEqual([{ from: 'riskNotes.0', to: 'people.0' }]);
  });

  it('does nothing when dependsOn matches no one', () => {
    const goal: Goal = {
      ...(stubGoal('Goal') as Goal),
      riskNotes: [{ item: 'vendor lock-in', source: 'threat' as const, accepted: false, dependsOn: 'Nobody' }],
    };
    const { byPath, arrows } = deriveMarks(goal, 'g1', emptySession);
    expect(byPath.get('riskNotes.0')).toBeUndefined();
    expect(arrows).toEqual([]);
  });

  // brand/identity.md §05: "only one arrow is visible at a time" — every
  // other dependsOn risk falls back to a pencilled "→ Name" note instead of
  // a drawn arrow, though all of them keep the same "depends on X" SR text.
  it('draws only the first dependsOn risk as an arrow; the rest get the text-only fallback', () => {
    const goal: Goal = {
      ...(stubGoal('Goal') as Goal),
      people: [
        { name: 'Priya', status: 'confirmed' as const, doing: 'intros' },
        { name: 'Dev', status: 'confirmed' as const, doing: 'fit-out' },
      ],
      riskNotes: [
        { item: 'vendor lock-in', source: 'threat' as const, accepted: false, dependsOn: 'Priya' },
        { item: 'fit-out overruns', source: 'threat' as const, accepted: false, dependsOn: 'Dev' },
      ],
    };
    const { byPath, arrows } = deriveMarks(goal, 'g1', emptySession);
    expect(byPath.get('riskNotes.0')).toEqual({ kind: 'arrow', sr: 'depends on Priya', to: 'people.0' });
    expect(byPath.get('riskNotes.1')).toEqual({ kind: 'arrow-text', sr: 'depends on Dev', to: 'people.1', toName: 'Dev' });
    // Only the drawn arrow is reported in `arrows` (MarksLayer's draw list).
    expect(arrows).toEqual([{ from: 'riskNotes.0', to: 'people.0' }]);
  });
});

describe('deriveMarks — experiments and forecasts', () => {
  // Their open/settled state is shown by grouping under a pencilled status
  // on the page itself (Sections.tsx), not by a mark.
  it('leaves open experiments and forecasts unmarked', () => {
    const goal: Goal = {
      ...(stubGoal('Goal') as Goal),
      experiments: [{ assumption: 'x works', test: 'try it', passIf: 'y', by: '2026-02-01', done: false }],
      forecasts: [{ statement: 'will happen', probability: 60, resolvesBy: '2026-02-01', resolvesVia: 'check', resolved: false }],
    };
    const { byPath } = deriveMarks(goal, 'g1', emptySession);
    expect(byPath.get('experiments.0')).toBeUndefined();
    expect(byPath.get('forecasts.0')).toBeUndefined();
  });
});

describe('deriveMarks — question', () => {
  it('marks an open decision', () => {
    const goal: Goal = {
      ...(stubGoal('Goal') as Goal),
      decisions: [{ date: '2026-01-01', status: 'open' as const, question: 'which vendor?' }],
    };
    const { byPath } = deriveMarks(goal, 'g1', emptySession);
    expect(byPath.get('decisions.0')).toEqual({ kind: 'question', sr: 'open question' });
  });

  it('does not mark a decided decision', () => {
    const goal: Goal = {
      ...(stubGoal('Goal') as Goal),
      decisions: [{ date: '2026-01-01', status: 'decided' as const, choice: 'go with A', reverseIf: 'A fails' }],
    };
    const { byPath } = deriveMarks(goal, 'g1', emptySession);
    expect(byPath.get('decisions.0')).toBeUndefined();
  });
});

describe('deriveMarks — event marks win: cancel and loop', () => {
  it('cancel overrides a derived mark on the same path, in pencil, with SR "cancelled"', () => {
    const goal = withPlan(stubGoal('Goal') as Goal, {
      nextActions: [{ action: 'Call Priya', who: 'me', when: '2026-10-09', status: 'done' as const }],
    });
    const session: SessionSnapshot = {
      turn: null,
      dropped: new Map([['g1', new Set(['plan.linesOfOperation.0.nextActions.0'])]]),
    };
    const { byPath } = deriveMarks(goal, 'g1', session);
    expect(byPath.get('plan.linesOfOperation.0.nextActions.0')).toEqual({ kind: 'cancel', sr: 'cancelled', pencil: true });
  });

  it('loop overrides a derived mark on the same path', () => {
    const goal = withPlan(stubGoal('Goal') as Goal, {
      nextActions: [{ action: 'Call Priya', who: 'me', when: '2026-10-09', status: 'done' as const }],
    });
    const session: SessionSnapshot = {
      turn: { goalId: 'g1', turnId: 't1', lines: [{ path: 'plan.linesOfOperation.0.nextActions.0', text: 'Call Priya' }], animated: false },
      dropped: new Map(),
    };
    const { byPath } = deriveMarks(goal, 'g1', session);
    expect(byPath.get('plan.linesOfOperation.0.nextActions.0')).toEqual({
      kind: 'loop',
      sr: 'changed in your last chat',
      note: 'changed',
    });
  });

  it('only marks the first of the turn lines as loop', () => {
    const goal = withPlan(stubGoal('Goal') as Goal);
    const session: SessionSnapshot = {
      turn: {
        goalId: 'g1',
        turnId: 't1',
        lines: [
          { path: 'plan.linesOfOperation.0.nextActions.0', text: 'Call Priya' },
          { path: 'plan.linesOfOperation.0.criticalPath.0', text: 'Step one' },
        ],
        animated: false,
      },
      dropped: new Map(),
    };
    const { byPath } = deriveMarks(goal, 'g1', session);
    expect(byPath.get('plan.linesOfOperation.0.nextActions.0')?.kind).toBe('loop');
    expect(byPath.get('plan.linesOfOperation.0.criticalPath.0')?.kind).not.toBe('loop');
  });

  it('ignores turn state for a different goal', () => {
    const goal = withPlan(stubGoal('Goal') as Goal);
    const session: SessionSnapshot = {
      turn: { goalId: 'other-goal', turnId: 't1', lines: [{ path: 'plan.linesOfOperation.0.nextActions.0', text: 'Call Priya' }], animated: false },
      dropped: new Map(),
    };
    const { byPath } = deriveMarks(goal, 'g1', session);
    expect(byPath.get('plan.linesOfOperation.0.nextActions.0')).toBeUndefined();
  });

  it('ignores dropped paths recorded for a different goal', () => {
    const goal = withPlan(stubGoal('Goal') as Goal);
    const session: SessionSnapshot = {
      turn: null,
      dropped: new Map([['other-goal', new Set(['plan.linesOfOperation.0.nextActions.0'])]]),
    };
    const { byPath } = deriveMarks(goal, 'g1', session);
    expect(byPath.get('plan.linesOfOperation.0.nextActions.0')).toBeUndefined();
  });
});

describe('noteForMark — pencil-note tooltip text per mark', () => {
  it('gives an arrow its "depends on <name>" text verbatim from sr', () => {
    expect(noteForMark({ kind: 'arrow', sr: 'depends on Priya', to: 'people.0' })).toBe('depends on Priya');
  });

  it('gives an open question its meaning', () => {
    expect(noteForMark({ kind: 'question', sr: 'open question' })).toBe('still to decide');
  });

  it('gives the loop its "new from your chat" meaning', () => {
    expect(noteForMark({ kind: 'loop', sr: 'changed in your last chat', note: 'changed' })).toBe('new from your chat');
  });

  it('gives the highlighter its "focus right now" meaning', () => {
    expect(noteForMark({ kind: 'highlight', sr: 'focus' })).toBe("anything that doesn't help this can wait");
  });

  it('has no note for a tick or a cancel mark', () => {
    expect(noteForMark({ kind: 'tick', sr: 'done' })).toBeNull();
    expect(noteForMark({ kind: 'cancel', sr: 'cancelled', pencil: true })).toBeNull();
  });
});

describe('stroke geometry — determinism', () => {
  it('hashSeed is stable for the same path', () => {
    expect(hashSeed('plan.linesOfOperation.0.nextActions.2')).toBe(hashSeed('plan.linesOfOperation.0.nextActions.2'));
  });

  it('hashSeed differs for different paths', () => {
    expect(hashSeed('successCriteria.0')).not.toBe(hashSeed('successCriteria.1'));
  });

  it('rng(seed) produces the same sequence for the same seed', () => {
    const a = rng(42);
    const b = rng(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('ellipsePoints is deterministic for the same box and seed', () => {
    const box: Box = { l: 0, t: 0, r: 100, b: 20, w: 100, h: 20 };
    const p1 = ellipsePoints(box, hashSeed('a.path'));
    const p2 = ellipsePoints(box, hashSeed('a.path'));
    expect(p1).toEqual(p2);
  });

  it('unionBox spans multiple line rects', () => {
    const lines: Box[] = [
      { l: 0, t: 0, r: 50, b: 10, w: 50, h: 10 },
      { l: 5, t: 10, r: 80, b: 20, w: 75, h: 10 },
    ];
    expect(unionBox(lines)).toEqual({ l: 0, t: 0, r: 80, b: 20, w: 80, h: 20 });
  });
});
