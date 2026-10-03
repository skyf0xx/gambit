// Skill flow: the hard rules of a guided session, checked in code rather
// than left to the model's memory of the prompt. Each skill declares its
// place in the flow in its SKILL.md frontmatter:
//
//   writes:     keys it may write, comma-separated ("log" = append_log)
//   requires:   "goal" (needs a defined goal) or "any"
//   next:       skills it naturally hands off to
//   reads:      keys its section is built from; when one changes after the
//               section was last written, suggestSkills flags the section
//               as out of date. The section is the first key in `writes`.
//   checkpoint: "true" for a skill that runs inside another one (elicit):
//               it keeps the calling skill's write rights and hands back
//               to it when finished
//
// The agent tools call canLoad / canWrite and return a refusal as a tool
// error, so the model corrects itself in the same turn. suggestSkills reads
// the goal for what is due, so the next move comes from real state.
//
// `sitrep` takes several updates at once: canRoute checks its routing (each
// update to the skill that writes it), the user confirms it, and in the
// turn that follows each routed skill is cleared to write in the turn it
// loads (FlowSession.cleared), so the whole batch lands in that one turn.

import { WRITABLE_KEYS } from './ops.mjs';
import { STUB_CRITERION } from './schema.mjs';

export const FLOW_KEYS = [...WRITABLE_KEYS, 'log'];
const REQUIRES = ['goal', 'any'];

/** A goal that has been named but not defined: intake has not run. */
export function isStub(goal) {
  return goal.successCriteria.length === 1 && goal.successCriteria[0].text === STUB_CRITERION;
}

const list = (s) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

/** @typedef {{ name: string, writes: string[], reads: string[], requires: string, next: string[], checkpoint: boolean, errors: string[] }} SkillFlow */
/** @typedef {{ skill: string, update: string }} RoutedUpdate */
/**
 * @typedef {{ active?: string, caller?: string, fresh: string[], cleared?: string[], routed?: RoutedUpdate[] }} FlowSession
 *   active: the loaded skill; caller: the skill a checkpoint runs inside;
 *   fresh: skills loaded during the current turn; cleared: skills the user
 *   confirmed a routed update for last turn, which may write in the turn
 *   they load; routed: the routing `sitrep` set this turn.
 */

/**
 * A skill's flow fields from its parsed frontmatter.
 * @param {string} name
 * @param {Record<string, string>} meta
 * @returns {SkillFlow}
 */
export function skillFlow(name, meta) {
  const writes = list(meta.writes);
  const reads = list(meta.reads);
  const next = list(meta.next);
  const requires = meta.requires ?? 'goal';
  const errors = [
    ...writes.filter((k) => !FLOW_KEYS.includes(k)).map((k) => `writes: "${k}" is not a goal key`),
    ...reads.filter((k) => !WRITABLE_KEYS.includes(k)).map((k) => `reads: "${k}" is not a writable goal key`),
    ...(reads.length && !WRITABLE_KEYS.includes(writes[0]) ? ['reads: needs a section of its own as the first key in writes'] : []),
    ...(REQUIRES.includes(requires) ? [] : [`requires: must be one of ${REQUIRES.join(', ')}`]),
  ];
  return { name, writes, reads, requires, next, checkpoint: meta.checkpoint === 'true', errors };
}

/**
 * Skills whose `writes` include this key.
 * @param {string} key
 * @param {SkillFlow[]} skills
 */
export function writersOf(key, skills) {
  return skills.filter((s) => s.writes.includes(key)).map((s) => s.name);
}

