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
          criticalPath: [{ label: 'Step one' }],
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

  it('lays a line out as tasks then the milestone they reach, with forks after', () => {
    const plan = {
      linesOfOperation: [{
        label: 'Tunnel', criticalPath: [
          { id: 'owner', label: 'Owner on record', after: ['find'] },
          { id: 'date', label: 'Clean-up date set', after: ['hall', 'report'] },
          { id: 'clean', label: 'Tunnel cleaned', after: ['walk'] },
        ], nextActions: [
          { id: 'find', action: 'Find who owns the tunnel', who: 'me', status: 'done', doneOn: '2099-09-20' },
          { id: 'walk', action: 'Walk the site with the crew', who: 'me', status: 'pending', after: ['date'] },
          { id: 'photos', action: 'Take the weekly photos', who: 'me', status: 'pending' },
          { id: 'hall', action: 'Book the hall', who: 'me', status: 'pending' },
          { id: 'report', action: 'Report it', who: 'me', to: 'Sydney Trains', level: 'interests', status: 'done', doneOn: '2099-10-01' },
          { id: 'complaint', action: 'Formal complaint quoting the reference', who: 'me', to: 'TfNSW complaints', level: 'rights', status: 'pending', if: { noReply: 'report', days: 14 } },
          { action: 'Pitch the story', who: 'me', to: 'Local paper', level: 'power', status: 'pending', if: { noReply: 'complaint', days: 30 } },
          { action: 'Door-knock the street first', who: 'me', status: 'pending', if: { event: 'under 10 sign-ups', by: '2099-11-01' } },
          { action: 'Print the flyers', who: 'me', status: 'pending', after: ['hall'] },
        ],
      }],
    };
    const html = renderSection('plan', plan);
    // Each milestone is a ruled line after the tasks that reach it, passed
    // ones included, in plan order; forks at the end.
    const order = ['data-milestone="passed"', 'Owner on record', 'Book the hall', 'Report it', 'data-milestone="current"', 'Clean-up date set', 'Walk the site with the crew', 'data-milestone="ahead"', 'Tunnel cleaned', '>if things change<'].map((l) => html.indexOf(l));
    expect(order.every((n) => n >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // A passed milestone keeps its place, ticked, with its done tasks folded.
    expect(html).not.toContain('Find who owns the tunnel');
    expect(html).toContain('>1 done<');
    expect(html).toMatch(/data-box="plan\.linesOfOperation\.0\.criticalPath\.0"[^>]*data-checked/);
    // Milestones still ahead carry no box: nobody ticks them.
    expect(html).not.toContain('data-box="plan.linesOfOperation.0.criticalPath.1"');
    expect(html).not.toContain('data-box="plan.linesOfOperation.0.criticalPath.2"');
    expect(html).not.toContain('⚑');
    expect(html).toContain('Clean-up date set → </span><span>Walk the site with the crew');
    // The top move is on the card; the rest of now shows what it unlocks.
    expect(html).not.toContain('Take the weekly photos');
    expect(html).toContain('→ Print the flyers');
    // A sent message waits for a reply, with its climb on one line.
    expect(html).toContain(' · to Sydney Trains · sent Thu 1 Oct 2099 · waiting for a reply, day 0 of 14');
    expect(html).toContain('if no reply: ');
    expect(html).not.toContain('data-line="plan.linesOfOperation.0.nextActions.4"');
    expect(html).toContain('Formal complaint quoting the reference to TfNSW complaints');
    expect(html).toContain(', then Local paper (public)');
    expect(html).toContain('they replied');
    // Waiting escalations appear only in the climb, not as rows of their own.
    expect(html).not.toContain('data-line="plan.linesOfOperation.0.nextActions.5"');
    expect(html).toContain('under 10 sign-ups');
    expect(html).toContain('check Sun 1 Nov 2099');
    expect(html).toContain('it didn’t');
    expect(html).toContain('Book the hall → </span><span>Print the flyers');
    // Waiting, fork and later rows put their marker in the tick-box column.
    for (const mark of ['✉', '◇', '•']) expect(html).toContain(`<span class="w-11 shrink-0 text-center text-graphite" aria-hidden="true">${mark}</span>`);
  });

  it('passes a milestone when its tasks are done and un-passes it when one is unticked, in the same place', () => {
    const line = (status: string) => ({ linesOfOperation: [{ label: 'Paper trail', criticalPath: [
      { id: 'heard', label: 'Sydney Trains has heard it', after: ['email', 'call'] },
      { id: 'filed', label: 'TfNSW complaint on file', after: ['complaint'] },
    ], nextActions: [
      { id: 'email', action: 'Fill in the feedback form', who: 'me', status: 'done' },
      { id: 'call', action: 'Call customer care', who: 'me', status },
      { id: 'photos', action: 'Photograph the tunnel', who: 'me', status: 'pending' },
      { id: 'complaint', action: 'Lodge the TfNSW complaint', who: 'me', status: 'pending', after: ['heard'] },
    ] }] });
    const passed = renderSection('plan', line('done'));
    expect(passed).toContain('data-milestone="passed"');
    expect(passed.indexOf('Sydney Trains has heard it')).toBeLessThan(passed.indexOf('data-milestone="current"'));
    expect(passed).toContain('>2 done<');
    // The fold sits where its tasks were: above the milestone's line.
    expect(passed.indexOf('>2 done<')).toBeLessThan(passed.indexOf('data-milestone="passed"'));
    expect(passed).not.toContain('Call customer care');
    // The task waiting on the milestone is a move to make now.
    expect(passed).toContain('data-box="plan.linesOfOperation.0.nextActions.3"');

    const unticked = renderSection('plan', line('pending'));
    expect(unticked).not.toContain('data-milestone="passed"');
    expect(unticked).not.toMatch(/data-box="plan\.linesOfOperation\.0\.criticalPath/);
    // Back to the milestone the line is heading to, after its tasks, with
    // the done one still ticked in place.
    const order = ['Fill in the feedback form', 'data-milestone="current"', 'Sydney Trains has heard it', 'data-milestone="ahead"', 'TfNSW complaint on file'].map((l) => unticked.indexOf(l));
    expect(order.every((n) => n >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(unticked).toMatch(/data-box="plan\.linesOfOperation\.0\.nextActions\.0"[^>]*data-checked/);
    expect(unticked).toContain('Sydney Trains has heard it → </span><span>Lodge the TfNSW complaint');
  });

  it('opens a passed milestone\'s folded tasks on a goto into one', () => {
    const plan = { linesOfOperation: [{ label: 'L', criticalPath: [{ id: 'm', label: 'Met', after: ['a'] }], nextActions: [
      { id: 'a', action: 'Folded move', who: 'me', status: 'done' },
      { action: 'Top', who: 'me', status: 'pending' },
    ] }] };
    expect(renderSection('plan', plan)).not.toContain('Folded move');
    const html = renderToStaticMarkup(
      <GotoContext.Provider value={{ path: 'plan.linesOfOperation.0.nextActions.0', seq: 1 }}>
        <SectionBody k="plan" data={plan} goalId="g1" editable />
      </GotoContext.Provider>,
    );
    expect(html).toContain('Folded move');
    expect(html).toContain('>fold<');
  });

  it('labels no groups when a line has only moves to make', () => {
    const html = renderSection('plan', { linesOfOperation: [{ label: 'Picnic', criticalPath: [], nextActions: [
      { action: 'Book the spot', who: 'me', status: 'pending' },
      { action: 'Buy the food', who: 'me', status: 'pending' },
    ] }] });
    expect(html).toContain('Buy the food');
    expect(html).not.toContain('>now<');
  });

  it('leaves the top move to the index card and keeps done moves ticked toward the next milestone', () => {
    const html = renderSection('plan', g.plan);
    expect(html).not.toContain('Pending action');
    expect(html).toContain('Done action');
    expect(html).toMatch(/data-box="plan\.linesOfOperation\.0\.nextActions\.1"[^>]*data-checked/);
  });

  it('shows one row\'s detail, names only someone else, and pencils only a status worth saying', () => {
    const line = {
      label: 'Solo', status: 'on_schedule',
      criticalPath: [{ label: 'First', status: 'pending', detail: 'why first' }, { label: 'Second', status: 'pending', detail: 'why second' }],
      nextActions: [
        { action: 'Top', who: 'me', status: 'pending' },
        { action: 'Mine', who: 'me', status: 'pending', detail: 'why mine' },
        { action: 'Theirs', who: 'Priya', status: 'pending', detail: 'why theirs' },
      ],
    };
    const html = renderSection('plan', { linesOfOperation: [line] });
    expect(html).toContain('>why mine<');
    expect(html).not.toContain('>why theirs<');
    expect(html).toContain('title="why theirs"');
    expect(html).toContain('title="why first"');
    expect(html).toContain('Priya');
    expect(html).not.toMatch(/>me</);
    expect(html).not.toContain('on schedule');
    expect(renderSection('plan', { linesOfOperation: [{ ...line, status: 'at_risk' }] })).toContain('at risk');
    const crit = renderSection('criteriaStatus', [{ text: 'A', kind: 'control', status: 'on_track' }, { text: 'B', kind: 'control', status: 'stalled' }]);
    expect(crit).not.toContain('on track');
    expect(crit).toContain('stalled');
  });

  it('rules a milestone across the page with no box to tick, and progress only a tick once met', () => {
    const planHtml = renderSection('plan', g.plan);
    expect(planHtml).toContain('data-milestone="current"');
    expect(planHtml).not.toContain('data-box="plan.linesOfOperation.0.criticalPath.0"');
    expect(planHtml).not.toContain('reached</span></button>');
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

  it('gives each row one box, and only the done one is checked', () => {
    const planHtml = renderSection('plan', g.plan);
    // the top move is on the index card, and the milestone ahead has no box
    expect((planHtml.match(/data-box/g) ?? []).length).toBe(1);
    expect((planHtml.match(/data-checked/g) ?? []).length).toBe(1);
  });
});

describe('plan as a strip of lines', () => {
  const lines = [
    { label: 'Line A', criticalPath: [{ id: 'a', label: 'A step', after: ['a1'] }], nextActions: [{ id: 'a1', action: 'A done', who: 'me', status: 'done' }] },
    {
      label: 'Line B',
      criticalPath: [{ id: 'b', label: 'B step', after: ['b0'] }],
      nextActions: [
        { id: 'b0', action: 'B done', who: 'me', status: 'done' },
        { action: 'B action', who: 'me', when: '2026-10-09', status: 'pending' },
        { action: 'B proposed', who: 'me', when: '2026-10-09', status: 'proposed' },
      ],
    },
    { label: 'Line C', criticalPath: [{ label: 'C step' }], nextActions: [] },
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
    expect(html).toContain('B step');
    expect(html).toContain('data-milestone="passed"');
    expect(html).not.toContain('B done');
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
