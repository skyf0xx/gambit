import { NEXT_ACTIONS_MAX } from '@gambit/core';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { stubGoal } from '@gambit/core';
import { SectionBody, PeopleBody } from '../src/components/Sections';
import type { Goal } from '../src/lib/types';

// renderToStaticMarkup only: the edit affordances, not the typing.
function planWith(n: number): Goal {
  const g = stubGoal('Ship the thing') as Goal;
  return {
    ...g,
    plan: {
      linesOfOperation: [
        {
          label: 'Line A',
          criticalPath: [],
          nextActions: Array.from({ length: n }, (_, i) => ({ action: `Move ${i}`, who: 'me', status: 'pending' })),
        },
      ],
    },
  } as Goal;
}

const render = (g: Goal, editable = true) =>
  renderToStaticMarkup(<SectionBody k="plan" data={g.plan} goalId="g1" editable={editable} />);

describe('inline edits', () => {
  it('gives an editable next action an Edit button', () => {
    // Move 0 is the top move, shown on the index card instead of the list.
    const html = render(planWith(3));
    expect(html).toContain('aria-label="Edit: Move 1"');
    expect(html).toContain('aria-label="Edit: Move 2"');
  });

  it('offers "+ add a move" below the cap and not at it', () => {
    expect(render(planWith(NEXT_ACTIONS_MAX - 1))).toContain('+ add a move');
    expect(render(planWith(NEXT_ACTIONS_MAX))).not.toContain('+ add a move');
  });

  it('shows neither when the page is read-only', () => {
    const html = render(planWith(3), false);
    expect(html).not.toContain('Edit: Move');
    expect(html).not.toContain('+ add a move');
  });

  it('edits a risk and an open decision, never a decided one', () => {
    const risks = renderToStaticMarkup(<SectionBody k="riskNotes" data={[{ item: 'Lease falls through', source: 'threat', accepted: false }]} goalId="g1" editable />);
    expect(risks).toContain('aria-label="Edit: Lease falls through"');
    const decisions = renderToStaticMarkup(
      <SectionBody
        k="decisions"
        data={[
          { date: '2026-09-01', status: 'open', question: 'Lease or buy the van' },
          { date: '2026-09-02', status: 'decided', choice: 'Hire one stylist', reverseIf: 'bookings drop' },
        ]}
        goalId="g1"
        editable
      />,
    );
    expect(decisions).toContain('aria-label="Edit: Lease or buy the van"');
    expect(decisions).not.toContain('Edit: Hire one stylist');
  });

  it("edits what a person is doing, not their name", () => {
    const html = renderToStaticMarkup(<PeopleBody goalId="g1" people={[{ name: 'Priya', status: 'confirmed', doing: 'Runs the front desk' }]} stakeholders={[]} />);
    expect(html).toContain('aria-label="Edit: Runs the front desk"');
    expect(html).not.toContain('Edit: Priya');
  });
});
