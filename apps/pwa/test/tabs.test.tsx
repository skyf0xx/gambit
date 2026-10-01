import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { stubGoal } from '@gambit/core';
import { tabForPath, tabHasContent, TAB_ORDER, TAB_SECTION_KEYS } from '../src/components/tabs/tabDefs';
import { GoalTab } from '../src/components/tabs/GoalTab';
import { MovesTab } from '../src/components/tabs/MovesTab';
import { PeopleTab } from '../src/components/tabs/PeopleTab';
import { RisksTab } from '../src/components/tabs/RisksTab';
import { BetsTab } from '../src/components/tabs/BetsTab';
import { CapacityTab } from '../src/components/tabs/CapacityTab';
import { LogsTab } from '../src/components/tabs/LogsTab';
import { InsideCoverTab } from '../src/components/tabs/InsideCoverTab';
import type { Goal } from '../src/lib/types';

// Same seeded-goal approach as page.test.tsx: a v2 goal exercising every
// tab's content, rendered with react-dom/server (this repo's test
// environment is 'node', not jsdom) so these are markup/logic assertions,
// not DOM interaction tests.
function seededGoal(): Goal {
  const g = stubGoal('Ship the thing') as Goal;
  return {
    ...g,
    successCriteria: [{ text: 'Launched', kind: 'control' }],
    people: [{ name: 'Priya', status: 'confirmed', doing: 'runs the rollout' }],
    stakeholders: [{ name: 'Marcus', power: 'high', stanceCurrent: 'skeptical', stanceTarget: 'onboard', via: 'a demo' }],
    riskNotes: [{ item: 'Vendor slips the date', source: 'threat', accepted: false }],
    exposure: [{ item: 'Personal guarantee on the lease', status: 'open' }],
    decisions: [{ date: '2026-01-01', status: 'decided', choice: 'Go with vendor A', because: 'cheaper', reverseIf: 'price doubles' }],
    experiments: [{ assumption: 'Users want X', test: 'landing page', passIf: '5% signup', by: '2026-02-01', done: false }],
    forecasts: [{ statement: 'We ship by March', probability: 60, resolvesBy: '2026-03-01', resolvesVia: 'launch date', resolved: false }],
    systemsNotes: { schwerpunkt: 'Distribution', confidence: 'moderate', topFindings: [], lastReviewed: '2026-01-01' },
    capacity: { availableHrsPerWeek: 10, runway: '6 months', lastReviewed: '2026-01-01' },
    criteriaStatus: [{ text: 'Launched', kind: 'control', status: 'on_track' }],
    plan: {
      linesOfOperation: [
        {
          label: 'Line A',
          criticalPath: [{ label: 'Step one', status: 'pending' }],
          nextActions: [{ action: 'Ship it', who: 'me', when: 'fri', status: 'pending' }],
        },
      ],
    },
    log: [
      { date: '2026-01-01', focus: null, notes: ['entry 1'] },
      { date: '2026-01-02', focus: null, notes: ['entry 2'] },
      { date: '2026-01-03', focus: null, notes: ['entry 3'] },
      { date: '2026-01-04', focus: null, notes: ['entry 4'] },
      { date: '2026-01-05', focus: null, notes: ['entry 5'] },
      { date: '2026-01-06', focus: null, notes: ['entry 6'] },
    ],
    subGoals: ['Without burning out the team'],
  };
}

