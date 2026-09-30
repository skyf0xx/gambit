import type { Goal } from '../../lib/types';

// Divider-tab grouping for the notebook page. Reuses packages/core's
// registry groups as a starting point (see AGENTS.md's "goal contract" and
// packages/core/src/registry.mjs) but is its own smaller partition sized for
// five tabs plus Doodles, per the task spec:
//
//   Moves    — the default landing tab: header, index card, sticky notes,
//              goal title/deadline, successCriteria, plan, focus, a short
//              "Lately" log tail. Always shown.
//   People   — people, stakeholders
//   Risks    — riskNotes, exposure
//   Choices  — decisions, experiments, forecasts, systemsNotes
//   Capacity — capacity
//   Doodles  — always last, always shown (stub today)
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

export type TabId = 'moves' | 'people' | 'risks' | 'choices' | 'capacity' | 'doodles';

export const TAB_ORDER: TabId[] = ['moves', 'people', 'risks', 'choices', 'capacity', 'doodles'];

export const TAB_LABELS: Record<TabId, string> = {
  moves: 'Moves',
  people: 'People',
  risks: 'Risks',
  choices: 'Choices',
  capacity: 'Capacity',
  doodles: 'Doodles',
};

// Section keys (goal-schema top-level keys rendered by Sections.tsx)
// belonging to each non-Moves tab. Moves owns plan/criteriaStatus directly
// in Tabs.tsx rather than through this map, since it also carries the
// header/index-card/sticky-notes/log furniture no other tab has.
export const TAB_SECTION_KEYS: Partial<Record<TabId, (keyof Goal)[]>> = {
  people: ['people', 'stakeholders'],
  risks: ['riskNotes', 'exposure'],
  choices: ['decisions', 'experiments', 'forecasts', 'systemsNotes'],
  capacity: ['capacity'],
};

const isEmpty = (v: unknown) => v == null || (Array.isArray(v) ? v.length === 0 : typeof v === 'object' && Object.keys(v as object).length === 0);

/** Whether a tab has anything to show. Moves and Doodles always show
 * (task spec); every other tab shows only once one of its keys has content. */
export function tabHasContent(tab: TabId, g: Goal): boolean {
  if (tab === 'moves' || tab === 'doodles') return true;
  const keys = TAB_SECTION_KEYS[tab] ?? [];
  return keys.some((k) => !isEmpty(g[k]));
}

/** Which tab a dotted LinePath's owning section lives on, for `gambit:goto`
 * and for the changed-elsewhere pencil dot. A goal/root-level path (no dot,
 * or one of the Moves-owned keys) resolves to 'moves'. */
export function tabForPath(path: string): TabId {
  const key = path.split('.')[0];
  for (const tab of TAB_ORDER) {
    const keys = TAB_SECTION_KEYS[tab];
    if (keys?.includes(key as keyof Goal)) return tab;
  }
  return 'moves';
}
