import { WRITABLE_KEYS } from '@gambit/core';
import { hasSectionTitle, sectionTitleFor } from '../components/sectionTitles';
import { TAB_LABELS, tabForPath } from '../components/tabs/tabDefs';

// The page and the schema name things differently: the page speaks to the
// user ("All moves", the Bets tab), the schema to the model (plan,
// decisions). The model never sees the page, so this maps one to the other.
// It's built from the same labels the page renders, so a renamed heading or
// a key moved to another tab changes the prompt with it.

/** Keys shown on the page without a section heading, and keys not shown at
 * all (null). Every other writable key must have a heading in
 * sectionTitles.ts; glossaryGaps() lists any that don't. */
const UNTITLED: Record<string, string | null> = {
  goal: 'the big title at the top',
  deadline: 'the time left, under the title',
  posture: null,
};

/** Page furniture that isn't one key's section, with what it reads. */
const FURNITURE = [
  `Moves tab, "Your top move" (the index card): the first nextActions entry with status pending on the line with focus: true, else the first pending one in plan order. Ticking its box sets it done.`,
  `Moves tab, "Gambit suggests" (a sticky note): a nextActions entry with status proposed. "Keep it" sets pending, "Toss" sets dropped.`,
  `"All moves" is the whole plan: each line of operation shows its criticalPath steps, then its nextActions. The user may call either one "moves", "steps" or "to-dos".`,
  `Doodles tab: the whole plan drawn as a mind map. Read-only; it changes when plan does.`,
  `Settings tab: goal switcher, model and key, backups. Nothing there is a goal key.`,
  `A small pencilled word beside a heading (red team, stakeholders, eval...) names the method behind it; the user may use it to mean that section.`,
];

const keys = [...WRITABLE_KEYS, 'log'];

export function glossaryGaps(): string[] {
  return keys.filter((k) => !hasSectionTitle(k) && !(k in UNTITLED));
}

export function pageGlossary(): string {
  const lines = keys.map((k) => {
    const where = TAB_LABELS[tabForPath(k)];
    if (k in UNTITLED) {
      const what = UNTITLED[k];
      return what ? `${k} → ${where} tab, ${what}` : `${k} → not shown on the page`;
    }
    return `${k} → ${where} tab, "${sectionTitleFor(k).title}"`;
  });
  return `What the user sees. The user only sees the page, never key names, and talks about it in the page's words. Map what they say to a key with this list, and talk back in the page's words: key and field names are for tool calls only, never for replies.
${lines.join('\n')}
${FURNITURE.join('\n')}`;
}