describe('tabForPath', () => {
  it('routes plan paths to moves and criteriaStatus to goal', () => {
    expect(tabForPath('plan.linesOfOperation.0.nextActions.2')).toBe('moves');
    expect(tabForPath('criteriaStatus.0')).toBe('goal');
  });

  it('routes goal, successCriteria and subGoals paths to the goal tab', () => {
    expect(tabForPath('goal')).toBe('goal');
    expect(tabForPath('successCriteria.0')).toBe('goal');
    expect(tabForPath('subGoals.0')).toBe('goal');
  });

  it('routes the special inside-cover path to the inside-cover tab', () => {
    expect(tabForPath('inside-cover')).toBe('inside-cover');
  });

  it('routes people and stakeholders paths to people', () => {
    expect(tabForPath('people.0')).toBe('people');
    expect(tabForPath('stakeholders.1')).toBe('people');
  });

  it('routes riskNotes and exposure paths to risks', () => {
    expect(tabForPath('riskNotes.1')).toBe('risks');
    expect(tabForPath('exposure.0')).toBe('risks');
  });

  it('routes decisions, experiments, forecasts, systemsNotes to bets', () => {
    expect(tabForPath('decisions.0')).toBe('bets');
    expect(tabForPath('experiments.0')).toBe('bets');
    expect(tabForPath('forecasts.0')).toBe('bets');
    expect(tabForPath('systemsNotes')).toBe('bets');
  });

  it('routes capacity paths to capacity', () => {
    expect(tabForPath('capacity')).toBe('capacity');
    expect(tabForPath('log.0')).toBe('inside-cover');
  });

  it('falls back an unrecognized or empty path to moves', () => {
    expect(tabForPath('')).toBe('moves');
    expect(tabForPath('somethingUnknown.0')).toBe('moves');
  });
});

describe('tabHasContent', () => {
  const empty = stubGoal('Empty') as Goal;
  const full = seededGoal();

  it('goal, moves and inside-cover always show, even on a stub goal', () => {
    expect(tabHasContent('goal', empty)).toBe(true);
    expect(tabHasContent('moves', empty)).toBe(true);
    expect(tabHasContent('inside-cover', empty)).toBe(true);
  });

  it('doodles shows once the plan has a line to draw', () => {
    expect(tabHasContent('doodles', empty)).toBe(false);
    expect(tabHasContent('doodles', full)).toBe(true);
  });

  it('people/risks/bets/capacity are hidden on a stub goal', () => {
    expect(tabHasContent('people', empty)).toBe(false);
    expect(tabHasContent('risks', empty)).toBe(false);
    expect(tabHasContent('bets', empty)).toBe(false);
    expect(tabHasContent('capacity', empty)).toBe(false);
  });

  it('every tab shows once its keys are populated', () => {
    for (const tab of TAB_ORDER) expect(tabHasContent(tab, full)).toBe(true);
  });

  it('every declared tab section key exists in the schema-default stub without crashing isEmpty checks', () => {
    for (const keys of Object.values(TAB_SECTION_KEYS)) {
      for (const k of keys ?? []) expect(k in empty).toBe(true);
    }
  });
});

function render(el: React.ReactElement) {
  return renderToStaticMarkup(el);
}

