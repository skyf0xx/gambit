import { describe, it, expect } from 'vitest';
import { stubGoal } from '@gambit/core';
import { buildDoodleLayout, truncateLabel, isSparseGoal } from '../src/components/doodles/layout';
import type { Goal } from '../src/lib/types';

function richGoal(): Goal {
  const goal = stubGoal('Ship the launch plan for the new product') as Goal;
  return {
    ...goal,
    deadline: '2026-12-01',
    successCriteria: [
      { text: 'Launch on time with no critical bugs', kind: 'control' as const },
      { text: 'Reach 1000 signups in the first week', kind: 'influence' as const },
    ],
    criteriaStatus: [
      { text: 'Launch on time with no critical bugs', kind: 'control' as const, status: 'met' as const },
    ],
    people: [
      { name: 'Priya', status: 'confirmed' as const, doing: 'Engineering lead' },
      { name: 'Sam', status: 'tentative' as const, doing: 'Marketing' },
    ],
    stakeholders: [
      { name: 'Board', power: 'high' as const, stanceCurrent: 'neutral', stanceTarget: 'supportive', via: 'monthly update' },
    ],
    riskNotes: [
      { item: 'Board withdraws funding before launch date arrives', source: 'threat' as const, accepted: false, dependsOn: 'Board' },
      { item: 'No dependency risk', source: 'threat' as const, accepted: false },
    ],
    plan: {
      linesOfOperation: [
        {
          label: 'Build the core product experience end to end',
          criticalPath: [
            { label: 'Finish onboarding flow design', status: 'done' as const },
            { label: 'Ship backend API for signups', status: 'pending' as const },
            { label: 'Dropped step should not render', status: 'dropped' as const },
          ],
          nextActions: [
            { action: 'Review designs with Priya this week', who: 'me', when: 'fri', status: 'pending' as const },
            { action: 'Suggested: run a beta test', who: 'me', when: 'next week', status: 'proposed' as const },
            { action: 'Dropped action', who: 'me', when: 'fri', status: 'dropped' as const },
          ],
        },
        {
          label: 'Line B',
          criticalPath: [{ label: 'Step B1', status: 'pending' as const }],
          nextActions: [],
        },
      ],
    },
    log: [
      { date: '2026-09-01', focus: null, notes: [], focusLine: 'Ship backend API for signups' },
    ],
  };
}

describe('truncateLabel', () => {
  it('leaves short labels untouched', () => {
    const { label, truncated } = truncateLabel('Short label here');
    expect(label).toBe('Short label here');
    expect(truncated).toBe(false);
  });

  it('truncates at 6 words with an ellipsis', () => {
    const { label, truncated } = truncateLabel('One two three four five six seven eight');
    expect(truncated).toBe(true);
    expect(label).toBe('One two three four five six…');
  });
});

describe('isSparseGoal', () => {
  it('is sparse with no plan', () => {
    expect(isSparseGoal(stubGoal('Goal') as Goal)).toBe(true);
  });

  it('is not sparse with a plan that has lines', () => {
    expect(isSparseGoal(richGoal())).toBe(false);
  });
});

describe('buildDoodleLayout — empty state', () => {
  it('returns empty:true and no nodes for a sparse goal', () => {
    const layout = buildDoodleLayout(stubGoal('Goal') as Goal, { width: 800, height: 600, mode: 'radial' });
    expect(layout.empty).toBe(true);
    expect(layout.nodes).toHaveLength(0);
  });
});

describe('buildDoodleLayout — determinism', () => {
  it('produces identical node positions across repeated calls', () => {
    const goal = richGoal();
    const a = buildDoodleLayout(goal, { width: 800, height: 600, mode: 'radial' });
    const b = buildDoodleLayout(goal, { width: 800, height: 600, mode: 'radial' });
    expect(a.nodes).toEqual(b.nodes);
    expect(a.edges).toEqual(b.edges);
  });

  it('is also deterministic in tree mode', () => {
    const goal = richGoal();
    const a = buildDoodleLayout(goal, { width: 390, height: 800, mode: 'tree' });
    const b = buildDoodleLayout(goal, { width: 390, height: 800, mode: 'tree' });
    expect(a.nodes).toEqual(b.nodes);
  });
});

describe('buildDoodleLayout — dropped items', () => {
  it('excludes dropped steps and next actions', () => {
    const layout = buildDoodleLayout(richGoal(), { width: 800, height: 600, mode: 'radial' });
    const labels = layout.nodes.map((n) => n.fullLabel);
    expect(labels).not.toContain('Dropped step should not render');
    expect(labels).not.toContain('Dropped action');
  });
});

