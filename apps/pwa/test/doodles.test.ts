import { describe, it, expect } from 'vitest';
import { stubGoal } from '@gambit/core';
import { buildDoodleTree, toMarkmap } from '../src/components/doodles/tree';
import type { Goal } from '../src/lib/types';

function richGoal(): Goal {
  const g = stubGoal('Ship the thing') as Goal;
  return {
    ...g,
    successCriteria: [{ text: 'Launched', kind: 'control' }],
    criteriaStatus: [{ text: 'Launched', status: 'met' }],
    people: [{ name: 'Priya', status: 'confirmed', doing: 'runs the rollout' }],
    riskNotes: [
      { item: 'Priya leaves <early>', source: 'threat', accepted: false, dependsOn: 'Priya' },
      { item: 'Unrelated risk', source: 'threat', accepted: false },
    ],
    plan: {
      linesOfOperation: [
        {
          label: 'Line A',
          criticalPath: [{ id: 'one', label: 'Step one', after: ['ship'] }],
          nextActions: [
            { id: 'ship', action: 'Ship it', who: 'me', when: '2026-10-09', status: 'pending' },
            { action: 'Maybe this', who: 'me', when: '2026-10-09', status: 'proposed' },
          ],
        },
      ],
    },
    log: [{ date: '2026-01-01', focus: 'ship', notes: ['n'], focusLine: 'Ship it' }],
  } as Goal;
}

describe('buildDoodleTree', () => {
  it('is null until the goal has a plan', () => {
    expect(buildDoodleTree(stubGoal('Goal') as Goal)).toBeNull();
  });

  it('puts lines, criteria and people under the goal', () => {
    const tree = buildDoodleTree(richGoal())!;
    expect(tree.path).toBe('goal');
    expect(tree.children.map((c) => c.label)).toEqual(['Line A', 'Done looks like', 'People']);
  });

  it('keeps pending, done and proposed items, and leaves dropped ones out', () => {
    const line = buildDoodleTree(richGoal())!.children[0];
    expect(line.children.map((c) => c.label)).toEqual(['Step one', 'Ship it', 'Maybe this']);
    expect(line.children[0].done).toBe(false);
    expect(line.children[1].focus).toBe(true);
    expect(line.children[2].proposed).toBe(true);
    expect(line.children[1].path).toBe('plan.linesOfOperation.0.nextActions.0');
  });

  it('ticks a met criterion and hangs a risk under the person it depends on', () => {
    const [, criteria, people] = buildDoodleTree(richGoal())!.children;
    expect(criteria.children[0].done).toBe(true);
    expect(people.children[0].children.map((r) => r.path)).toEqual(['riskNotes.0']);
  });
});

describe('toMarkmap', () => {
  it('escapes label text, since markmap inserts content as HTML', () => {
    const people = toMarkmap(buildDoodleTree(richGoal())!).children[2];
    const risk = people.children[0].children[0].content;
    expect(risk).toContain('Risk: Priya leaves &#60;early&#62;');
    expect(risk).not.toContain('<early>');
    expect(risk).toContain('data-goto="riskNotes.0"');
  });

  it('prefixes a done item, and a milestone its tasks reached, with a tick', () => {
    expect(toMarkmap(buildDoodleTree(richGoal())!).children[0].children[0].content).not.toContain('✓');
    const g = richGoal();
    g.plan!.linesOfOperation[0].nextActions[0].status = 'done';
    const line = toMarkmap(buildDoodleTree(g)!).children[0];
    expect(line.children[0].content).toContain('✓ Step one');
    expect(line.children[1].content).toContain('✓ Ship it');
  });
});
