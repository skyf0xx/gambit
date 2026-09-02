// Parses a GOAL.json body into a fixed header (title, success criteria,
// deadline — always rendered as the top card) plus an ordered list of the
// remaining owned-key sections, each handed to whichever renderer
// registry.mjs maps its key to.

import { safeParseGoalJson } from '../store/schema.mjs';

// Owned keys considered for the sections list, in a fixed display order —
// what to do next, then are we winning, then who's involved and why, then
// what could go wrong, then reference material that's checked less often.
// Skipped when null/empty so an untouched goal doesn't render empty cards.
const SECTION_KEYS = [
  'plan',
  'criteriaStatus',
  'stakeholders',
  'systemsNotes',
  'riskNotes',
  'decisions',
  'exposure',
  'capacity',
  'forecasts',
  'experiments',
];

function isEmpty(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

export function parseGoalMd(rawBody) {
  const result = safeParseGoalJson(rawBody);
  if (!result.success) throw new Error(result.error);
  const goal = result.data;

  const title = goal.goal;
  const criteria = goal.successCriteria;
  const deadline = goal.deadline;

  const sections = SECTION_KEYS.filter((key) => !isEmpty(goal[key])).map((key) => ({
    key,
    data: goal[key],
  }));

  const focus = [...goal.log].reverse().find((e) => e.focus)?.focus ?? null;

  return { title, criteria, deadline, sections, focus };
}
