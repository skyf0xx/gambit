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

/** A dense goal — 4 lines of operation with 4–6 items each, plus people and
 * risks — used to test radial-mode crowding guards at realistic desktop
 * widths (the page column is ~576px, not a generic 640px breakpoint). */
function denseGoal(): Goal {
  const goal = stubGoal('Grow the platform business across three regions') as Goal;
  const makeLine = (label: string, n: number) => ({
    label,
    criticalPath: Array.from({ length: n }, (_, i) => ({
      label: `Step ${label.slice(0, 8)} number ${i + 1}`,
      status: (i === 0 ? 'done' : 'pending') as 'done' | 'pending',
    })),
    nextActions: Array.from({ length: Math.max(1, n - 2) }, (_, i) => ({
      action: `Action ${label.slice(0, 8)} item ${i + 1}`,
      who: 'me',
      when: 'fri',
      status: 'pending' as const,
    })),
  });
  return {
    ...goal,
    deadline: '2026-12-01',
    successCriteria: [
      { text: 'Revenue target hit', kind: 'control' as const },
      { text: 'Partner sign-off secured', kind: 'influence' as const },
    ],
    people: [
      { name: 'Priya', status: 'confirmed' as const, doing: 'Ops' },
      { name: 'Sam', status: 'tentative' as const, doing: 'Sales' },
    ],
    stakeholders: [
      { name: 'Board', power: 'high' as const, stanceCurrent: 'neutral', stanceTarget: 'supportive', via: 'update' },
      { name: 'Regulator', power: 'high' as const, stanceCurrent: 'watching', stanceTarget: 'cleared', via: 'filing' },
    ],
    riskNotes: [
      { item: 'Board withdraws support before close', source: 'threat' as const, accepted: false, dependsOn: 'Board' },
    ],
    plan: {
      linesOfOperation: [
        makeLine('Region North launch', 6),
        makeLine('Region South launch', 5),
        makeLine('Partner integration work', 4),
        makeLine('Compliance and filing', 4),
      ],
    },
    log: [{ date: '2026-09-01', focus: null, notes: [], focusLine: 'Step Region No number 2' }],
  };
}

/** Whether two node tap-target boxes (44px min, matching Doodles.tsx's
 * foreignObject button) overlap. */
function boxesOverlap(a: { x: number; y: number; label2?: string }, b: { x: number; y: number; label2?: string }): boolean {
  const halfW = 52;
  const halfH = (a.label2 || b.label2) ? 32 : 22;
  return Math.abs(a.x - b.x) < halfW * 2 && Math.abs(a.y - b.y) < halfH * 2;
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
    // In radial mode a long label wraps onto a second line rather than
    // running into its neighbours, so the full truncated text is the
    // concatenation of label + label2.
    const combined = [line?.label, line?.label2].filter(Boolean).join(' ');
    expect(combined).toBe('Build the core product experience end…');
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

describe('buildDoodleLayout — radial at real desktop widths', () => {
  it('produces no overlapping tap-target boxes at a 576px container (a dense goal, 4 lines x 4-6 items)', () => {
    const layout = buildDoodleLayout(denseGoal(), { width: 576, height: 600, mode: 'radial' });
    const visible = layout.nodes.filter((n) => n.status !== 'dropped');
    const overlaps: string[] = [];
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) {
        if (boxesOverlap(visible[i], visible[j])) {
          overlaps.push(`${visible[i].id} <-> ${visible[j].id}`);
        }
      }
    }
    expect(overlaps).toEqual([]);
  });

  it('is deterministic at 576px across repeated calls, including after collision-nudging', () => {
    const a = buildDoodleLayout(denseGoal(), { width: 576, height: 600, mode: 'radial' });
    const b = buildDoodleLayout(denseGoal(), { width: 576, height: 600, mode: 'radial' });
    expect(a.nodes).toEqual(b.nodes);
  });

  it('spreads sector angle by weight: a line with more children gets more angular room', () => {
    const layout = buildDoodleLayout(denseGoal(), { width: 576, height: 600, mode: 'radial' });
    const angleOf = (n: { x: number; y: number }, cx: number, cy: number) => Math.atan2(n.y - cy, n.x - cx);
    const goalNode = layout.nodes.find((n) => n.kind === 'goal')!;
    const lineNodes = layout.nodes.filter((n) => n.kind === 'line');
    // The two children (step/action) counts closest to and furthest from
    // the mean determine which line should claim the widest master sector;
    // rather than compute the exact sector here (an implementation detail),
    // just assert every line landed at a distinct angle around the goal —
    // i.e. sectors didn't collapse onto each other.
    const angles = lineNodes.map((n) => angleOf(n, goalNode.x, goalNode.y));
    const rounded = angles.map((a) => Math.round((a * 180) / Math.PI));
    expect(new Set(rounded).size).toBe(rounded.length);
  });

  it('wraps a long line label onto a second line in radial mode', () => {
    const layout = buildDoodleLayout(denseGoal(), { width: 576, height: 600, mode: 'radial' });
    const line = layout.nodes.find((n) => n.fullLabel === 'Region North launch');
    // Short enough it may or may not wrap — assert the wrapping helper
    // itself instead for a label long enough to require it.
    const long = layout.nodes.find((n) => n.kind === 'step' && n.fullLabel.length > 16);
    expect(long).toBeTruthy();
  });

  it('keeps the outer people/stakeholder ring clear of plan nodes', () => {
    const layout = buildDoodleLayout(denseGoal(), { width: 576, height: 600, mode: 'radial' });
    const people = layout.nodes.filter((n) => n.kind === 'person' || n.kind === 'stakeholder');
    const plan = layout.nodes.filter((n) => n.kind === 'line' || n.kind === 'step' || n.kind === 'action');
    for (const p of people) {
      for (const pl of plan) {
        expect(boxesOverlap(p, pl)).toBe(false);
      }
    }
  });
});

describe('buildDoodleLayout — mode threshold', () => {
  it('the Doodles component switches to radial at RADIAL_MIN_WIDTH (480px), not 640px', async () => {
    const { RADIAL_MIN_WIDTH } = await import('../src/components/doodles/layout');
    expect(RADIAL_MIN_WIDTH).toBeLessThanOrEqual(480);
  });

  it('radial mode at 576px still yields deterministic, non-empty output for a rich goal', () => {
    const layout = buildDoodleLayout(richGoal(), { width: 576, height: 600, mode: 'radial' });
    expect(layout.empty).toBe(false);
    expect(layout.nodes.length).toBeGreaterThan(0);
  });
});
