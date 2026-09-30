import { describe, it, expect } from 'vitest';
import { stubGoal } from '@gambit/core';
import { changedLines } from '../src/lib/changes';
import type { Goal } from '../src/lib/types';

function withPlan(goal: Goal, overrides: Partial<NonNullable<Goal['plan']>['linesOfOperation'][number]> = {}): Goal {
  return {
    ...goal,
    plan: {
      linesOfOperation: [
        {
          label: 'Line A',
          criticalPath: [{ label: 'Step one', status: 'pending' as const }],
          nextActions: [{ action: 'Call Priya', who: 'me', when: 'fri', status: 'pending' as const }],
          ...overrides,
        },
      ],
    },
  };
}

describe('changedLines', () => {
  it('reports an added next action', () => {
    const before = withPlan(stubGoal('Goal') as Goal, { nextActions: [] });
    const after = withPlan(stubGoal('Goal') as Goal);
    const diff = changedLines(before, after);
    expect(diff).toEqual([{ path: 'plan.linesOfOperation.0.nextActions.0', text: 'Call Priya' }]);
  });

  it('reports a status flip', () => {
    const before = withPlan(stubGoal('Goal') as Goal);
    const after = withPlan(stubGoal('Goal') as Goal, {
      nextActions: [{ action: 'Call Priya', who: 'me', when: 'fri', status: 'done' as const }],
    });
    const diff = changedLines(before, after);
    expect(diff).toEqual([{ path: 'plan.linesOfOperation.0.nextActions.0', text: 'Call Priya' }]);
  });

  it('includes an item newly flipped to dropped', () => {
    const before = withPlan(stubGoal('Goal') as Goal);
    const after = withPlan(stubGoal('Goal') as Goal, {
      nextActions: [{ action: 'Call Priya', who: 'me', when: 'fri', status: 'dropped' as const }],
    });
    const diff = changedLines(before, after);
    expect(diff).toEqual([{ path: 'plan.linesOfOperation.0.nextActions.0', text: 'Call Priya' }]);
  });

  it('is a no-op when nothing changed', () => {
    const goal = withPlan(stubGoal('Goal') as Goal);
    expect(changedLines(goal, goal)).toEqual([]);
  });

  it('orders by priority: next action, step, criterion, risk, person, decision', () => {
    const before = withPlan(stubGoal('Goal') as Goal, { nextActions: [], criticalPath: [] });
    const after: Goal = {
      ...withPlan(stubGoal('Goal') as Goal),
      successCriteria: [{ text: 'ship it', kind: 'control' as const }],
      riskNotes: [{ item: 'vendor lock-in', source: 'threat' as const, accepted: false }],
      people: [{ name: 'Priya', status: 'confirmed' as const, doing: 'intros' }],
      decisions: [{ date: '2026-01-01', status: 'decided' as const, choice: 'go with A', reverseIf: 'A fails' }],
    };
    const diff = changedLines(before, after);
    const buckets = diff.map((d) => d.path.split('.')[0]);
    expect(diff.find((d) => d.path.startsWith('plan.linesOfOperation.0.nextActions'))).toBeTruthy();
    expect(diff.find((d) => d.path.startsWith('plan.linesOfOperation.0.criticalPath'))).toBeTruthy();
    // next actions and steps (both under "plan") sort before successCriteria, riskNotes, people, decisions
    const planIdx = buckets.lastIndexOf('plan');
    const criteriaIdx = buckets.indexOf('successCriteria');
    const riskIdx = buckets.indexOf('riskNotes');
    const peopleIdx = buckets.indexOf('people');
    const decisionsIdx = buckets.indexOf('decisions');
    expect(planIdx).toBeLessThan(criteriaIdx);
    expect(criteriaIdx).toBeLessThan(riskIdx);
    expect(riskIdx).toBeLessThan(peopleIdx);
    expect(peopleIdx).toBeLessThan(decisionsIdx);
  });
});
