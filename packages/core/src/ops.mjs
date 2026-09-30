// Pure goal-mutation operations shared by any front end. Each takes a goal
// document and returns a result object instead of throwing, so an agent tool
// can hand structured errors straight back to the model.

import { goalSchema, reconcileGoal, writeRules, GOAL_MAX_WORDS, wordCount } from './schema.mjs';

/** @typedef {import('zod').infer<typeof goalSchema>} Goal */
/** @typedef {{ path: string, message: string }} Issue */

// Every top-level key except the version stamp and the append-only log can be
// replaced wholesale by whichever skill owns it.
export const WRITABLE_KEYS = Object.keys(goalSchema.shape).filter((k) => k !== 'schemaVersion' && k !== 'log');

const logEntrySchema = goalSchema.shape.log.element;
const STATUSES = ['proposed', 'pending', 'done', 'dropped'];

// `log` is append-only but bounded: the page only needs recent history plus
// whichever entry currently drives the focus highlight.
export const LOG_CAP = 30;

/**
 * Keep the newest LOG_CAP entries, but always keep the most recent entry
 * that carries a focusLine, even if it would otherwise fall outside the cap
 * — the page's highlighter reads it regardless of age.
 */
export function capLog(entries) {
  if (entries.length <= LOG_CAP) return entries;
  const kept = entries.slice(-LOG_CAP);
  const keptHasFocus = kept.some((e) => e.focusLine);
  if (keptHasFocus) return kept;
  for (let i = entries.length - LOG_CAP - 1; i >= 0; i--) {
    if (entries[i].focusLine) return [entries[i], ...kept];
  }
  return kept;
}

const toIssues = (error, prefix = []) =>
  error.issues.map((i) => ({ path: [...prefix, ...i.path].join('.') || '(root)', message: i.message }));

/**
 * Replace one owned key. Validates against that key's sub-schema, then the
 * whole document.
 * @returns {{ ok: true, goal: Goal, warnings: string[] } | { ok: false, errors: Issue[] }}
 */
export function writeSection(goal, key, value) {
  if (!WRITABLE_KEYS.includes(key)) {
    return { ok: false, errors: [{ path: key, message: `not a writable key; expected one of: ${WRITABLE_KEYS.join(', ')}` }] };
  }
  // The 10-word cap on the goal sentence is enforced here, on the write
  // path, rather than in the schema itself — an existing goal written under
  // the old rule must still be readable. Split any parts or conditions
  // (the clause after a dash, etc.) into subGoals instead of packing them
  // into the goal sentence.
  if (key === 'goal' && typeof value === 'string' && wordCount(value) > GOAL_MAX_WORDS) {
    return {
      ok: false,
      errors: [{
        path: 'goal',
        message: `goal must be ${GOAL_MAX_WORDS} words or fewer (got ${wordCount(value)}); move parts or conditions into subGoals instead`,
      }],
    };
  }
  const part = (writeRules[key] ?? goalSchema.shape[key]).safeParse(value);
  if (!part.success) return { ok: false, errors: toIssues(part.error, [key]) };
  const next = goalSchema.safeParse({ ...goal, [key]: part.data });
  if (!next.success) return { ok: false, errors: toIssues(next.error) };
  return { ok: true, goal: next.data, warnings: reconcileGoal(next.data) };
}

/** Append one log entry (the only append path). */
export function appendLog(goal, entry) {
  const parsed = logEntrySchema.safeParse(entry);
  if (!parsed.success) return { ok: false, errors: toIssues(parsed.error, ['log']) };
  const next = goalSchema.safeParse({ ...goal, log: capLog([...goal.log, parsed.data]) });
  if (!next.success) return { ok: false, errors: toIssues(next.error) };
  return { ok: true, goal: next.data, warnings: [] };
}

/**
 * Flip a single step, sub-item or next action to proposed/pending/done/dropped
 * ('proposed' is valid on next actions only; the schema rejects it elsewhere).
 * `path` is dotted, e.g. "plan.linesOfOperation.0.nextActions.2".
 */
export function setStatus(goal, path, status) {
  if (!STATUSES.includes(status)) return { ok: false, errors: [{ path: 'status', message: `must be one of ${STATUSES.join(', ')}` }] };
  const parts = String(path).split('.').filter(Boolean);
  const copy = structuredClone(goal);
  let node = copy;
  for (const p of parts) {
    node = node?.[p];
    if (node === undefined) return { ok: false, errors: [{ path, message: `nothing at "${p}"` }] };
  }
  if (typeof node !== 'object' || node === null || !STATUSES.includes(node.status ?? 'pending')) {
    return { ok: false, errors: [{ path, message: 'target is not a step, sub-item or next action with a proposed/pending/done/dropped status' }] };
  }
  node.status = status;
  // Turning a move into a proposal is a write of that proposal, so it meets
  // the same rule as write_section (writeRules.plan). Keeping or tossing a
  // proposal that predates the rule stays allowed.
  if (status === 'proposed' && parts[0] === 'plan') {
    const rule = writeRules.plan.safeParse(copy.plan);
    if (!rule.success) return { ok: false, errors: toIssues(rule.error, ['plan']) };
  }
  const next = goalSchema.safeParse(copy);
  if (!next.success) return { ok: false, errors: toIssues(next.error) };
  return { ok: true, goal: next.data, warnings: reconcileGoal(next.data) };
}

const LABELS = { riskNotes: 'risk', criteriaStatus: 'criteria', successCriteria: 'criteria', stakeholders: 'stakeholder', systemsNotes: 'systems notes' };
const label = (k) => LABELS[k] ?? k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

function taskStats(plan) {
  let tasks = 0;
  const statuses = [];
  for (const line of plan?.linesOfOperation ?? []) {
    for (const s of line.criticalPath) { tasks++; statuses.push(s.status); }
    for (const a of line.nextActions) { tasks++; statuses.push(a.status); }
  }
  return { tasks, statuses };
}

/** Short human-readable summary of what changed between two goal documents. */
export function summarizeChange(before, after) {
  const out = [];
  for (const key of Object.keys(goalSchema.shape)) {
    if (key === 'schemaVersion') continue;
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (key === 'plan') {
      const x = taskStats(a);
      const y = taskStats(b);
      const delta = y.tasks - x.tasks;
      const flips = y.statuses.filter((s, i) => x.statuses[i] !== undefined && x.statuses[i] !== s).length;
      if (delta) out.push(`${delta > 0 ? '+' : ''}${delta} tasks`);
      if (flips) out.push(`${flips} status ${flips === 1 ? 'change' : 'changes'}`);
      if (!delta && !flips) out.push('plan updated');
    } else if (Array.isArray(b)) {
      const delta = b.length - (a?.length ?? 0);
      out.push(delta ? `${delta > 0 ? '+' : ''}${delta} ${label(key)}` : `${label(key)} updated`);
    } else {
      out.push(`${label(key)} updated`);
    }
  }
  return out;
}
