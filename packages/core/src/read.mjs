// Version-aware read path: read `schemaVersion` from the raw document, run
// the migration chain up to CURRENT_SCHEMA_VERSION, then validate against the
// current schema. A document from a newer schema is never migrated or opened
// for writing — it is reported as `needs_app_update` so a newer install's
// data cannot be silently downgraded.

import { dateString, goalSchema, GOAL_MAX_WORDS, LOG_NOTES_MAX, wordCount } from './schema.mjs';
import { capLog } from './ops.mjs';

export const CURRENT_SCHEMA_VERSION = 5;

// Split an over-long goal sentence into a short goal plus sub-goals, purely
// and deterministically — no model call. Only fires when the sentence is
// over GOAL_MAX_WORDS *and* carries a recognizable separator; otherwise the
// sentence is left as-is for the owning skill to shorten on its next write
// (see AGENTS.md's goal-contract section).
const DASH_SPLIT = /\s+[—–-]\s+/;
const SEMI_SPLIT = /\s*;\s*/;

export function splitGoalSentence(goal) {
  if (typeof goal !== 'string' || wordCount(goal) <= GOAL_MAX_WORDS) return null;
  let head, tail;
  if (DASH_SPLIT.test(goal)) {
    const [first, ...rest] = goal.split(DASH_SPLIT);
    head = first;
    tail = rest.join(' — ');
  } else if (SEMI_SPLIT.test(goal)) {
    const [first, ...rest] = goal.split(SEMI_SPLIT);
    head = first;
    tail = rest.join('; ');
  } else {
    return null;
  }
  head = head.trim();
  tail = tail.trim();
  if (!head || !tail) return null;

  // Split the remainder further on commas or a bare " and " only when that
  // yields clean, non-empty fragments; otherwise keep it as one sub-goal
  // rather than mangling a sentence that doesn't actually enumerate parts.
  let parts;
  if (tail.includes(',')) {
    parts = tail.split(/\s*,\s*/).map((p) => p.replace(/^and\s+/i, '').trim()).filter(Boolean);
  } else if (/\s+and\s+/i.test(tail)) {
    parts = tail.split(/\s+and\s+/i).map((p) => p.trim()).filter(Boolean);
  } else {
    parts = [tail];
  }
  // Guard against fragments that blow the subGoal caps (100 chars / 12
  // words) — fall back to the single unsplit tail, and if even that doesn't
  // fit, drop the split entirely rather than write an invalid document.
  const fits = (s) => s.length <= 100 && wordCount(s) <= 12;
  if (!parts.every(fits)) parts = fits(tail) ? [tail] : null;
  if (!parts || parts.length === 0) return null;

  return { goal: head, subGoals: parts.slice(0, 5) };
}

// Declarative migrations: { from: n, to: n + 1, transform: (doc) => doc }.
// `transform` is a pure data function shipped in-app, never downloaded code.
export const MIGRATIONS = [
  // v2 only adds optional fields and enum values (proposed next actions,
  // riskNotes.dependsOn, criteriaStatus 'met', open decisions, log focusLine),
  // so every v1 document is already a valid v2 one.
  { from: 1, to: 2, transform: (doc) => doc },
  // v3 adds subGoals and the 10-word goal-sentence rule (enforced on write,
  // not on read — see schema.mjs). An existing over-long goal sentence with
  // a dash or semicolon separator is split deterministically into a short
  // goal plus subGoals; one with no separator is left as-is for the owning
  // skill to shorten on its next write.
  {
    from: 2,
    to: 3,
    transform: (doc) => {
      const split = splitGoalSentence(doc.goal);
      return split ? { ...doc, ...split } : doc;
    },
  },
  // v4 adds `memory` and caps each log entry at LOG_NOTES_MAX notes.
  {
    from: 3,
    to: 4,
    transform: (doc) => ({
      ...doc,
      memory: [],
      log: (doc.log ?? []).map((e) => ({ ...e, notes: (e.notes ?? []).slice(0, LOG_NOTES_MAX) })),
    }),
  },
  // v5 makes a next action's `when` a date and adds `doneOn`, `intel`,
  // `courses` and `prep`. A `when` that is a label rather than a date
  // ("this week") is dropped; the new keys start empty.
  {
    from: 4,
    to: 5,
    transform: (doc) => ({
      ...doc,
      intel: [],
      courses: [],
      prep: [],
      plan: doc.plan && {
        ...doc.plan,
        linesOfOperation: (doc.plan.linesOfOperation ?? []).map((l) => ({
          ...l,
          nextActions: (l.nextActions ?? []).map(({ when, ...a }) => (dateString.safeParse(when).success ? { ...a, when } : a)),
        })),
      },
    }),
  },
];

function formatIssues(error) {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
}

/** @typedef {import('zod').infer<typeof goalSchema>} Goal */
/**
 * @param {unknown} raw
 * @param {{ migrations?: { from: number, to: number, transform: (doc: any) => any }[], current?: number }} [opts]
 * @returns {{ status: 'ok', data: Goal, migratedFrom?: number } | { status: 'needs_app_update', version: number } | { status: 'invalid', error: string }}
 */
export function readGoal(raw, { migrations = MIGRATIONS, current = CURRENT_SCHEMA_VERSION } = {}) {
  let doc;
  try {
    doc = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    return { status: 'invalid', error: `invalid JSON: ${err.message}` };
  }
  const v = doc?.schemaVersion;
  if (!Number.isInteger(v) || v < 1) return { status: 'invalid', error: 'schemaVersion: missing or not a positive integer' };
  if (v > current) return { status: 'needs_app_update', version: v };

  let migratedFrom;
  for (let at = v; at < current; at++) {
    const m = migrations.find((x) => x.from === at);
    if (!m) return { status: 'invalid', error: `no migration from schemaVersion ${at}` };
    migratedFrom ??= v;
    doc = { ...m.transform(doc), schemaVersion: m.to };
  }

  const result = goalSchema.safeParse(doc);
  if (!result.success) return { status: 'invalid', error: formatIssues(result.error) };
  const data = Array.isArray(result.data.log) && result.data.log.length > 0
    ? { ...result.data, log: capLog(result.data.log) }
    : result.data;
  return migratedFrom ? { status: 'ok', data, migratedFrom } : { status: 'ok', data };
}
