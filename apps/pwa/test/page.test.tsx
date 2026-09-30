import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { stubGoal } from '@gambit/core';
import { SectionBody } from '../src/components/Sections';
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

  it('gives criteria and steps a hand-drawn box hook', () => {
    const html = renderSection('criteriaStatus', g.criteriaStatus);
    expect(html).toContain('data-box');
    const planHtml = renderSection('plan', g.plan);
    expect(planHtml).toContain('data-box');
  });

  it('gives every next action and step a box, not only criteria', () => {
    const planHtml = renderSection('plan', g.plan);
    // one box per Toggle tap-area plus one per Line hook, for each of: the
    // critical-path step and the two visible (pending + done) next actions
    expect((planHtml.match(/data-box/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });
});

describe('sectionTitleFor', () => {
  it('renames plan to Future moves', () => {
    expect(sectionTitleFor('plan').title).toBe('Future moves');
  });

  it('maps riskNotes to a plain-language title with the method pencilled beside it', () => {
    const t = sectionTitleFor('riskNotes');
    expect(t.title).toBe('What could go wrong');
    expect(t.method).toBe('red team');
  });

  it('gives every method a one-line plain-language note', () => {
    expect(sectionTitleFor('riskNotes').methodNote).toMatch(/red team/);
    expect(sectionTitleFor('criteriaStatus').methodNote).toMatch(/eval/);
  });

  it('falls back to the raw key for an unknown section', () => {
    expect(sectionTitleFor('somethingNew').title).toBe('somethingNew');
  });
});
