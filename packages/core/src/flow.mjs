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
//   phase:      its place in the method (PHASES), or "any" for a skill
//               outside the cycle (onboard, brief, elicit)
//
// The agent tools call canLoad / canWrite and return a refusal as a tool
// error, so the model corrects itself in the same turn. suggestSkills reads
// the goal for what is due, so the next move comes from real state.
//
// The method: every goal moves through the same phases in the same order,
// after military planning (understand, develop, decide, plan, then assess
// and loop). methodStep reads the goal for the first phase not yet done,
// so skills follow one order rather than whichever came to mind. How much
// each phase asks scales with the goal: a goal that rests on other
// people's decisions (an influence criterion) needs its stakeholders
// mapped, its routes compared and its plan red-teamed; a picnic goes
// straight from focus to plan.
//
// `sitrep` takes several updates at once: canRoute checks its routing (each
// update to the skill that writes it), the user confirms it, and in the
// turn that follows each routed skill is cleared to write in the turn it
// loads (FlowSession.cleared), so the whole batch lands in that one turn.

import { WRITABLE_KEYS, currentFocusEntry } from './ops.mjs';
import { STUB_CRITERION, focusLineOf, hasBranch } from './schema.mjs';

export const FLOW_KEYS = [...WRITABLE_KEYS, 'log'];
const REQUIRES = ['goal', 'any'];

/**
 * The method's phases, in order. define: what we want. understand: who
 * decides and what moves them. direct: where to push, and how hard.
 * develop: the real routes. plan: what happens, in what order, and what if
 * it stalls. stress: how it fails, and what it costs the user. run: work
 * it, assess, and loop back to direct.
 */
export const PHASES = ['define', 'understand', 'direct', 'develop', 'plan', 'stress', 'run'];
const SKILL_PHASES = [...PHASES, 'any'];

/** A goal that has been named but not defined: intake has not run. */
export function isStub(goal) {
  return goal.successCriteria.length === 1 && goal.successCriteria[0].text === STUB_CRITERION;
}

const list = (s) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

/** @typedef {{ name: string, writes: string[], reads: string[], requires: string, next: string[], phase: string, checkpoint: boolean, errors: string[] }} SkillFlow */
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
  const phase = meta.phase ?? '';
  const errors = [
    ...writes.filter((k) => !FLOW_KEYS.includes(k)).map((k) => `writes: "${k}" is not a goal key`),
    ...reads.filter((k) => !WRITABLE_KEYS.includes(k)).map((k) => `reads: "${k}" is not a writable goal key`),
    ...(reads.length && !WRITABLE_KEYS.includes(writes[0]) ? ['reads: needs a section of its own as the first key in writes'] : []),
    ...(REQUIRES.includes(requires) ? [] : [`requires: must be one of ${REQUIRES.join(', ')}`]),
    ...(SKILL_PHASES.includes(phase) ? [] : [`phase: must be one of ${SKILL_PHASES.join(', ')}`]),
  ];
  return { name, writes, reads, requires, next, phase, checkpoint: meta.checkpoint === 'true', errors };
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
 * May this skill be loaded against this goal? A skill further on in the
 * method than the goal has reached still loads, with a warning naming the
 * phase it skips: the user may want just this one thing, and refusing
 * would stop them.
 * @param {SkillFlow} skill
 * @returns {{ ok: true, warning?: string } | { ok: false, error: string }}
 */
export function canLoad(skill, goal) {
  if (skill.requires === 'goal' && isStub(goal)) {
    return { ok: false, error: `the goal is not defined yet, so ${skill.name} has nothing to work on; load intake first` };
  }
  const step = methodStep(goal);
  if (step.skill && step.skill !== skill.name && PHASES.indexOf(skill.phase) > PHASES.indexOf(step.phase)) {
    return {
      ok: true,
      warning: `the method is at ${step.phase} (${step.why}); ${skill.name} belongs to ${skill.phase}, further on. If the user came for ${skill.name}'s own work, say in one line what it skips and offer ${step.skill} first, then go ahead if they still want it. A quick status update needs no mention.`,
    };
  }
  return { ok: true };
}

/** @typedef {{ phase: string, skill?: string, why?: string, todo?: string }} MethodStep */

/**
 * The first phase of the method this goal hasn't done, with the skill that
 * does it. Each phase asks only what the goal calls for, so a goal that
 * needs no stakeholders, routes or red-team passes straight through.
 * @returns {MethodStep}
 */
