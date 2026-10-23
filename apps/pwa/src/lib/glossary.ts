import { WRITABLE_KEYS } from '@gambit/core';
import { hasSectionTitle, sectionTitleFor } from '../components/sectionTitles';
import { TAB_LABELS, tabForPath } from '../components/tabs/tabDefs';
import { t } from './i18n';

// The page and the schema name things differently: the page speaks to the
// user ("All moves", the Bets tab), the schema to the model (plan,
// decisions). The model never sees the page, so this maps one to the other.
// It's built from the same labels the page renders, in the page's
// language, so a renamed heading or a key moved to another tab changes the
// prompt with it, and the model names things the way the user sees them.

/** Keys shown on the page without a section heading, and keys not shown at
 * all (null). Every other writable key must have a heading in
 * sectionTitles.ts; glossaryGaps() lists any that don't. */
const UNTITLED: Record<string, string | null> = {
  goal: 'the big title at the top',
  deadline: 'the time left, under the title',
  subGoals: 'the short bullet list under the title (the parts of the goal)',
  domains: null,
  posture: `the words after the "${sectionTitleFor('plan').title}" label, e.g. "${sectionTitleFor('plan').title} - quiet posture" (its pencil note: what the level means, what would change it)`,
};

/** Page furniture that isn't one key's section, with what it reads. */
const FURNITURE = [
  `${TAB_LABELS.moves} tab, "${t('moves.topMove')}" (the index card): the first live nextActions entry (pending, not waiting on another task or on its condition) on the line with focus: true, else the first live one in plan order. Ticking its box sets it done.`,
  `Highlighter (a yellow swipe behind a line): the focusLine of strategy's newest focus — its hover note reads "${t('ui.markHighlight')}". Only strategy moves it; a focus with no single line clears it.`,
  `${TAB_LABELS.moves} tab, "${t('moves.suggests')}" (a sticky note): a nextActions entry with status proposed. "${t('moves.keepIt')}" sets pending, "${t('moves.toss')}" sets dropped.`,
  `"${sectionTitleFor('plan').title}" is the whole plan: a row of handwritten line-of-operation names (a "!" marks one at risk or blocked). The selected one, underlined, lists its tasks with each milestone (criticalPath) after the tasks that reach it (its after): a line ruled across after those tasks with the milestone's name on it, smaller than a task, beside a diamond. A milestone is something that becomes true, so it has no box and nobody ticks it: its diamond is open until those tasks are done (or dropped, with at least one done), then filled, with "${t('page.milestone.reached', { date: '[date]' })}" under it, and open again if one is unticked. Every milestone is drawn the same, quieter than the tasks: a faint dotted line and a grey name; only the diamond says whether it is reached. A passed milestone stays where it is, under the tasks that reached it; done tasks stay in place, ticked and grey, never folded away. A task no milestone lists sits before the one the line is heading to. Each row's marker says where it stands: a box for a move (ticked once done, with "→ …" naming tasks waiting on it), "✉" for a sent message waiting for a reply ("${t('page.awaiting.sentOf', { name: '[name]', date: '[date]', day: 'N', wait: '[wait]' }).trim()}", the rest of the climb as "${t('page.chain.ifNoReply').trim()} [next] to [name], then [name] … (public)", and a "${t('page.theyReplied')}" button), "•" for a move waiting on another ("[what it waits on] → [move]", or "↑ then [move]" when what it waits on is drawn directly above). A fork or waiting escalation a milestone lists sits in that milestone's stretch as "↳ if [event or they don't reply in N days] / then [move]"; forks no milestone lists sit at the end under "${t('page.ifThingsChange')}". More than a week before its check date a fork shows only "${t('page.cond.knowAlready')}", which opens its buttons. Forks carry "${t('page.cond.doNow')}" (the event came true: the move goes live, with "${t('page.because', { event: '[event]' })} · ${t('page.undo')}" under it) and "${t('page.cond.notNeeded')}" (it didn't: the move is struck through, with "${t('page.undo')}", until the session ends). An escalation still waiting appears only in its message's "if no reply" line. The arrow always means "then". The top move from the index card is in its place there too. The user may call tasks "moves", "steps" or "to-dos", and a milestone a "goal post" or "checkpoint".`,
  `${TAB_LABELS.goal} tab, "${sectionTitleFor('successCriteria').title}": each successCriteria line carries its criteriaStatus score — an open ring, a tick once met, or the word at risk / stalled / regressing. The separate "${sectionTitleFor('criteriaStatus').title}" list only holds a score whose text matches no criterion.`,
  `Status words are only shown when something's wrong (at risk, blocked, stalled, regressing); on schedule and on track go unsaid on the page.`,
  `${TAB_LABELS.doodles} tab: the goal at the top, each line of the plan climbing toward it from the bottom. Read-only; it changes when plan does.`,
  `${TAB_LABELS['inside-cover']} tab: goal switcher, model and key, backups, and "${sectionTitleFor('log').title}" (the log) folded at the foot.`,
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