/**
 * May this skill be loaded against this goal?
 * @param {SkillFlow} skill
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function canLoad(skill, goal) {
  if (skill.requires === 'goal' && isStub(goal)) {
    return { ok: false, error: `the goal is not defined yet, so ${skill.name} has nothing to work on; load intake first` };
  }
  return { ok: true };
}

/**
 * May the session write this key now?
 * @param {FlowSession} session
 * @param {string} key  goal key, or "log" for append_log
 * @param {'write_section'|'set_status'|'append_log'} op
 * @param {SkillFlow[]} skills
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function canWrite(session, key, op, skills) {
  const byName = (/** @type {string} */ n) => skills.find((s) => s.name === n);
  const owners = writersOf(key, skills);
  const who = owners.length ? owners.join(' or ') : 'no skill';
  const active = session.active ? byName(session.active) : undefined;
  if (!active) return { ok: false, error: `no skill is active; ${key} is written by ${who}, so load that first` };
  const granting = [active, active.checkpoint && session.caller ? byName(session.caller) : undefined]
    .find((s) => s?.writes.includes(key));
  if (!granting) return { ok: false, error: `${active.name} does not write ${key}; ${key} is written by ${who}` };
  // Elicit before committing: a skill shows the user its read and writes
  // only after they answer, so never in the turn it was loaded. Status
  // flips and log entries record what the user just said, so they pass,
  // and so does a skill whose routed update the user just confirmed.
  if (op === 'write_section' && session.fresh.includes(granting.name) && !session.cleared?.includes(granting.name)) {
    return { ok: false, error: `${granting.name} was loaded this turn; show the user your read as a confirm reply and write after they answer` };
  }
  return { ok: true };
}

/** The skill that routes several updates at once. */
export const ROUTER_SKILL = 'sitrep';

/** Most updates one routing holds. */
export const ROUTED_MAX = 6;

/**
 * May the session route these updates? Only while `sitrep` is active, and
 * only to skills that exist and write something.
 * @param {FlowSession} session
 * @param {RoutedUpdate[]} items
 * @param {SkillFlow[]} skills
 * @returns {{ ok: true, routed: RoutedUpdate[] } | { ok: false, error: string }}
 */
export function canRoute(session, items, skills) {
  if (session.active !== ROUTER_SKILL) {
    return { ok: false, error: `only ${ROUTER_SKILL} routes updates; load ${ROUTER_SKILL} first, or load the one skill this update needs` };
  }
  if (!items.length) return { ok: false, error: 'nothing to route; pass at least one update' };
  if (items.length > ROUTED_MAX) return { ok: false, error: `route at most ${ROUTED_MAX} updates at once; keep the rest for the next round` };
  const routed = [];
  for (const { skill, update } of items) {
    const flow = skills.find((s) => s.name === skill);
    if (!flow) return { ok: false, error: `no skill "${skill}"; route each update to a skill in the skill index` };
    if (skill === ROUTER_SKILL || !flow.writes.length) return { ok: false, error: `${skill} writes nothing, so it cannot take an update` };
    const text = String(update ?? '').trim();
    if (!text) return { ok: false, error: `the update for ${skill} is empty; say what changed` };
    routed.push({ skill, update: text });
  }
  return { ok: true, routed };
}

/** The state-block line for routed updates the user confirmed, or ''. */
export function routedText(routed) {
  if (!routed?.length) return '';
  return `Routed updates the user confirmed: ${routed.map((r) => `${r.skill} — ${r.update}`).join('; ')}. Load each in turn and write it now; skip any the user just turned down.`;
}

const DAY = 86_400_000;
const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);
const n = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** Days between reviews before a section reads as stale. */
export const REVIEW_DAYS = { eval: 14, strategy: 30, capacity: 30 };