describe('tab content components render the right lines', () => {
  const g = seededGoal();

  it('MovesTab shows the plan, and leaves progress to Goal and the log to Settings', () => {
    const html = render(<MovesTab g={g} goalId="g1" />);
    expect(html).toContain('data-line="plan.linesOfOperation.0.nextActions.0"');
    expect(html).not.toContain('data-line="criteriaStatus.0"');
    expect(html).not.toContain('History');
    expect(html).not.toContain('entry 6');
  });

  it('the log shows whole, newest first', () => {
    const html = render(<LogsTab g={g} />);
    expect(html).toContain('History');
    expect(html).toContain('entry 1');
    expect(html.indexOf('entry 6')).toBeLessThan(html.indexOf('entry 1'));
  });

  it('MovesTab does not render the goal title, people, risk, or capacity content', () => {
    const html = render(<MovesTab g={g} goalId="g1" />);
    expect(html).not.toContain('data-line="goal"');
    expect(html).not.toContain('data-line="people.0"');
    expect(html).not.toContain('data-line="riskNotes.0"');
  });

  it('GoalTab shows the goal title, successCriteria, and subGoals', () => {
    const html = render(<GoalTab g={g} goalId="g1" />);
    expect(html).toContain('data-line="goal"');
    expect(html).toContain('Ship the thing');
    expect(html).toContain('data-line="successCriteria.0"');
    expect(html).toContain('Launched');
    expect(html).toContain('data-line="subGoals.0"');
    expect(html).toContain('Without burning out the team');
  });

  it('GoalTab reads progress onto its criterion instead of listing it twice', () => {
    const html = render(<GoalTab g={g} goalId="g1" />);
    expect(html).not.toContain('data-line="criteriaStatus.0"');
    const stalled = render(<GoalTab g={{ ...g, criteriaStatus: [{ ...g.criteriaStatus[0], status: 'stalled' }] }} goalId="g1" />);
    expect(stalled).toContain('stalled');
    const met = render(<GoalTab g={{ ...g, criteriaStatus: [{ ...g.criteriaStatus[0], status: 'met' }] }} goalId="g1" />);
    expect(met).toContain('data-box="successCriteria.0"');
  });

  it('GoalTab lists a scored line that matches no criterion under Progress', () => {
    const html = render(<GoalTab g={{ ...g, criteriaStatus: [{ text: 'Something else', kind: 'control', status: 'on_track' }] }} goalId="g1" />);
    expect(html).toContain('data-line="criteriaStatus.0"');
  });

  it('GoalTab renders nothing for subGoals when the goal has none', () => {
    const html = render(<GoalTab g={{ ...g, subGoals: undefined }} goalId="g1" />);
    expect(html).not.toContain('data-line="subGoals.');
  });

  it('InsideCoverTab renders its page sections', () => {
    // DataPanel (nested under "Keep it safe") checks `window` for File
    // System Access support at render time; this repo's test environment
    // is 'node' (see vite.config.ts), which has no `window` global at all,
    // so this static-render test stubs the one property it reads rather
    // than pulling in jsdom just for this one page.
    const hadWindow = 'window' in globalThis;
    const prevWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {};
    try {
      const html = render(<InsideCoverTab goalId="g1" goals={[]} />);
      expect(html).toContain('Notebooks');
      expect(html).toContain('Model');
      expect(html).toContain('Backup');
      expect(html).toContain('Chat');
      expect(html).toContain('New goal');
    } finally {
      if (hadWindow) (globalThis as { window?: unknown }).window = prevWindow;
      else delete (globalThis as { window?: unknown }).window;
    }
  });

  it('PeopleTab shows people and stakeholders only', () => {
    const html = render(<PeopleTab g={g} goalId="g1" />);
    expect(html).toContain('data-line="people.0"');
    expect(html).toContain('data-line="stakeholders.0"');
    expect(html).not.toContain('data-line="riskNotes.0"');
  });

  it('RisksTab shows riskNotes and exposure', () => {
    const html = render(<RisksTab g={g} goalId="g1" />);
    expect(html).toContain('data-line="riskNotes.0"');
    expect(html).toContain('data-line="exposure.0"');
  });

  it('BetsTab shows decisions, experiments, forecasts, and systemsNotes', () => {
    const html = render(<BetsTab g={g} goalId="g1" />);
    // A settled decision folds into a "1 decided" line; open bets show.
    expect(html).not.toContain('data-line="decisions.0"');
    expect(html).toContain('1 decided');
    expect(html).toContain('data-line="experiments.0"');
    expect(html).toContain('data-line="forecasts.0"');
    expect(html).toContain('Distribution');
  });

  it('BetsTab leaves out an empty section and the old how-to note', () => {
    const html = render(<BetsTab g={{ ...g, systemsNotes: null } as Goal} goalId="g1" />);
    expect(html).not.toContain('Where the leverage is');
    expect(html).not.toContain('tell the chat what happened');
  });

  it('CapacityTab shows capacity', () => {
    const html = render(<CapacityTab g={g} goalId="g1" />);
    expect(html).toContain('Hours a week');
    expect(html).toContain('>10<');
    expect(html).toContain('6 months');
  });
});
