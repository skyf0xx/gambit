import { describe, it, expect } from 'vitest';
import { stubGoal } from '@gambit/core';
import { buildDoodleMap } from '../src/components/doodles/tree';
import type { Goal } from '../src/lib/types';

const DAY = '2026-10-08';

function richGoal(): Goal {
  const g = stubGoal('Ship the thing') as Goal;
  return {
    ...g,
    people: [{ name: 'Priya', status: 'confirmed', doing: 'runs the rollout' }],
    riskNotes: [{ item: 'Priya leaves early', source: 'threat', accepted: false, dependsOn: 'Priya' }],
    plan: {
      linesOfOperation: [
        {
          label: 'Line A',
          focus: true,
          criticalPath: [
            { id: 'one', label: 'Step one', after: ['ship'] },
            { id: 'two', label: 'Step two', after: ['tell'] },
          ],
          nextActions: [
            { id: 'tell', action: 'Tell Priya', who: 'me', status: 'pending', to: 'Priya', after: ['one'] },
            { id: 'ship', action: 'Ship it', who: 'me', when: '2026-10-09', status: 'done', doneOn: '2026-10-01' },
            { action: 'Maybe this', who: 'me', status: 'proposed' },
            { action: 'Gone', who: 'me', status: 'dropped' },
            { id: 'nudge', action: 'Nudge Priya', who: 'me', status: 'pending', to: 'Priya', level: 'interests', if: { noReply: 'tell', days: 3 } },
            { action: 'Rethink the approach', who: 'me', status: 'pending', if: { event: 'no progress by November', by: '2026-11-01' } },
          ],
        },
        {
          label: 'Line B',
          criticalPath: [],
          nextActions: [{ id: 'demo', action: 'Run the demo', who: 'me', status: 'pending', after: ['ship'] }],
        },
      ],
    },
    log: [{ date: '2026-01-01', focus: 'ship', notes: ['n'], focusLine: 'Tell Priya' }],
  } as Goal;
}

describe('buildDoodleMap', () => {
  it('is null until the goal has a plan', () => {
    expect(buildDoodleMap(stubGoal('Goal') as Goal, DAY)).toBeNull();
  });

  it('draws one column per line under the goal, and no people or risks of their own', () => {
    const map = buildDoodleMap(richGoal(), DAY)!;
    expect(map.goal).toBe('Ship the thing');
    expect(map.columns.map((c) => c.label)).toEqual(['Line A', 'Line B']);
    expect(map.columns[0].focus).toBe(true);
  });

  it('stacks a line from the ground up: each stretch, then the milestone it reaches', () => {
    const [a] = buildDoodleMap(richGoal(), DAY)!.columns;
    expect(a.nodes.map((n) => n.label)).toEqual(['Ship it', 'Step one', 'Tell Priya', 'Maybe this', 'Step two']);
    expect(a.nodes[1]).toMatchObject({ kind: 'milestone', state: 'done' });
    expect(a.nodes[4]).toMatchObject({ kind: 'milestone', state: 'live' });
    expect(a.nodes[3].state).toBe('proposed');
  });

  it('names who a message goes to, and hangs its waiting escalation off it', () => {
    const tell = buildDoodleMap(richGoal(), DAY)!.columns[0].nodes[2];
    expect(tell).toMatchObject({ to: 'Priya', focus: true, path: 'plan.linesOfOperation.0.nextActions.0' });
    expect(tell.chain).toEqual([{ path: 'plan.linesOfOperation.0.nextActions.4', days: 3, action: 'Nudge Priya' }]);
  });

  it('shows a message that went out unanswered as awaiting a reply', () => {
    const g = richGoal();
    g.plan!.linesOfOperation[0].nextActions[0].status = 'done';
    const tell = buildDoodleMap(g, DAY)!.columns[0].nodes.find((n) => n.label === 'Tell Priya')!;
    expect(tell.state).toBe('awaiting');
  });

  it('puts a fork no milestone lists under "if things change", its move in lower case after "then"', () => {
    const [a] = buildDoodleMap(richGoal(), DAY)!.columns;
    expect(a.forks).toHaveLength(1);
    expect(a.forks[0]).toMatchObject({ kind: 'fork', label: 'rethink the approach', condition: 'no progress by November' });
  });

  it('links a task to what it waits on in another line, not within its own', () => {
    expect(buildDoodleMap(richGoal(), DAY)!.links).toEqual([
      { from: 'plan.linesOfOperation.0.nextActions.1', to: 'plan.linesOfOperation.1.nextActions.0' },
    ]);
  });
});