export function methodStep(goal) {
  if (isStub(goal)) return { phase: 'define', skill: 'intake', why: 'the goal is not defined yet', todo: 'Define the goal' };
  const influenced = goal.successCriteria.filter((c) => c.kind === 'influence').length;
  if (influenced && !goal.stakeholders.length) {
    return { phase: 'understand', skill: 'stakeholders', why: `${n(influenced, 'criterion', 'criteria')} ${influenced === 1 ? 'depends' : 'depend'} on others; no one mapped`, todo: 'Map who else has a say' };
  }
  if (!goal.posture && !currentFocusEntry(goal.log)) return { phase: 'direct', skill: 'strategy', why: 'no focus set yet', todo: 'Set the focus' };
  const courses = goal.courses ?? [];
  if (courses.length && !courses.some((c) => c.chosen)) return { phase: 'develop', skill: 'options', why: 'routes compared, none chosen', todo: 'Pick a route' };
  if (!goal.plan && influenced && !courses.length) {
    return { phase: 'develop', skill: 'options', why: 'success rests on others; no routes compared yet', todo: 'Compare the routes' };
  }
  if (!goal.plan) return { phase: 'plan', skill: 'plan', why: 'no plan yet', todo: 'Make a plan' };
  const focus = focusLineOf(goal.plan);
  if (!hasBranch(focus)) return { phase: 'plan', skill: 'plan', why: `"${focus.label}" has no if-then yet`, todo: 'Decide what happens if it stalls' };
  const rungs = goal.plan.linesOfOperation.flatMap((l) => l.ladder ?? []);
  if ((influenced || goal.stakeholders.length || rungs.length) && !goal.riskNotes.some((r) => r.source === 'threat')) {
    return { phase: 'stress', skill: 'threat', why: 'plan not red-teamed yet', todo: 'Find weak spots in the plan' };
  }
  if (rungs.some((r) => r.level === 'power' && (r.status === 'pending' || r.status === 'sent')) && !goal.exposure.length) {
    return { phase: 'stress', skill: 'exposure', why: 'the ladder ends in public; your own risk not checked', todo: 'Check your own risk before going public' };
  }
  return { phase: 'run' };
}

/** The state-block line naming where the goal sits in the method. */
export function methodText(goal) {
  const step = methodStep(goal);
  return step.skill
    ? `Method: ${step.phase}, next ${step.skill} (${step.why}).`
    : 'Method: run. Work the plan; loop back to strategy on a review, a stale focus or a branch taken.';
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
/** "a forecast", "an open question", or "3 forecasts": a count as the page says it. */
const some = (count, one) => (count === 1 ? `${/^[aeiou]/.test(one) ? 'an' : 'a'} ${one}` : `${count} ${one}s`);

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
 * @returns {{ skill: string, why: string, todo: string }[]}
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
    if (moved.length) out.push({ skill: s.name, why: `${and(moved.map(words))} changed since ${s.name} last ran`, todo: `Update the ${words(key)}` });
  }
  return out;
}

/**
 * What the goal says is due, most pressing first: `why` tells the model,
 * `todo` is the same item as an action the page offers the user. Dated
 * items come first (a forecast to score, a rung with no reply, a deadline
 * close with no premortem), then the method's next phase, then the
 * reviews that keep a running goal honest, then, given the skill flows,
 * sections built before one of their inputs changed.
 * @param {object} goal
 * @param {string} today YYYY-MM-DD
 * @param {SkillFlow[]} [skills]
 * @returns {{ skill: string, why: string, todo: string }[]}
 */
