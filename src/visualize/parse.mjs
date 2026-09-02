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

  const posture = goal.posture;

  // Single most useful next action across every line of operation, for the
  // always-visible Bridge. "Most useful" here just means "the first pending
  // one written" — plan writes nextActions in priority order per line, and
  // the first line of operation is itself the one plan.mjs leads with — so
  // the first line's first still-open action is the closest thing to a
  // single next step without inventing a cross-line prioritization the
  // schema doesn't carry. done/dropped actions are skipped: they're not a
  // next step anymore, just a record of one that closed out.
  const firstPending = (l) => l.nextActions?.find((a) => (a.status ?? 'pending') === 'pending');
  const lineWithPending = goal.plan?.linesOfOperation.find((l) => firstPending(l));
  const nextAction = lineWithPending ? firstPending(lineWithPending) : null;

  return { title, criteria, deadline, sections, focus, posture, nextAction };
}
