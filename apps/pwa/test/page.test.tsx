import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { stubGoal } from '@gambit/core';
import { SectionBody, defaultOpenLine, lineProgress, planLineIndex } from '../src/components/Sections';
import { sectionTitleFor } from '../src/components/sectionTitles';
import type { Goal } from '../src/lib/types';
import { GotoContext } from '../src/components/gotoContext';

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
            { action: 'Pending action', who: 'me', when: '2026-10-09', status: 'pending' },
            { action: 'Done action', who: 'me', when: '2026-10-09', status: 'done' },
            { action: 'Proposed action', who: 'me', when: '2026-10-09', status: 'proposed' },
            { action: 'Dropped action', who: 'me', when: '2026-10-09', status: 'dropped' },
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

  it('shows a line\'s if-thens: decision points, and the ladder by level with the next step to mark', () => {
    const plan = {
      linesOfOperation: [{
        label: 'Tunnel', criticalPath: [], nextActions: [],
        decisionPoints: [
          { if: 'no clean-up date by 1 Dec', then: 'start the petition', by: '2099-12-01', status: 'open' },
          { if: 'council offers a one-off clean', then: 'take it, keep chasing', by: '2099-10-19', status: 'open' },
        ],
        ladder: [
          { level: 'interests', action: 'Report it', to: 'Sydney Trains', waitDays: 14, status: 'sent', sentOn: '2099-10-01' },
          { level: 'rights', action: 'Formal complaint', to: 'TfNSW complaints', carries: 'reference number', waitDays: 21, status: 'pending' },
          { level: 'power', action: 'Story pitch', to: 'Local paper', waitDays: 14, status: 'pending' },
        ],
      }],
    };
    const html = renderSection('plan', plan);
    expect(html).toContain('checkpoints');
    // Soonest check first, the date in a column of its own, then if and then on lines of their own.
    expect(html.indexOf('council offers')).toBeLessThan(html.indexOf('no clean-up date'));
    expect(html).toMatch(/Mon 19 Oct 2099<\/span>[\s\S]*?<span class="text-graphite">if <\/span>council offers a one-off clean<\/span><span class="block"><span class="text-graphite">then <\/span>take it, keep chasing/);
    expect(html).toContain('if they don&#x27;t answer');
    expect(html).toMatch(/ask<\/div>[\s\S]*formal channels<\/div>[\s\S]*go public<\/div>/);
    expect(html).toContain('Formal complaint</span><span class="text-graphite"> · to TfNSW complaints</span>');
    expect(html).toContain(' · with reference number');
    expect(html).toContain('they answered');
    expect(html.match(/mark sent/g)).toHaveLength(1);
    expect(html).toContain('data-line="plan.linesOfOperation.0.ladder.1"');
  });

  it('leaves the top move to the index card and folds done moves away', () => {
    const html = renderSection('plan', g.plan);
    expect(html).not.toContain('Pending action');
    expect(html).not.toContain('Done action');
    expect(html).toContain('1 done');
  });

  it('shows one row\'s detail, names only someone else, and pencils only a status worth saying', () => {
    const line = {
      label: 'Solo', status: 'on_schedule',
      criticalPath: [{ label: 'First', status: 'pending', detail: 'why first' }, { label: 'Second', status: 'pending', detail: 'why second' }],
      nextActions: [
        { action: 'Top', who: 'me', status: 'pending' },
        { action: 'Mine', who: 'me', status: 'pending' },
        { action: 'Theirs', who: 'Priya', status: 'pending' },
      ],
    };
    const html = renderSection('plan', { linesOfOperation: [line] });
    expect(html).toContain('>why first<');
    expect(html).not.toContain('>why second<');
    expect(html).toContain('title="why second"');
    expect(html).toContain('Priya');
    expect(html).not.toMatch(/>me</);
    expect(html).not.toContain('on schedule');
    expect(renderSection('plan', { linesOfOperation: [{ ...line, status: 'at_risk' }] })).toContain('at risk');
    const crit = renderSection('criteriaStatus', [{ text: 'A', kind: 'control', status: 'on_track' }, { text: 'B', kind: 'control', status: 'stalled' }]);
    expect(crit).not.toContain('on track');
    expect(crit).toContain('stalled');
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
    const all = [{ ...f, outcome: 'no' }, { ...f, outcome: 'yes' }, { ...f, resolved: false }];
    // Settled forecasts fold away until asked for; a goto into one opens them.
    expect(renderSection('forecasts', all)).toContain('2 found out');
    const html = renderToStaticMarkup(
      <GotoContext.Provider value={{ path: 'forecasts.0', seq: 1 }}>
        <SectionBody k="forecasts" data={all} goalId="g1" editable />
      </GotoContext.Provider>,
    );
    expect(html).toContain('data-box="forecasts.0"');
    expect(html.match(/data-crossed/g) ?? []).toHaveLength(1);
    expect(html).toMatch(/data-box="forecasts\.0"[^>]*data-crossed/);
    expect(html).not.toContain('data-box="forecasts.2"');
  });

  it('puts an open forecast\'s odds, date and source on one line', () => {
    const html = renderSection('forecasts', [{ statement: 'S', probability: 60, resolvesBy: 'next month', resolvesVia: 'calendar', resolved: false }]);
    expect(html).toContain('60% likely · know next month via calendar');
    expect(html).not.toContain('How likely');
  });

  it('labels criteria as up to you / someone else only when both kinds exist', () => {
    expect(renderSection('successCriteria', [{ text: 'A', kind: 'control' }])).not.toContain('Up to you');
    const both = renderSection('successCriteria', [{ text: 'A', kind: 'control' }, { text: 'B', kind: 'influence' }]);
    expect(both).toContain('Up to you');
    expect(both).toContain('Up to someone else');
  });

  it('gives each row still to do one box, none of them checked', () => {
    const planHtml = renderSection('plan', g.plan);
    // the critical-path step only: the top move is on the index card and
    // the done action is folded away
    expect((planHtml.match(/data-box/g) ?? []).length).toBe(1);
    expect(planHtml).not.toContain('data-checked');
  });
});

