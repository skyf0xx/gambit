import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { stubGoal } from '@gambit/core';
import { SectionBody, defaultOpenLine, lineProgress, planLineIndex } from '../src/components/Sections';
import { sectionTitleFor } from '../src/components/sectionTitles';
import type { Goal } from '../src/lib/types';

// A seeded v2 goal exercising the sections that carry markable lines:
// plan (next actions in every status), people, riskNotes, criteriaStatus.
function seededGoal(): Goal {
  const g = stubGoal('Ship the thing') as Goal;
  return {
    ...g,
    successCriteria: [{ text: 'Launched', kind: 'control' }],
    people: [{ name: 'Priya', status: 'confirmed', doing: 'runs the rollout' }],
    riskNotes: [{ item: 'Vendor slips the date', source: 'threat', accepted: false }],
    criteriaStatus: [{ text: 'Launched', kind: 'control', status: 'on_track' }],
    plan: {
      linesOfOperation: [
        {
          label: 'Line A',
          criticalPath: [{ label: 'Step one', status: 'pending' }],
          nextActions: [
            { action: 'Pending action', who: 'me', when: 'fri', status: 'pending' },
            { action: 'Done action', who: 'me', when: 'fri', status: 'done' },
            { action: 'Proposed action', who: 'me', when: 'fri', status: 'proposed' },
            { action: 'Dropped action', who: 'me', when: 'fri', status: 'dropped' },
          ],
        },
      ],
    },
  };
}

function renderSection(k: keyof Goal, data: unknown) {
  return renderToStaticMarkup(<SectionBody k={k} data={data} goalId="g1" editable />);
}

