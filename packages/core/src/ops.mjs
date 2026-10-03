// Pure goal-mutation operations shared by any front end. Each takes a goal
// document and returns a result object instead of throwing, so an agent tool
// can hand structured errors straight back to the model.

import { goalSchema, reconcileGoal, writeRules, GOAL_MAX_WORDS, MEMORY_CAP, NEXT_ACTIONS_MAX, wordCount } from './schema.mjs';
import { plainLanguage } from './readability.mjs';

/** @typedef {import('zod').infer<typeof goalSchema>} Goal */
/** @typedef {{ path: string, message: string }} Issue */

// Every top-level key except the version stamp, the change stamps, the
// append-only log and memory (edited entry by entry through remember and
// forget) can be replaced wholesale by whichever skill owns it.
const UNWRITABLE = ['schemaVersion', 'updated', 'memory', 'log'];
export const WRITABLE_KEYS = Object.keys(goalSchema.shape).filter((k) => !UNWRITABLE.includes(k));

const logEntrySchema = goalSchema.shape.log.element;
const memoryEntrySchema = goalSchema.shape.memory.element;
const STATUSES = ['proposed', 'pending', 'done', 'dropped'];

// `log` is append-only but bounded: the page only needs recent history plus
// whichever entry currently drives the focus highlight.
export const LOG_CAP = 30;

/** Newest log entries the model reads each turn, and the window a new note
 * is checked against for repeats. */
export const LOG_RECENT = 5;

const STOPWORDS = new Set('the a an and or but of to in on at by for with from as is are was were be been it its this that these those not no nor so if then than into onto over under up out off has have had do does did will would can could should may might must just only also still yet now their there they them our your you his her him she he we who what when where which while'.split(' '));

const contentWords = (s) => new Set(
  s.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w)),
);

/**
 * Whether two short lines say mostly the same thing: at least 4 content
 * words in common, covering 60% or more of the shorter line's. Catches a
 * restatement in fresh words ("Complaint sent to council, Blackmore copied"
 * against "Complaint lodged with council, Blackmore copied") without
 * flagging two lines that merely share a name.
 */
export function sameLine(a, b) {
  const x = contentWords(a);
  const y = contentWords(b);
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared >= 4 && shared / Math.min(x.size, y.size) >= 0.6;
}

/** The skill that sets the focus, and so the only one whose log entry may
 * name a line for the page to highlight. */
export const FOCUS_SKILL = 'strategy';

/**
 * Whether a log entry sets the focus: it names one, and it came from
 * `strategy` (an entry with no source predates source stamping, when only
 * `strategy` was told to set a focus).
 */
export const isFocusEntry = (e) => e.focus != null && (!e.source || e.source === FOCUS_SKILL);

/** The entry holding the current focus: the newest one that sets a focus.
 * Its `focusLine`, if any, is the line the page highlights; a newer focus
 * with no single line clears the highlight rather than leaving an old one. */
export function currentFocusEntry(entries) {
  for (let i = entries.length - 1; i >= 0; i--) if (isFocusEntry(entries[i])) return entries[i];
  return undefined;
}

/**
 * Keep the newest LOG_CAP entries, but always keep the entry holding the
 * current focus, even if it would otherwise fall outside the cap — the
 * page's highlighter reads it regardless of age.
 */
export function capLog(entries) {
  if (entries.length <= LOG_CAP) return entries;
  const kept = entries.slice(-LOG_CAP);
  const focus = currentFocusEntry(entries);
  return !focus || kept.includes(focus) ? kept : [focus, ...kept];
}

const toIssues = (error, prefix = []) =>
  error.issues.map((i) => ({ path: [...prefix, ...i.path].join('.') || '(root)', message: i.message }));

/**
 * Replace one owned key. Validates against that key's sub-schema, then the
 * whole document. Each key whose value changes is stamped with `now` in
 * `updated`, so a section built on it can tell it has moved since.
 * @param {string} [now] ISO timestamp, defaults to the current time
 * @returns {{ ok: true, goal: Goal, warnings: string[] } | { ok: false, errors: Issue[] }}
 */