describe('buildDoodleLayout — jump paths', () => {
  it('gives the goal node the "goal" path', () => {
    const layout = buildDoodleLayout(richGoal(), { width: 800, height: 600, mode: 'radial' });
    const goalNode = layout.nodes.find((n) => n.kind === 'goal');
    expect(goalNode?.path).toBe('goal');
  });

  it('gives success criteria nodes successCriteria.N paths', () => {
    const layout = buildDoodleLayout(richGoal(), { width: 800, height: 600, mode: 'radial' });
    const crit = layout.nodes.filter((n) => n.kind === 'criteria');
    expect(crit.map((c) => c.path)).toEqual(['successCriteria.0', 'successCriteria.1']);
  });

  it('gives line-of-operation nodes plan.linesOfOperation.N paths', () => {
    const layout = buildDoodleLayout(richGoal(), { width: 800, height: 600, mode: 'radial' });
    const lines = layout.nodes.filter((n) => n.kind === 'line');
    expect(lines.map((l) => l.path)).toEqual(['plan.linesOfOperation.0', 'plan.linesOfOperation.1']);
  });

  it('gives step nodes the criticalPath index of the original (undropped) array', () => {
    const layout = buildDoodleLayout(richGoal(), { width: 800, height: 600, mode: 'radial' });
    const step = layout.nodes.find((n) => n.fullLabel === 'Ship backend API for signups');
    expect(step?.path).toBe('plan.linesOfOperation.0.criticalPath.1');
  });

  it('gives next-action nodes the nextActions index of the original array', () => {
    const layout = buildDoodleLayout(richGoal(), { width: 800, height: 600, mode: 'radial' });
    const action = layout.nodes.find((n) => n.fullLabel === 'Review designs with Priya this week');
    expect(action?.path).toBe('plan.linesOfOperation.0.nextActions.0');
  });

  it('gives people/stakeholder nodes their array paths', () => {
    const layout = buildDoodleLayout(richGoal(), { width: 800, height: 600, mode: 'radial' });
    const priya = layout.nodes.find((n) => n.fullLabel === 'Priya');
    const board = layout.nodes.find((n) => n.fullLabel === 'Board');
    expect(priya?.path).toBe('people.0');
    expect(board?.path).toBe('stakeholders.0');
  });

  it('gives risk nodes riskNotes.N paths', () => {
    const layout = buildDoodleLayout(richGoal(), { width: 800, height: 600, mode: 'radial' });
    const risk = layout.nodes.find((n) => n.kind === 'risk');
    expect(risk?.path).toBe('riskNotes.0');
  });
});

describe('buildDoodleLayout — truncation and data-note', () => {
  it('truncates a long line label and keeps the full text available', () => {
    const layout = buildDoodleLayout(richGoal(), { width: 800, height: 600, mode: 'radial' });
    const line = layout.nodes.find((n) => n.fullLabel === 'Build the core product experience end to end');
    expect(line?.truncated).toBe(true);
    expect(line?.label).toBe('Build the core product experience end…');
  });

  it('truncates a long risk item label', () => {
    const layout = buildDoodleLayout(richGoal(), { width: 800, height: 600, mode: 'radial' });
    const risk = layout.nodes.find((n) => n.kind === 'risk');
    expect(risk?.truncated).toBe(true);
    expect(risk?.fullLabel).toBe('Board withdraws funding before launch date arrives');
  });
});

describe('buildDoodleLayout — status and focus', () => {
  it('marks a done step with status "done"', () => {
    const layout = buildDoodleLayout(richGoal(), { width: 800, height: 600, mode: 'radial' });
    const step = layout.nodes.find((n) => n.fullLabel === 'Finish onboarding flow design');
    expect(step?.status).toBe('done');
  });

  it('marks a proposed next action with status "proposed"', () => {
    const layout = buildDoodleLayout(richGoal(), { width: 800, height: 600, mode: 'radial' });
    const action = layout.nodes.find((n) => n.fullLabel === 'Suggested: run a beta test');
    expect(action?.status).toBe('proposed');
  });

  it('marks a met success criterion with status "met"', () => {
    const layout = buildDoodleLayout(richGoal(), { width: 800, height: 600, mode: 'radial' });
    const crit = layout.nodes.find((n) => n.fullLabel === 'Launch on time with no critical bugs');
    expect(crit?.status).toBe('met');
  });

  it('flags the line of operation containing the current focusLine', () => {
    const layout = buildDoodleLayout(richGoal(), { width: 800, height: 600, mode: 'radial' });
    const lineA = layout.nodes.find((n) => n.fullLabel === 'Build the core product experience end to end');
    const lineB = layout.nodes.find((n) => n.fullLabel === 'Line B');
    expect(lineA?.isFocusLine).toBe(true);
    expect(lineB?.isFocusLine).toBeFalsy();
  });

  it('flags the first pending step on the focus line', () => {
    const layout = buildDoodleLayout(richGoal(), { width: 800, height: 600, mode: 'radial' });
    const step = layout.nodes.find((n) => n.fullLabel === 'Ship backend API for signups');
    expect(step?.isFirstPendingOnFocus).toBe(true);
  });
});

describe('buildDoodleLayout — risk arrows', () => {
  it('creates a risk-arrow edge from a risk with dependsOn to its person/stakeholder node', () => {
    const layout = buildDoodleLayout(richGoal(), { width: 800, height: 600, mode: 'radial' });
    const risk = layout.nodes.find((n) => n.kind === 'risk')!;
    const board = layout.nodes.find((n) => n.fullLabel === 'Board')!;
    const edge = layout.edges.find((e) => e.kind === 'risk-arrow' && e.fromId === risk.id);
    expect(edge?.toId).toBe(board.id);
  });

  it('creates no risk-arrow edge for a risk without dependsOn', () => {
    const layout = buildDoodleLayout(richGoal(), { width: 800, height: 600, mode: 'radial' });
    const risks = layout.nodes.filter((n) => n.kind === 'risk');
    expect(risks).toHaveLength(1); // only the one with dependsOn resolved gets a node
  });
});