describe('notebook page markup', () => {
  const g = seededGoal();

  it('renders no bordered <details> cards', () => {
    const html = renderSection('plan', g.plan);
    expect(html).not.toContain('<details');
  });

  it('renders no rounded-full classes', () => {
    const html = renderSection('plan', g.plan);
    expect(html).not.toContain('rounded-full');
  });

  it('uses no slate/sky/emerald status-colour classes', () => {
    const htmls = [
      renderSection('plan', g.plan),
      renderSection('people', g.people),
      renderSection('riskNotes', g.riskNotes),
      renderSection('criteriaStatus', g.criteriaStatus),
    ].join('\n');
    expect(htmls).not.toMatch(/slate-\d/);
    expect(htmls).not.toMatch(/sky-\d/);
    expect(htmls).not.toMatch(/emerald-\d/);
  });

  it('never strikes through a done or dropped line', () => {
    const htmls = [renderSection('plan', g.plan), renderSection('riskNotes', g.riskNotes)].join('\n');
    expect(htmls).not.toMatch(/line-through/);
  });

  it('renders no ISO dates in the markup', () => {
    const html = renderSection('plan', g.plan);
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('gives every markable line a data-line attribute', () => {
    const html = renderSection('plan', g.plan);
    expect(html).toContain('data-line="plan.linesOfOperation.0.criticalPath.0"');
    expect(html).toContain('data-line="plan.linesOfOperation.0.nextActions.0"');

    const peopleHtml = renderSection('people', g.people);
    expect(peopleHtml).toContain('data-line="people.0"');

    const riskHtml = renderSection('riskNotes', g.riskNotes);
    expect(riskHtml).toContain('data-line="riskNotes.0"');

    const critHtml = renderSection('criteriaStatus', g.criteriaStatus);
    expect(critHtml).toContain('data-line="criteriaStatus.0"');
  });

  it('does not show a proposed next action in the section', () => {
    const html = renderSection('plan', g.plan);
    expect(html).not.toContain('Proposed action');
  });

  it('does not show a dropped next action when not in the session dropped set', () => {
    const html = renderSection('plan', g.plan);
    expect(html).not.toContain('Dropped action');
  });

  it('still shows pending and done next actions', () => {
    const html = renderSection('plan', g.plan);
    expect(html).toContain('Pending action');
    expect(html).toContain('Done action');
  });

  it('gives steps a hand-drawn box hook, and progress only a tick once met', () => {
    const planHtml = renderSection('plan', g.plan);
    expect(planHtml).toContain('data-box');
    // Progress isn't the user's to tick: an open ring until met, then a
    // bare tick slot — never an outlined box.
    const open = renderSection('criteriaStatus', g.criteriaStatus.map((c) => ({ ...c, status: 'on_track' })));
    expect(open).not.toContain('data-box');
    const met = renderSection('criteriaStatus', g.criteriaStatus.map((c) => ({ ...c, status: 'met' })));
    expect(met).toContain('data-box');
    expect((met.match(/data-box/g) ?? []).length).toBe((met.match(/data-bare/g) ?? []).length);
  });

  it('crosses a forecast that didn\'t happen and ticks one that did', () => {
    const f = { statement: 'It ships', probability: 70, resolvesBy: '2026-01-01', resolvesVia: 'launch', resolved: true };
    const html = renderSection('forecasts', [{ ...f, outcome: 'no' }, { ...f, outcome: 'yes' }, { ...f, resolved: false }]);
    expect(html).toContain('data-box="forecasts.0"');
    expect(html.match(/data-crossed/g) ?? []).toHaveLength(1);
    expect(html).toMatch(/data-box="forecasts\.0"[^>]*data-crossed/);
    expect(html).not.toContain('data-box="forecasts.2"');
  });

  it('gives every next action and step one box, not only criteria', () => {
    const planHtml = renderSection('plan', g.plan);
    // one box per Toggle tap-area, for each of: the critical-path step and
    // the two visible (pending + done) next actions
    expect((planHtml.match(/data-box/g) ?? []).length).toBe(3);
  });

  it('marks only the done next action\'s box as checked', () => {
    const planHtml = renderSection('plan', g.plan);
    expect((planHtml.match(/data-checked/g) ?? []).length).toBe(1);
  });
});

describe('plan as a stack of sheets', () => {
  const lines = [
    { label: 'Line A', criticalPath: [{ label: 'A step', status: 'done' }], nextActions: [] },
    {
      label: 'Line B',
      criticalPath: [{ label: 'B step', status: 'done' }, { label: 'B dropped step', status: 'dropped' }],
      nextActions: [
        { action: 'B action', who: 'me', when: 'fri', status: 'pending' },
        { action: 'B proposed', who: 'me', when: 'fri', status: 'proposed' },
      ],
    },
    { label: 'Line C', criticalPath: [{ label: 'C step', status: 'pending' }], nextActions: [] },
  ];

  it('counts only pending and done items toward a line\'s progress', () => {
    expect(lineProgress(lines[1])).toEqual({ done: 1, total: 2 });
  });

  it('opens the focus line, else the first line with something pending', () => {
    expect(defaultOpenLine(lines, 2)).toBe(2);
    expect(defaultOpenLine(lines, null)).toBe(1);
    expect(defaultOpenLine([lines[0]], null)).toBe(0);
  });

  it('reads the line index out of a plan path only', () => {
    expect(planLineIndex('plan.linesOfOperation.2.nextActions.0')).toBe(2);
    expect(planLineIndex('riskNotes.0')).toBeNull();
    expect(planLineIndex(undefined)).toBeNull();
  });

  it('lists every line as an edge and opens only one of them', () => {
    const html = renderSection('plan', { linesOfOperation: lines });
    expect(html).toContain('B action');
    expect(html).not.toContain('A step');
    expect(html).not.toContain('C step');
    expect((html.match(/data-plan-sheet/g) ?? []).length).toBe(3);
    expect((html.match(/aria-current/g) ?? []).length).toBe(1);
    expect(html).toContain('1 of 1 done');
    expect(html).toContain('0 of 1 done');
  });
});

describe('sectionTitleFor', () => {
  it('renames plan to All moves', () => {
    expect(sectionTitleFor('plan').title).toBe('All moves');
  });

  it('maps riskNotes to a plain-language title with the method pencilled beside it', () => {
    const t = sectionTitleFor('riskNotes');
    expect(t.title).toBe('What could go wrong');
    expect(t.method).toBe('red team');
  });

  it('gives every method a one-line plain-language note', () => {
    expect(sectionTitleFor('riskNotes').methodNote).toMatch(/red team/);
    expect(sectionTitleFor('forecasts').methodNote).toMatch(/forecast/);
  });

  it('falls back to the raw key for an unknown section', () => {
    expect(sectionTitleFor('somethingNew').title).toBe('somethingNew');
  });
});
