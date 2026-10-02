// Skill flow: the hard rules of a guided session, checked in code rather
// than left to the model's memory of the prompt. Each skill declares its
// place in the flow in its SKILL.md frontmatter:
//
//   writes:     keys it may write, comma-separated ("log" = append_log)
//   requires:   "goal" (needs a defined goal) or "any"
//   next:       skills it naturally hands off to
//   checkpoint: "true" for a skill that runs inside another one (elicit):
//               it keeps the calling skill's write rights and hands back
//               to it when finished
//
// The agent tools call canLoad / canWrite and return a refusal as a tool
// error, so the model corrects itself in the same turn. suggestSkills reads
// the goal for what is due, so the next move comes from real state.

import { WRITABLE_KEYS } from './ops.mjs';
import { STUB_CRITERION } from './schema.mjs';

export const FLOW_KEYS = [...WRITABLE_KEYS, 'log'];
const REQUIRES = ['goal', 'any'];

/** A goal that has been named but not defined: intake has not run. */
export function isStub(goal) {
  return goal.successCriteria.length === 1 && goal.successCriteria[0].text === STUB_CRITERION;
}

const list = (s) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

/**
 * A skill's flow fields from its parsed frontmatter.
 * @returns {{ name: string, writes: string[], requires: 'goal'|'any', next: string[], checkpoint: boolean, errors: string[] }}
 */
export function skillFlow(name, meta) {
  const writes = list(meta.writes);
  const next = list(meta.next);
  const requires = meta.requires ?? 'goal';
  const errors = [
    ...writes.filter((k) => !FLOW_KEYS.includes(k)).map((k) => `writes: "${k}" is not a goal key`),
    ...(REQUIRES.includes(requires) ? [] : [`requires: must be one of ${REQUIRES.join(', ')}`]),
  ];
  return { name, writes, requires, next, checkpoint: meta.checkpoint === 'true', errors };
}

/** Skills whose `writes` include this key. */
export function writersOf(key, skills) {
  return skills.filter((s) => s.writes.includes(key)).map((s) => s.name);
}

/** May this skill be loaded against this goal? */
export function canLoad(skill, goal) {
  if (skill.requires === 'goal' && isStub(goal)) {
    return { ok: false, error: `the goal is not defined yet, so ${skill.name} has nothing to work on; load intake first` };
  }
  return { ok: true };
}

/**
 * May the session write this key now?
 * @param {{ active?: string, caller?: string, fresh: string[] }} session
 *   active: the loaded skill; caller: the skill a checkpoint runs inside;
 *   fresh: skills loaded during the current turn.
 * @param {string} key  goal key, or "log" for append_log
 * @param {'write_section'|'set_status'|'append_log'} op
 * @param {ReturnType<typeof skillFlow>[]} skills
 */
export function canWrite(session, key, op, skills) {
  const byName = (n) => skills.find((s) => s.name === n);
  const owners = writersOf(key, skills);
  const who = owners.length ? owners.join(' or ') : 'no skill';
  const active = session.active ? byName(session.active) : undefined;
  if (!active) return { ok: false, error: `no skill is active; ${key} is written by ${who}, so load that first` };
  const granting = [active, active.checkpoint && session.caller ? byName(session.caller) : undefined]
    .find((s) => s?.writes.includes(key));
  if (!granting) return { ok: false, error: `${active.name} does not write ${key}; ${key} is written by ${who}` };
  // Elicit before committing: a skill shows the user its read and writes
  // only after they answer, so never in the turn it was loaded. Status
  // flips and log entries record what the user just said, so they pass.
  if (op === 'write_section' && session.fresh.includes(granting.name)) {
    return { ok: false, error: `${granting.name} was loaded this turn; show the user your read as a confirm reply and write after they answer` };
  }
  return { ok: true };
}

const DAY = 86_400_000;
const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);
const n = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** Days between reviews before a section reads as stale. */
export const REVIEW_DAYS = { eval: 14, strategy: 30, capacity: 30 };

/**
 * What the goal says is due, most pressing first.
 * @param {object} goal
 * @param {string} today YYYY-MM-DD
 * @returns {{ skill: string, why: string }[]}
 */
export function suggestSkills(goal, today) {
  if (isStub(goal)) return [{ skill: 'intake', why: 'the goal is not defined yet' }];
  const out = [];
  const due = (d) => d && d <= today;

  const forecasts = goal.forecasts.filter((f) => !f.resolved && due(f.resolvesBy)).length;
  if (forecasts) out.push({ skill: 'forecast', why: `${n(forecasts, 'forecast')} ready to score` });
  const experiments = goal.experiments.filter((e) => !e.done && due(e.by)).length;
  if (experiments) out.push({ skill: 'experiment', why: `${n(experiments, 'experiment')} past ${experiments === 1 ? 'its' : 'their'} date` });
  const reviews = goal.decisions.filter((d) => (d.status ?? 'decided') === 'decided' && due(d.reviewBy)).length;
  const open = goal.decisions.filter((d) => d.status === 'open').length;
  if (reviews) out.push({ skill: 'decide', why: `${n(reviews, 'decision')} due for review` });
  else if (open) out.push({ skill: 'decide', why: `${n(open, 'open decision')} waiting` });

  if (!goal.posture) out.push({ skill: 'strategy', why: 'no focus or posture set yet' });
  else if (days(goal.posture.lastReviewed, today) >= REVIEW_DAYS.strategy) {
    out.push({ skill: 'strategy', why: `focus last reviewed ${days(goal.posture.lastReviewed, today)} days ago` });
  }
  if (!goal.plan) out.push({ skill: 'plan', why: 'no plan yet' });

  if (goal.plan) {
    const evals = goal.log.filter((e) => e.source === 'eval' && e.date).map((e) => e.date).sort();
    const since = evals.at(-1) ?? goal.log.map((e) => e.date).filter(Boolean).sort()[0];
    if (since && days(since, today) >= REVIEW_DAYS.eval) {
      out.push({ skill: 'eval', why: evals.length ? `last progress check ${days(since, today)} days ago` : 'no progress check yet' });
    }
    if (!goal.capacity) out.push({ skill: 'capacity', why: 'real hours and money not checked yet' });
    else if (days(goal.capacity.lastReviewed, today) >= REVIEW_DAYS.capacity) {
      out.push({ skill: 'capacity', why: `capacity last checked ${days(goal.capacity.lastReviewed, today)} days ago` });
    }
  }
  return out;
}
