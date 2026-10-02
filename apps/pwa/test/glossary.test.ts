import { describe, it, expect } from 'vitest';
import { WRITABLE_KEYS } from '@gambit/core';
import { glossaryGaps, pageGlossary } from '../src/lib/glossary';
import { PREAMBLE } from '../src/lib/skills';

describe('page glossary', () => {
  it('gives every writable key a place on the page (or says it has none)', () => {
    // A new key needs a heading in sectionTitles.ts, or an entry in
    // glossary.ts's UNTITLED, before the model can map the user's words to it.
    expect(glossaryGaps()).toEqual([]);
  });

  it('maps each key to its tab and heading, in the page\'s words', () => {
    const g = pageGlossary();
    for (const k of [...WRITABLE_KEYS, 'log']) expect(g).toMatch(new RegExp(`^${k} → `, 'm'));
    expect(g).toContain('plan → Moves tab, "All moves"');
    expect(g).toContain('decisions → Bets tab, "Decisions"');
    expect(g).toContain('subGoals → Goal tab, the short bullet list under the title');
    expect(g).toContain('posture → Moves tab, the "Posture:" line');
    expect(g).toMatch(/sticky note.*status proposed/);
  });

  it('is part of the preamble', () => {
    expect(PREAMBLE).toContain(pageGlossary());
  });
});