export function suggestSkills(goal, today, skills = []) {
  if (isStub(goal)) return [{ skill: 'intake', why: 'the goal is not defined yet', todo: 'Define the goal' }];
  const out = [];
  const due = (d) => d && d <= today;
  const past = (d) => d && d < today;
  const lines = goal.plan?.linesOfOperation ?? [];

  const forecasts = goal.forecasts.filter((f) => !f.resolved && due(f.resolvesBy)).length;
  if (forecasts) out.push({ skill: 'forecast', why: `${n(forecasts, 'forecast')} ready to score`, todo: `Score ${some(forecasts, 'forecast')}` });
  const experiments = goal.experiments.filter((e) => !e.done && due(e.by)).length;
  if (experiments) out.push({ skill: 'experiment', why: `${n(experiments, 'experiment')} past ${experiments === 1 ? 'its' : 'their'} date`, todo: `Record ${experiments === 1 ? 'an experiment result' : `${experiments} experiment results`}` });
  const overdue = lines.flatMap((l) => l.nextActions).filter((a) => a.status === 'pending' && past(a.when)).length;
  if (overdue) out.push({ skill: 'plan', why: `${n(overdue, 'move')} overdue`, todo: `Catch up on ${some(overdue, 'overdue move')}` });
  for (const l of lines) {
    const ladder = l.ladder ?? [];
    const at = ladder.findIndex((r) => r.status === 'sent');
    const sent = ladder[at];
    if (sent?.sentOn && days(sent.sentOn, today) >= sent.waitDays) {
      const next = ladder.slice(at + 1).find((r) => r.status === 'pending');
      out.push({
        skill: 'plan',
        why: `no reply from ${sent.to} in ${n(days(sent.sentOn, today), 'day')}; ${next ? `next rung: ${next.to}` : 'no rung left'}`,
        todo: next ? `Take it to ${next.to}` : `Rethink the ask to ${sent.to}`,
      });
    }
    for (const r of ladder.filter((x) => x.status === 'answered' && !x.outcome)) {
      out.push({ skill: 'plan', why: `${r.to} answered; what they said isn't recorded`, todo: `Record what ${r.to} said` });
    }
    for (const d of (l.decisionPoints ?? []).filter((x) => x.status === 'open' && due(x.by))) {
      out.push({ skill: 'plan', why: `decision point due: ${d.if}`, todo: `Check: ${d.if}` });
    }
  }
  const questions = (goal.intel ?? []).filter((q) => q.status === 'open' && due(q.by)).length;
  if (questions) out.push({ skill: 'recon', why: `${n(questions, 'open question')} due`, todo: `Answer ${some(questions, 'open question')}` });
  const talks = (goal.prep ?? []).filter((p) => !p.done && past(p.on));
  if (talks.length === 1) out.push({ skill: 'negotiate', why: `talk with ${talks[0].with} on ${sayDate(talks[0].on, today)} needs its outcome recorded`, todo: `Record how the talk with ${talks[0].with} went` });
  else if (talks.length) out.push({ skill: 'negotiate', why: `${talks.length} talks need their outcomes recorded`, todo: `Record how ${talks.length} talks went` });
  const reviews = goal.decisions.filter((d) => (d.status ?? 'decided') === 'decided' && due(d.reviewBy)).length;
  const open = goal.decisions.filter((d) => d.status === 'open').length;
  if (reviews) out.push({ skill: 'decide', why: `${n(reviews, 'decision')} due for review`, todo: `Review ${some(reviews, 'decision')}` });
  else if (open) out.push({ skill: 'decide', why: `${n(open, 'open decision')} waiting`, todo: `Settle ${some(open, 'open decision')}` });

  const left = goal.deadline ? days(today, goal.deadline) : -1;
  if (left >= 0 && left <= PREMORTEM_DAYS && !goal.riskNotes.some((r) => r.source === 'premortem')) {
    out.push({ skill: 'premortem', why: `${left ? `deadline in ${n(left, 'day')}` : 'deadline today'}, no premortem yet`, todo: 'Find what could sink this before the deadline' });
  }

  const step = methodStep(goal);
  if (step.skill) out.push({ skill: step.skill, why: step.why, todo: step.todo });

  const focused = goal.posture?.lastReviewed ?? currentFocusEntry(goal.log)?.date;
  if (focused && days(focused, today) >= REVIEW_DAYS.strategy) {
    out.push({ skill: 'strategy', why: `focus last reviewed ${days(focused, today)} days ago`, todo: 'Review your focus' });
  }
  if (goal.plan) {
    const evals = goal.log.filter((e) => e.source === 'eval' && e.date).map((e) => e.date).sort();
    const since = evals.at(-1) ?? goal.log.map((e) => e.date).filter(Boolean).sort()[0];
    if (since && days(since, today) >= REVIEW_DAYS.eval) {
      out.push({ skill: 'eval', why: evals.length ? `last progress check ${days(since, today)} days ago` : 'no progress check yet', todo: 'Check progress' });
    }
    if (!goal.capacity) out.push({ skill: 'capacity', why: 'real hours and money not checked yet', todo: 'Check your real hours and money' });
    else if (days(goal.capacity.lastReviewed, today) >= REVIEW_DAYS.capacity) {
      out.push({ skill: 'capacity', why: `capacity last checked ${days(goal.capacity.lastReviewed, today)} days ago`, todo: 'Recheck your hours and money' });
    }
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