export function writeSection(goal, key, value, now = new Date().toISOString()) {
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
  const plain = plainLanguage.safeParse(part.data);
  if (!plain.success) return { ok: false, errors: toIssues(plain.error, [key]) };
  // A name lives in `people` or `stakeholders`, never both: two owners
  // writing about one person drift apart, and the stale copy reads as
  // current. `people` wins — someone you now deal with directly has left
  // the stakeholder map — so a stakeholders write naming them is refused,
  // and a people write takes them off the stakeholder list.
  const changes = { [key]: part.data };
  const moved = [];
  if (key === 'stakeholders') {
    const onSide = new Set(goal.people.map((p) => personKey(p.name)));
    const errors = part.data
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => onSide.has(personKey(s.name)))
      .map(({ s, i }) => ({
        path: `stakeholders.${i}.name`,
        message: `"${s.name}" is already in people; track them there only (drop them here, and put their stance or interest in that person's doing or detail)`,
      }));
    if (errors.length) return { ok: false, errors };
  }
  if (key === 'people') {
    const onSide = new Set(part.data.map((p) => personKey(p.name)));
    changes.stakeholders = goal.stakeholders.filter((s) => {
      if (!onSide.has(personKey(s.name))) return true;
      moved.push(s.name);
      return false;
    });
  }
  const updated = { ...goal.updated };
  for (const [k, v] of Object.entries(changes)) {
    if (JSON.stringify(v) !== JSON.stringify(goal[k])) updated[k] = now;
  }
  const next = goalSchema.safeParse({ ...goal, ...changes, updated });
  if (!next.success) return { ok: false, errors: toIssues(next.error) };
  const warnings = moved.map((n) => `"${n}" taken off stakeholders: they are in people now, so people is their only entry`);
  return { ok: true, goal: next.data, warnings: [...warnings, ...reconcileGoal(next.data)] };
}

const personKey = (name) => name.trim().toLowerCase();

/**
 * Append one log entry (the only append path). `writer`, when given, is
 * the skill writing it: it becomes the entry's `source` if none is set,
 * and only `strategy` may name a `focusLine` — anyone else's is dropped
 * with a warning, so a passing log entry can't move the page's highlight.
 */
export function appendLog(goal, entry, writer) {
  const warnings = [];
  if (writer) {
    entry = { source: writer, ...entry };
    if (entry.focusLine && writer !== FOCUS_SKILL) {
      const { focusLine, ...rest } = entry;
      entry = rest;
      warnings.push(`focusLine dropped: only ${FOCUS_SKILL} sets the line the page highlights`);
    }
  }
  const parsed = logEntrySchema.safeParse(entry);
  if (!parsed.success) return { ok: false, errors: toIssues(parsed.error, ['log']) };
  const plain = plainLanguage.safeParse(parsed.data);
  if (!plain.success) return { ok: false, errors: toIssues(plain.error, ['log']) };
  const repeats = repeatedNotes(parsed.data.notes, goal.log.slice(-LOG_RECENT));
  if (repeats.length) return { ok: false, errors: repeats };
  const next = goalSchema.safeParse({ ...goal, log: capLog([...goal.log, parsed.data]) });
  if (!next.success) return { ok: false, errors: toIssues(next.error) };
  return { ok: true, goal: next.data, warnings };
}

/**
 * A log entry records what changed in this exchange. A note that restates
 * one already in the recent log, or another note in the same entry, adds
 * nothing for the user or the model, so it is refused.
 */
function repeatedNotes(notes, recent) {
  const errors = [];
  notes.forEach((n, i) => {
    const twin = notes.slice(0, i).find((m) => sameLine(n, m));
    if (twin) {
      errors.push({ path: `log.notes.${i}`, message: `says the same as another note in this entry ("${twin}"); keep one` });
      return;
    }
    for (const e of [...recent].reverse()) {
      const old = e.notes.find((m) => sameLine(n, m));
      if (old) {
        errors.push({
          path: `log.notes.${i}`,
          message: `repeats the ${e.date}${e.source ? ` ${e.source}` : ''} entry ("${old}"); log only what changed this turn, and leave current state to its owning key`,
        });
        return;
      }
    }
  });
  return errors;
}

/**
 * Keep one thing the user told the advisor. `replaces`, an index into
 * `memory`, updates that entry in place: a correction or a change of mind
 * overwrites what it supersedes rather than sitting beside it. A new entry
 * that says the same as an existing one is refused and pointed at it, and
 * so is one past MEMORY_CAP, so nothing drops off silently.
 * @param {Goal} goal
 * @param {{ kind: string, text: string, replaces?: number }} item
 * @param {string} date YYYY-MM-DD
 */
export function remember(goal, { replaces, ...item }, date) {
  const parsed = memoryEntrySchema.safeParse({ ...item, date });
  if (!parsed.success) return { ok: false, errors: toIssues(parsed.error, ['memory']) };
  const plain = plainLanguage.safeParse(parsed.data);
  if (!plain.success) return { ok: false, errors: toIssues(plain.error, ['memory']) };
  const memory = [...goal.memory];
  if (replaces !== undefined) {
    if (!Number.isInteger(replaces) || !memory[replaces]) {
      return { ok: false, errors: [{ path: 'replaces', message: `no memory entry ${replaces}; there are ${memory.length}` }] };
    }
    memory[replaces] = parsed.data;
  } else {
    const twin = memory.findIndex((m) => sameLine(m.text, parsed.data.text));
    if (twin >= 0) {
      return { ok: false, errors: [{ path: 'memory', message: `entry ${twin} already says this ("${memory[twin].text}"); pass replaces: ${twin} to update it` }] };
    }
    if (memory.length >= MEMORY_CAP) {
      return { ok: false, errors: [{ path: 'memory', message: `memory is full (${MEMORY_CAP}); pass replaces with the entry this one matters more than, or forget one first` }] };
    }
    memory.push(parsed.data);
  }
  const next = goalSchema.safeParse({ ...goal, memory });
  if (!next.success) return { ok: false, errors: toIssues(next.error) };
  return { ok: true, goal: next.data, warnings: [] };
}

