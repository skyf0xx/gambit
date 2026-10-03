import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { stubGoal } from '@gambit/core';
import { SectionBody } from '../src/components/Sections';
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
    expect(render(planWith(4))).toContain('+ add a move');
    expect(render(planWith(5))).not.toContain('+ add a move');
  });

  it('shows neither when the page is read-only', () => {
    const html = render(planWith(3), false);
    expect(html).not.toContain('Edit: Move');
    expect(html).not.toContain('+ add a move');
  });
});
