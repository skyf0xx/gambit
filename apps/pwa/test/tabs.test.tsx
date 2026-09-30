import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { stubGoal } from '@gambit/core';
import { tabForPath, tabHasContent, TAB_ORDER, TAB_SECTION_KEYS } from '../src/components/tabs/tabDefs';
import { MovesTab } from '../src/components/tabs/MovesTab';
import { PeopleTab } from '../src/components/tabs/PeopleTab';
import { RisksTab } from '../src/components/tabs/RisksTab';
import { ChoicesTab } from '../src/components/tabs/ChoicesTab';
import { CapacityTab } from '../src/components/tabs/CapacityTab';
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
  };
}

describe('tabForPath', () => {
  it('routes plan and criteriaStatus paths to moves', () => {
    expect(tabForPath('plan.linesOfOperation.0.nextActions.2')).toBe('moves');
    expect(tabForPath('criteriaStatus.0')).toBe('moves');
    expect(tabForPath('successCriteria.0')).toBe('moves');
  });

  it('routes people and stakeholders paths to people', () => {
    expect(tabForPath('people.0')).toBe('people');
    expect(tabForPath('stakeholders.1')).toBe('people');
  });

  it('routes riskNotes and exposure paths to risks', () => {
    expect(tabForPath('riskNotes.1')).toBe('risks');
    expect(tabForPath('exposure.0')).toBe('risks');
  });

  it('routes decisions, experiments, forecasts, systemsNotes to choices', () => {
    expect(tabForPath('decisions.0')).toBe('choices');
    expect(tabForPath('experiments.0')).toBe('choices');
    expect(tabForPath('forecasts.0')).toBe('choices');
    expect(tabForPath('systemsNotes')).toBe('choices');
  });

  it('routes capacity paths to capacity', () => {
    expect(tabForPath('capacity')).toBe('capacity');
  });

  it('falls back an unrecognized or root path to moves', () => {
    expect(tabForPath('goal')).toBe('moves');
    expect(tabForPath('')).toBe('moves');
  });
});

describe('tabHasContent', () => {
  const empty = stubGoal('Empty') as Goal;
  const full = seededGoal();

  it('moves and doodles always show, even on a stub goal', () => {
    expect(tabHasContent('moves', empty)).toBe(true);
    expect(tabHasContent('doodles', empty)).toBe(true);
  });

  it('people/risks/choices/capacity are hidden on a stub goal', () => {
    expect(tabHasContent('people', empty)).toBe(false);
    expect(tabHasContent('risks', empty)).toBe(false);
    expect(tabHasContent('choices', empty)).toBe(false);
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

  it('MovesTab shows the goal title, plan, criteriaStatus and a 5-entry Lately list', () => {
    const html = render(<MovesTab g={g} goalId="g1" />);
    expect(html).toContain('data-line="goal"');
    expect(html).toContain('data-line="plan.linesOfOperation.0.nextActions.0"');
    expect(html).toContain('data-line="criteriaStatus.0"');
    expect(html).toContain('Lately');
    expect(html).not.toContain('entry 1'); // oldest of 6 entries, trimmed to last 5
    expect(html).toContain('entry 6');
  });

  it('MovesTab does not render people, risk, or capacity content', () => {
    const html = render(<MovesTab g={g} goalId="g1" />);
    expect(html).not.toContain('data-line="people.0"');
    expect(html).not.toContain('data-line="riskNotes.0"');
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

  it('ChoicesTab shows decisions, experiments, forecasts, and systemsNotes', () => {
    const html = render(<ChoicesTab g={g} goalId="g1" />);
    expect(html).toContain('data-line="decisions.0"');
    expect(html).toContain('data-line="experiments.0"');
    expect(html).toContain('data-line="forecasts.0"');
    expect(html).toContain('Distribution');
  });

  it('CapacityTab shows capacity', () => {
    const html = render(<CapacityTab g={g} goalId="g1" />);
    expect(html).toContain('10 hrs/week');
    expect(html).toContain('6 months');
  });
});