/** Drop one memory entry by index: it no longer holds, or the user said so. */
export function forget(goal, index) {
  if (!Number.isInteger(index) || !goal.memory[index]) {
    return { ok: false, errors: [{ path: 'index', message: `no memory entry ${index}; there are ${goal.memory.length}` }] };
  }
  return { ok: true, goal: { ...goal, memory: goal.memory.filter((_, i) => i !== index) }, warnings: [] };
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
    if (key === 'schemaVersion' || key === 'updated') continue;
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

// Lines the user can edit in place on the page, and which field of each
// holds its text (null: the node is the string itself).
const LINE_FIELDS = [
  [/^goal$/, null],
  [/^subGoals\.\d+$/, null],
  [/^successCriteria\.\d+$/, 'text'],
  [/^plan\.linesOfOperation\.\d+\.nextActions\.\d+$/, 'action'],
  [/^plan\.linesOfOperation\.\d+\.criticalPath\.\d+$/, 'label'],
  [/^plan\.linesOfOperation\.\d+\.criticalPath\.\d+\.items\.\d+$/, 'label'],
];

/** Whether the line at `path` can be edited in place on the page. */
export const isEditableLine = (path) => LINE_FIELDS.some(([re]) => re.test(String(path)));

/** The text of an editable line, or undefined if there's nothing there. */
export function lineText(goal, path) {
  const hit = LINE_FIELDS.find(([re]) => re.test(String(path)));
  if (!hit) return undefined;
  const node = String(path).split('.').reduce((n, p) => (n == null ? n : n[p]), goal);
  const text = hit[1] ? node?.[hit[1]] : node;
  return typeof text === 'string' ? text : undefined;
}

/**
 * The user's own edit of one line's text on the page. Goes through
 * writeSection on the line's top-level key, so it meets every rule a skill
 * write does and stamps `updated`. `expected` is the text the user started
 * from: if the line has changed since (a turn rewrote it), the edit is
 * refused rather than landing on whatever now sits at that path.
 */
export function editLine(goal, path, value, expected) {
  const hit = LINE_FIELDS.find(([re]) => re.test(String(path)));
  if (!hit) return { ok: false, errors: [{ path, message: 'this line cannot be edited on the page' }] };
  const text = String(value ?? '').trim();
  if (!text) return { ok: false, errors: [{ path, message: 'a line needs some text' }] };
  const current = lineText(goal, path);
  if (current === undefined) return { ok: false, errors: [{ path, message: 'this line is no longer there' }] };
  if (expected !== undefined && current !== expected) {
    return { ok: false, errors: [{ path, message: 'this line just changed. Reopen it to edit' }] };
  }
  const [key, ...rest] = String(path).split('.');
  if (!rest.length) return writeSection(goal, key, text);
  const copy = structuredClone(goal[key]);
  const field = hit[1];
  if (field) {
    rest.reduce((n, p) => n[p], copy)[field] = text;
  } else {
    rest.slice(0, -1).reduce((n, p) => n[p], copy)[rest.at(-1)] = text;
  }
  return writeSection(goal, key, copy);
}

/** The user adds a move of their own to a line of the plan: pending, theirs. */
export function addNextAction(goal, lineIndex, value) {
  const text = String(value ?? '').trim();
  if (!text) return { ok: false, errors: [{ path: 'action', message: 'a move needs some text' }] };
  const line = goal.plan?.linesOfOperation?.[lineIndex];
  if (!line) return { ok: false, errors: [{ path: `plan.linesOfOperation.${lineIndex}`, message: 'no such line in the plan' }] };
  if (line.nextActions.length >= NEXT_ACTIONS_MAX) {
    return { ok: false, errors: [{ path: `plan.linesOfOperation.${lineIndex}.nextActions`, message: `this line already has ${NEXT_ACTIONS_MAX} moves` }] };
  }
  const plan = structuredClone(goal.plan);
  plan.linesOfOperation[lineIndex].nextActions.push({ action: text, who: 'me', status: 'pending' });
  return writeSection(goal, 'plan', plan);
}
