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
  subGoals: 'the short bullet list under the title (the parts of the goal)',
  posture: 'the words after the "All moves" label, e.g. "All moves - quiet posture" (its pencil note: what the level means, what would change it)',
};

/** Page furniture that isn't one key's section, with what it reads. */
const FURNITURE = [
  `Moves tab, "Your top move" (the index card): the first live nextActions entry (pending, not waiting on another task or on its condition) on the line with focus: true, else the first live one in plan order. Ticking its box sets it done.`,
  `Highlighter (a yellow swipe behind a line): the focusLine of strategy's newest focus — its hover note reads "anything that doesn't help this can wait". Only strategy moves it; a focus with no single line clears it.`,
  `Moves tab, "Gambit suggests" (a sticky note): a nextActions entry with status proposed. "Keep it" sets pending, "Toss" sets dropped.`,
  `"All moves" is the whole plan: a row of handwritten line-of-operation names (a "!" marks one at risk or blocked). The selected one, underlined, lists its tasks with each milestone (criticalPath) after the tasks that reach it (its after): a line ruled across after those tasks with the milestone's name on it, smaller than a task, beside a diamond. A milestone is something that becomes true, so it has no box and nobody ticks it: its diamond is open until those tasks are done (or dropped, with at least one done), then filled, with "reached [date]" under it, and open again if one is unticked. Every milestone is drawn the same, quieter than the tasks: a faint dotted line and a grey name; only the diamond says whether it is reached. A passed milestone stays where it is, under the tasks that reached it; done tasks stay in place, ticked and grey, never folded away. A task no milestone lists sits before the one the line is heading to. Each row's marker says where it stands: a box for a move (ticked once done, with "→ …" naming tasks waiting on it), "✉" for a sent message waiting for a reply ("· to [name] · sent [date] · waiting for a reply, day N of [wait]", the rest of the climb as "if no reply: [next] to [name], then [name] … (public)", and a "they replied" button), "•" for a move waiting on another ("[what it waits on] → [move]"). Forks sit at the end under "if things change" ("↳ if [event] · check [date] / then [move]", with "it happened" and "it didn't"). An escalation still waiting appears only in its message's "if no reply" line. The arrow always means "then". The top move from the index card is in its place there too. The user may call tasks "moves", "steps" or "to-dos", and a milestone a "goal post" or "checkpoint".`,
  `Goal tab, "What done looks like": each successCriteria line carries its criteriaStatus score — an open ring, a tick once met, or the word at risk / stalled / regressing. The separate "Progress" list only holds a score whose text matches no criterion.`,
  `Status words are only shown when something's wrong (at risk, blocked, stalled, regressing); on schedule and on track go unsaid on the page.`,
  `Doodles tab: the whole plan drawn as a mind map. Read-only; it changes when plan does.`,
  `Settings tab: goal switcher, model and key, backups, and "History" (the log) folded at the foot.`,
  `A section with nothing in it isn't shown at all; a tab appears once one of its sections has something.`,
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