describe('plan as a strip of lines', () => {
  const lines = [
    { label: 'Line A', criticalPath: [{ label: 'A step', status: 'done' }], nextActions: [] },
    {
      label: 'Line B',
      criticalPath: [{ label: 'B step', status: 'done' }, { label: 'B dropped step', status: 'dropped' }],
      nextActions: [
        { action: 'B action', who: 'me', when: '2026-10-09', status: 'pending' },
        { action: 'B proposed', who: 'me', when: '2026-10-09', status: 'proposed' },
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

  it('lists every line as a pill and shows only one of them', () => {
    const html = renderSection('plan', { linesOfOperation: lines });
    expect(html).not.toContain('B action');
    expect(html).not.toContain('B step');
    expect(html).not.toContain('A step');
    expect(html).not.toContain('C step');
    expect((html.match(/data-plan-sheet/g) ?? []).length).toBe(3);
    expect((html.match(/aria-selected="true"/g) ?? []).length).toBe(1);
    // Pills stay in plan order whichever line is selected.
    expect(html.indexOf('Line A')).toBeLessThan(html.indexOf('Line B'));
    expect(html.indexOf('Line B')).toBeLessThan(html.indexOf('Line C'));
    // Only the selected line's progress shows, under the strip.
    expect(html).toContain('1 of 2 done');
    expect(html).not.toContain('of 1 done');
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

describe('intel, courses and prep sections', () => {
  it('shows open questions with an answered one ticked and its answer', () => {
    const html = renderSection('intel', [
      { question: 'Is the oven rated?', why: 'It sets the budget', via: 'ask the seller', by: '2026-10-12', status: 'open' },
      { question: 'Who owns the wall?', via: 'land registry', status: 'answered', answer: 'The council' },
    ]);
    expect(html).toContain('Is the oven rated?');
    expect(html).toContain('ask the seller');
    expect(html).toContain('The council');
    expect(html).toContain('data-box="intel.1"');
    expect(html).not.toContain('data-box="intel.0"');
  });
  it('marks the chosen course', () => {
    const html = renderSection('courses', [
      { name: 'Rent', idea: 'Lease the shop', wins: 'Fast', chosen: true },
      { name: 'Buy', idea: 'Buy the shop', risks: 'Cash' },
    ]);
    expect(html).toContain('Rent');
    expect(html.match(/chosen/g)).toHaveLength(1);
    expect(html).toContain('Cash');
  });
  it('shows a talk prep callout with the outcome once held', () => {
    const html = renderSection('prep', [
      { with: 'Priya', on: '2026-10-15', ask: 'Cut the rent', batna: 'Second site', walkAway: 'Above 3k', concessions: ['Longer lease', 'Deposit'], done: false },
      { with: 'Omar', ask: 'Start early', batna: 'Wait', walkAway: 'No', concessions: [], done: true, outcome: 'Agreed to Monday' },
    ]);
    expect(html).toContain('Priya');
    expect(html).toContain('Above 3k');
    expect(html).toContain('Longer lease, Deposit');
    expect(html).toContain('Agreed to Monday');
  });
  it('has plain titles', () => {
    expect(sectionTitleFor('intel').title).toBe('Open questions');
    expect(sectionTitleFor('prep').title).toBe('Talk prep');
  });
});