const words = (k) => k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
const empty = (v) => v == null || (Array.isArray(v) && v.length === 0);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "3 Oct", or "3 Oct 2027" outside today's year. */
const sayDate = (d, today) => {
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${MONTHS[m - 1]}${d.slice(0, 4) === today.slice(0, 4) ? '' : ` ${y}`}`;
};
/** Days before the deadline when a missing premortem becomes due. */
export const PREMORTEM_DAYS = 14;
const and = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/**
 * Sections built before one of their inputs changed: for each skill with
 * `reads`, the inputs stamped in `goal.updated` after its section was.
 * A section with no stamp falls back to its own `lastReviewed`.
 * @param {object} goal
 * @param {SkillFlow[]} skills
 * @returns {{ skill: string, why: string }[]}
 */
export function staleSections(goal, skills) {
  const stamps = goal.updated ?? {};
  const out = [];
  for (const s of skills) {
    const key = s.writes[0];
    if (!s.reads.length || empty(goal[key])) continue;
    const built = stamps[key] ?? goal[key].lastReviewed;
    if (!built) continue;
    const moved = s.reads.filter((k) => stamps[k] && stamps[k] > built);
    if (moved.length) out.push({ skill: s.name, why: `${and(moved.map(words))} changed since ${s.name} last ran` });
  }
  return out;
}

/**
 * What the goal says is due, most pressing first. Given the skill flows,
 * sections built before one of their inputs changed come last.
 * @param {object} goal
 * @param {string} today YYYY-MM-DD
 * @param {SkillFlow[]} [skills]
 * @returns {{ skill: string, why: string }[]}
 */
export function suggestSkills(goal, today, skills = []) {
  if (isStub(goal)) return [{ skill: 'intake', why: 'the goal is not defined yet' }];
  const out = [];
  const due = (d) => d && d <= today;
  const past = (d) => d && d < today;

  const forecasts = goal.forecasts.filter((f) => !f.resolved && due(f.resolvesBy)).length;
  if (forecasts) out.push({ skill: 'forecast', why: `${n(forecasts, 'forecast')} ready to score` });
  const experiments = goal.experiments.filter((e) => !e.done && due(e.by)).length;
  if (experiments) out.push({ skill: 'experiment', why: `${n(experiments, 'experiment')} past ${experiments === 1 ? 'its' : 'their'} date` });
  const overdue = (goal.plan?.linesOfOperation ?? []).flatMap((l) => l.nextActions).filter((a) => a.status === 'pending' && past(a.when)).length;
  if (overdue) out.push({ skill: 'plan', why: `${n(overdue, 'move')} overdue` });
  const questions = (goal.intel ?? []).filter((q) => q.status === 'open' && due(q.by)).length;
  if (questions) out.push({ skill: 'recon', why: `${n(questions, 'open question')} due` });
  const talks = (goal.prep ?? []).filter((p) => !p.done && past(p.on));
  if (talks.length === 1) out.push({ skill: 'negotiate', why: `talk with ${talks[0].with} on ${sayDate(talks[0].on, today)} needs its outcome recorded` });
  else if (talks.length) out.push({ skill: 'negotiate', why: `${talks.length} talks need their outcomes recorded` });
  const reviews = goal.decisions.filter((d) => (d.status ?? 'decided') === 'decided' && due(d.reviewBy)).length;
  const open = goal.decisions.filter((d) => d.status === 'open').length;
  if (reviews) out.push({ skill: 'decide', why: `${n(reviews, 'decision')} due for review` });
  else if (open) out.push({ skill: 'decide', why: `${n(open, 'open decision')} waiting` });

  const left = goal.deadline ? days(today, goal.deadline) : -1;
  if (left >= 0 && left <= PREMORTEM_DAYS && !goal.riskNotes.some((r) => r.source === 'premortem')) {
    out.push({ skill: 'premortem', why: `${left ? `deadline in ${n(left, 'day')}` : 'deadline today'}, no premortem yet` });
  }

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
    if (!goal.riskNotes.some((r) => r.source === 'threat')) out.push({ skill: 'threat', why: 'plan not red-teamed yet' });
  }
  const influenced = goal.successCriteria.filter((c) => c.kind === 'influence').length;
  if (influenced && !goal.stakeholders.length) {
    out.push({ skill: 'stakeholders', why: `${n(influenced, 'criterion', 'criteria')} ${influenced === 1 ? 'depends' : 'depend'} on others; no one mapped` });
  }
  for (const s of staleSections(goal, skills)) if (!out.some((o) => o.skill === s.skill)) out.push(s);
  return out;
}

/** How many due items the state block and the page show. */
export const DUE_SHOWN = 3;

/**
 * The most pressing items suggestSkills finds, for the turn's state block
 * and the page alike.
 * @param {object} goal
 * @param {string} today YYYY-MM-DD
 * @param {SkillFlow[]} [skills]
 */
export function dueNow(goal, today, skills = [], count = DUE_SHOWN) {
  return suggestSkills(goal, today, skills).slice(0, count);
}
