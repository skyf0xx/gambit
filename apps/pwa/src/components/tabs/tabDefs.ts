import type { Goal } from '../../lib/types';

// Divider-tab grouping for the notebook page. Reuses packages/core's
// registry groups as a starting point (see AGENTS.md's "goal contract" and
// packages/core/src/registry.mjs) but is its own smaller partition, per the
// task spec and the owner's subsequent corrections:
//
//   Goal        — the goal title (big serif, ink-bleed), time left, "What
//                 done looks like" (successCriteria), and "Parts of this
//                 goal" (subGoals). Always shown, first in the stack.
//   Moves       — the default selected tab on every load: index card,
//                 sticky notes, future moves (plan), the focus, a short
//                 "Lately" log tail. Always shown.
//   People      — people, stakeholders
//   Risks       — riskNotes, exposure
//   Choices     — decisions, experiments, forecasts, systemsNotes
//   Capacity    — capacity
//   Doodles     — the whole plan as a pencil mind map. Always shown.
//   Inside cover — always last: notebooks/goal-switcher, model and key,
//                 keep-it-safe (export/backup), this device (clear chat,
//                 danger zone). A real tab+panel now, not a Leaf.
//
// Deviations from registry.mjs's own SECTION_GROUPS, called out per the
// task's "adjust the grouping if registry.mjs clearly suggests better, and
// list any keys you placed differently" instruction:
//   - registry.mjs puts `decisions` under its 'people' group (alongside
//     riskNotes) because that dashboard's groups are collapsible-by-subject,
//     not tabs. Here `decisions` reads better beside `experiments` and
//     `forecasts` — all three are "an open question worked to a committed
//     answer" — so it lives in Choices instead, and `riskNotes` moves to its
//     own Risks tab per the task's explicit spec.
//   - `systemsNotes` isn't named in the task's tab list at all. It's
//     decision-adjacent (the leverage point that feeds what to decide), so
//     it's placed in Choices rather than dropped from the page.
//   - `exposure` isn't under any registry.mjs group by itself (it's grouped
//     with `capacity` there); the task spec explicitly calls for
//     exposure to live in Risks and capacity to have its own tab, so that's
//     what this file does.

export type TabId = 'goal' | 'moves' | 'people' | 'risks' | 'choices' | 'capacity' | 'doodles' | 'inside-cover';

export const TAB_ORDER: TabId[] = ['goal', 'moves', 'people', 'risks', 'choices', 'capacity', 'doodles', 'inside-cover'];

export const TAB_LABELS: Record<TabId, string> = {
  goal: 'Goal',
  moves: 'Moves',
  people: 'People',
  risks: 'Risks',
  choices: 'Choices',
  capacity: 'Capacity',
  doodles: 'Doodles',
  'inside-cover': 'Inside cover',
};

// Section keys (goal-schema top-level keys rendered by Sections.tsx)
// belonging to each non-Moves, non-Goal, non-Inside-cover tab. Goal and
// Moves each own their own furniture directly in their tab component
// (GoalTab.tsx / MovesTab.tsx) rather than through this map. Inside cover
// isn't goal-section content at all.
export const TAB_SECTION_KEYS: Partial<Record<TabId, (keyof Goal)[]>> = {
  people: ['people', 'stakeholders'],
  risks: ['riskNotes', 'exposure'],
  choices: ['decisions', 'experiments', 'forecasts', 'systemsNotes'],
  capacity: ['capacity'],
};

const isEmpty = (v: unknown) => v == null || (Array.isArray(v) ? v.length === 0 : typeof v === 'object' && Object.keys(v as object).length === 0);

/** Whether a tab has anything to show. Goal, Moves, Doodles and Inside
 * cover always show (task spec); every other tab shows only once one of
 * its keys has content. */
export function tabHasContent(tab: TabId, g: Goal): boolean {
  if (tab === 'goal' || tab === 'moves' || tab === 'doodles' || tab === 'inside-cover') return true;
  const keys = TAB_SECTION_KEYS[tab] ?? [];
  return keys.some((k) => !isEmpty(g[k]));
}

/** Which tab a dotted LinePath's owning section lives on, for `gambit:goto`
 * and for the changed-elsewhere pencil dot. A goal/root-level path (no dot,
 * or one of the Moves-owned keys) resolves to 'moves'. The special path
 * `inside-cover` (App.tsx's gambit:menu handler) resolves directly. */
export function tabForPath(path: string): TabId {
  if (path === 'inside-cover') return 'inside-cover';
  if (path === 'goal' || path.startsWith('successCriteria') || path.startsWith('subGoals')) return 'goal';
  const key = path.split('.')[0];
  for (const tab of TAB_ORDER) {
    const keys = TAB_SECTION_KEYS[tab];
    if (keys?.includes(key as keyof Goal)) return tab;
  }
  return 'moves';
}
