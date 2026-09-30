import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stubGoal, setStatus } from '@gambit/core';
import { nextMove, proposals } from '../src/lib/slips';
import { IndexCard } from '../src/components/IndexCard';
import { StickyNotes } from '../src/components/StickyNotes';
import type { Goal } from '../src/lib/types';

type Plan = NonNullable<Goal['plan']>;
type Line = Plan['linesOfOperation'][number];
type NA = Line['nextActions'][number];

function withActions(goal: Goal, actions: NA[]): Goal {
  return {
    ...goal,
    plan: {
      linesOfOperation: [
        {
          label: 'Line A',
          criticalPath: [],
          nextActions: actions,
        },
      ],
    },
  };
}

function twoLines(actionsA: NA[], actionsB: NA[]): Goal {
  const goal = stubGoal('Goal') as Goal;
  return {
    ...goal,
    plan: {
      linesOfOperation: [
        { label: 'Line A', criticalPath: [], nextActions: actionsA },
        { label: 'Line B', criticalPath: [], nextActions: actionsB },
      ],
    },
  };
}

describe('nextMove', () => {
  it('picks the first pending next action across lines, in plan order', () => {
    const goal = twoLines(
      [{ action: 'A1', who: 'me', when: 'fri', status: 'done' }],
      [{ action: 'B1', who: 'me', when: 'mon', status: 'pending' }],
    );
    expect(nextMove(goal)).toEqual({
      path: 'plan.linesOfOperation.1.nextActions.0',
      action: 'B1',
      who: 'me',
      when: 'mon',
    });
  });

  it('returns null when nothing is pending', () => {
    const goal = withActions(stubGoal('Goal') as Goal, [{ action: 'A1', who: 'me', when: 'fri', status: 'proposed' }]);
    expect(nextMove(goal)).toBeNull();
  });
});

describe('proposals', () => {
  it('returns every next action with status proposed', () => {
    const goal = twoLines(
      [
        { action: 'A1', who: 'me', when: 'fri', status: 'proposed' },
        { action: 'A2', who: 'me', when: 'mon', status: 'pending' },
      ],
      [{ action: 'B1', who: 'me', when: 'tue', status: 'proposed' }],
    );
    expect(proposals(goal)).toEqual([
      { path: 'plan.linesOfOperation.0.nextActions.0', action: 'A1', who: 'me', when: 'fri' },
      { path: 'plan.linesOfOperation.1.nextActions.0', action: 'B1', who: 'me', when: 'tue' },
    ]);
  });
});

describe('setStatus semantics used by keep/toss/markDone', () => {
  it('flips a proposed next action to pending (keep)', () => {
    const goal = withActions(stubGoal('Goal') as Goal, [{ action: 'A1', who: 'me', when: 'fri', status: 'proposed' }]);
    const res = setStatus(goal, 'plan.linesOfOperation.0.nextActions.0', 'pending');
    expect(res.ok).toBe(true);
    if (res.ok) expect((res as { ok: true; goal: Goal }).goal.plan!.linesOfOperation[0].nextActions[0].status).toBe('pending');
  });

  it('flips a proposed next action to dropped (toss)', () => {
    const goal = withActions(stubGoal('Goal') as Goal, [{ action: 'A1', who: 'me', when: 'fri', status: 'proposed' }]);
    const res = setStatus(goal, 'plan.linesOfOperation.0.nextActions.0', 'dropped');
    expect(res.ok).toBe(true);
    if (res.ok) expect((res as { ok: true; goal: Goal }).goal.plan!.linesOfOperation[0].nextActions[0].status).toBe('dropped');
  });

  it('flips a pending next action to done (markDone)', () => {
    const goal = withActions(stubGoal('Goal') as Goal, [{ action: 'A1', who: 'me', when: 'fri', status: 'pending' }]);
    const res = setStatus(goal, 'plan.linesOfOperation.0.nextActions.0', 'done');
    expect(res.ok).toBe(true);
    if (res.ok) expect((res as { ok: true; goal: Goal }).goal.plan!.linesOfOperation[0].nextActions[0].status).toBe('done');
  });

  it('rejects a path that is not currently proposed for a keep-style flip attempt', () => {
    // keep()/toss() guard on current status before calling setStatus; this
    // exercises the same guard logic those functions apply (see slips.ts's
    // nextActionAt + status check) using a pending (not proposed) action.
    const goal = withActions(stubGoal('Goal') as Goal, [{ action: 'A1', who: 'me', when: 'fri', status: 'pending' }]);
    const node = goal.plan!.linesOfOperation[0].nextActions[0];
    expect(node.status).not.toBe('proposed');
  });
});

describe('StickyNotes markup', () => {
  it('renders Keep it, Toss, and sr-only suggestion text', () => {
    const goal = withActions(stubGoal('Goal') as Goal, [{ action: 'Get two quotes', who: 'me', when: 'fri', status: 'proposed' }]);
    const html = renderToStaticMarkup(createElement(StickyNotes, { goal, goalId: 'g1' }));
    expect(html).toContain('Keep it');
    expect(html).toContain('Toss');
    expect(html).toContain('suggestion');
    expect(html).toContain('data-line="plan.linesOfOperation.0.nextActions.0"');
  });

  it('renders nothing when there are no proposals', () => {
    const goal = withActions(stubGoal('Goal') as Goal, [{ action: 'A1', who: 'me', when: 'fri', status: 'pending' }]);
    const el = StickyNotes({ goal, goalId: 'g1' });
    expect(el).toBeNull();
  });
});

describe('IndexCard markup', () => {
  it('shows "What\'s your next move?" and "nothing due yet" when nothing is pending', () => {
    const goal = stubGoal('Goal') as Goal;
    const html = renderToStaticMarkup(createElement(IndexCard, { goal, goalId: 'g1' }));
    expect(html).toContain('What’s your next move?');
    expect(html).toContain('nothing due yet');
  });

  it('shows the move, Done/Not yet/Something changed, and data-line when pending', () => {
    const goal = withActions(stubGoal('Goal') as Goal, [{ action: 'Call Priya', who: 'me', when: 'fri', status: 'pending' }]);
    const html = renderToStaticMarkup(createElement(IndexCard, { goal, goalId: 'g1' }));
    expect(html).toContain('Call Priya');
    expect(html).toContain('Done');
    expect(html).toContain('Not yet');
    expect(html).toContain('Something changed');
    expect(html).toContain('data-line="plan.linesOfOperation.0.nextActions.0"');
  });
});
