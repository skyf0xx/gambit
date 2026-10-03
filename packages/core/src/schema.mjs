// The Zod schema for a goal document — the single source of truth every
// reader (goal store, dashboard, write tools, import) validates through.
// Mirrors AGENTS.md's "each key has exactly one owning skill" rule: each
// top-level key here is owned by exactly one skill and is replaced
// wholesale on write, never appended to. `log` is the one append-only
// array; `memory` is edited entry by entry through remember/forget (ops.mjs).
//
// Date fields are strict `YYYY-MM-DD` plus a real-calendar-date refine —
// no free text.

import { z } from 'zod';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, 'not a real calendar date');

/** Most next actions one line of the plan holds. */
export const NEXT_ACTIONS_MAX = 5;

const shortLabel = z.string().min(1).max(40);
const mediumLabel = z.string().min(1).max(120);

const kind = z.enum(['control', 'influence']);
const assessment = z.enum(['on_track', 'at_risk', 'stalled', 'regressing']);

const detail = z.string().max(280).optional();

const successCriterion = z.object({
  text: z.string().min(1).max(120),
  kind,
  lineOfOperation: shortLabel.optional(),
  detail,
});

const person = z.object({
  name: shortLabel,
  status: z.enum(['confirmed', 'tentative', 'lead']),
  doing: mediumLabel,
  detail,
});

const postureLevel = z.object({
  level: z.number().int().min(1),
  label: shortLabel,
  meaning: mediumLabel.optional(),
});

const posture = z.object({
  current: z.object({
    level: z.number().int().min(1),
    label: shortLabel,
  }),
  levels: z.array(postureLevel).min(1),
  triggers: z.array(mediumLabel).max(10),
  lastReviewed: dateString,
});

// 'proposed' is a move the advisor suggested that the user hasn't agreed to
// yet — shown as a sticky note to keep (→ 'pending') or toss (→ 'dropped').
// Only next actions can be proposed; steps and sub-items can't.
// `when` is optional: a move the user adds on the page carries no date
// until they or the advisor give it one.
const nextAction = z.object({
  action: mediumLabel,
  who: shortLabel,
  when: shortLabel.optional(),
  status: z.enum(['proposed', 'pending', 'done', 'dropped']).default('pending'),
  detail,
});

// items: an optional flat sub-list (e.g. "8 subs, one line each") a step or
// finding needs to enumerate rather than pack into one run-on `detail`
// sentence. Each entry carries its own status so a step's children can be
// tracked individually rather than forcing the whole step to one atomic
// done/pending/dropped value. Capped at 10 for the same reason criticalPath
// itself is capped at 6 — a list that grows past this belongs in its own
// plan step, not a sub-list.
const subItem = z.object({
  label: shortLabel,
  status: z.enum(['pending', 'done', 'dropped']).default('pending'),
});

const items = z.array(subItem).max(10).optional();

const labeledStep = z.object({
  label: shortLabel,
  detail,
  items,
  status: z.enum(['pending', 'done', 'dropped']).default('pending'),
});

// focus: true marks the one line holding the Schwerpunkt. The index card
// takes its first pending next action before any other line's.
const lineOfOperation = z.object({
  label: shortLabel,
  focus: z.literal(true).optional(),
  criticalPath: z.array(labeledStep).max(6),
  nextActions: z.array(nextAction).max(NEXT_ACTIONS_MAX),
  status: z.enum(['on_schedule', 'at_risk', 'blocked', 'done']).optional(),
  blocker: mediumLabel.optional(),
});

const plan = z.object({
  linesOfOperation: z.array(lineOfOperation).min(1),
});

const labeledFinding = z.object({
  label: mediumLabel,
  detail,
  items,
});

const systemsNotes = z.object({
  schwerpunkt: mediumLabel,
  rationale: mediumLabel.optional(),
  confidence: z.enum(['high', 'moderate', 'low']),
  topFindings: z.array(labeledFinding).max(5),
  lastReviewed: dateString,
});

// dependsOn: the name of the one person this risk hangs on, matching a
// `people[].name` or `stakeholders[].name` — drawn as an arrow between them.
const riskNote = z.object({
  item: mediumLabel,
  detail: mediumLabel.optional(),
  source: z.enum(['threat', 'premortem']),
  accepted: z.boolean(),
  dependsOn: shortLabel.optional(),
});

// A criterion can be 'met' outright, which a log assessment can't: the
// goal as a whole is never "met" mid-run, one of its criteria can be.
const criterionStatus = z.object({
  text: z.string().min(1).max(120),
  kind,
  lineOfOperation: shortLabel.optional(),
  status: z.enum(['met', 'on_track', 'at_risk', 'stalled', 'regressing']),
  detail,
});

const stakeholder = z.object({
  name: shortLabel,
  power: z.enum(['high', 'med', 'low']),
  stanceCurrent: shortLabel,
  stanceTarget: shortLabel,
  via: mediumLabel,
  detail,
});

const exposureItem = z.object({
  item: mediumLabel,
  status: z.enum(['open', 'accepted']),
  mustHandleBefore: shortLabel.optional(),
  acceptedDate: dateString.optional(),
  why: mediumLabel.optional(),
});

const capacity = z.object({
  availableHrsPerWeek: z.number().min(0).nullable(),
  runway: shortLabel,
  watch: mediumLabel.optional(),
  detail,
  lastReviewed: dateString,
});

const forecast = z.object({
  statement: mediumLabel,
  probability: z.number().int().min(0).max(100),
  resolvesBy: dateString,
  resolvesVia: shortLabel,
  resolved: z.boolean(),
  outcome: z.enum(['yes', 'no']).optional(),
  verdict: mediumLabel.optional(),
  detail,
});

const experiment = z.object({
  assumption: mediumLabel,
  test: mediumLabel,
  passIf: mediumLabel,
  by: dateString,
  done: z.boolean(),
  result: mediumLabel.optional(),
  changedAsResult: mediumLabel.optional(),
  detail,
});

// An 'open' decision is a choice named but not yet made: it carries the
// question (and optionally when it must be settled by), and gets its
// choice and reverse-if condition once it's decided.
const decision = z
  .object({
    date: dateString,
    status: z.enum(['open', 'decided']).default('decided'),
    question: mediumLabel.optional(),
    choice: mediumLabel.optional(),
    because: mediumLabel.optional(),
    reverseIf: mediumLabel.optional(),
    reviewBy: dateString.optional(),
  })
  .superRefine((d, ctx) => {
    if (d.status === 'open' && !d.question) ctx.addIssue({ code: 'custom', path: ['question'], message: 'an open decision needs its question' });
    if (d.status === 'decided') {
      if (!d.choice) ctx.addIssue({ code: 'custom', path: ['choice'], message: 'a decided decision needs its choice' });
      if (!d.reverseIf) ctx.addIssue({ code: 'custom', path: ['reverseIf'], message: 'a decided decision needs its reverse-if condition' });
    }
  });

// A log entry records what happened in one exchange, not the state of the
// goal: the owning keys already hold that. Hence few notes per entry.
export const LOG_NOTES_MAX = 3;

// focusLine: the verbatim text of the one line on the page the focus lands
// on (a success criterion, next action or critical-path step), so the page
// can highlight it. The latest entry with a focus is the current focus.
const logEntry = z.object({
  date: dateString,
  assessment: assessment.optional(),
  focus: z.string().max(160).nullable(),
  focusLine: z.string().min(1).max(120).optional(),
  notes: z.array(mediumLabel).max(LOG_NOTES_MAX),
  source: shortLabel.optional(),
});

// What the user has told the advisor that no owned key holds: a fact, a
// preference, a constraint, or a move they turned down. Small enough to
// sit in full in every turn's context, so nothing needs retrieving.
export const MEMORY_CAP = 20;
export const MEMORY_KINDS = ['fact', 'preference', 'constraint', 'rejected'];

const memoryEntry = z.object({
  kind: z.enum(MEMORY_KINDS),
  text: mediumLabel,
  date: dateString,
});

// A sub-goal is a part or condition of the aim itself (e.g. the clause after
// a dash in "open a third salon — without burning out"), not a measurable
// success criterion. Short list, short entries — this is a title-adjacent
// fragment listed under the goal title, not a place to restate
// criteria. Word/char caps mirror the goal sentence's own 10-word rule,
// loosened slightly (12 words) since these are read on their own line
// rather than as a page title.
const subGoal = z
  .string()
  .min(1)
  .max(100)
  .refine((s) => s.trim().split(/\s+/).filter(Boolean).length <= 12, 'must be 12 words or fewer');

export const goalSchema = z.object({
  schemaVersion: z.literal(4),
  goal: z.string().min(1).max(200),
  subGoals: z.array(subGoal).max(5).optional(),
  successCriteria: z.array(successCriterion).min(1),
  deadline: dateString.nullable(),
  people: z.array(person),
  posture: posture.nullable(),
  plan: plan.nullable(),
  systemsNotes: systemsNotes.nullable(),
  riskNotes: z.array(riskNote),
  criteriaStatus: z.array(criterionStatus),
  stakeholders: z.array(stakeholder),
  exposure: z.array(exposureItem),
  capacity: capacity.nullable(),
  forecasts: z.array(forecast),
  experiments: z.array(experiment),
  decisions: z.array(decision),
  // When each key last changed, as an ISO timestamp. Stamped by writeSection
  // (ops.mjs), never written by a skill; suggestSkills (flow.mjs) compares
  // it against what each section is built from.
  updated: z.record(z.string(), z.string()).optional(),
  memory: z.array(memoryEntry).max(MEMORY_CAP),
  log: z.array(logEntry),
});

// The goal sentence's word cap for new writes only (existing records may
// already exceed it and must still read — this is enforced on the write
// path in ops.mjs's writeSection, not here, so old documents never fail
// schema validation on read). Exported so the write path and its tests
// share one number.
export const GOAL_MAX_WORDS = 10;

// Write-only rules: Zod conditions checked by writeSection (ops.mjs) on top
// of goalSchema, but never on the read path — a goal saved before a rule
// existed must still load, and picks the rule up on its owner's next write.
//
// A proposed move needs its `detail`: the sticky note asks the user to keep
// or toss it, and the why is what makes that an informed choice. At most one
// line carries `focus` — the Schwerpunkt is one thing, not a ranking.
export const writeRules = {
  plan: plan.superRefine((p, ctx) => {
    if (p.linesOfOperation.filter((l) => l.focus).length > 1) {
      ctx.addIssue({ code: 'custom', path: ['linesOfOperation'], message: 'only one line can carry focus: true' });
    }
    p.linesOfOperation.forEach((l, li) => l.nextActions.forEach((a, ai) => {
      if (a.status === 'proposed' && !a.detail?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['linesOfOperation', li, 'nextActions', ai, 'detail'],
          message: 'a proposed move needs its detail: one sentence on why this, why now',
        });
      }
    }));
  }),
};

export function wordCount(s) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// The placeholder success criterion a stub goal carries until intake runs.
export const STUB_CRITERION = 'define success criteria';

// Schema-default stub for a new goal — every array empty, every optional
// section null, goal/successCriteria seeded from the title so the document
// is valid the instant it's written.
export function stubGoal(title) {
  return {
    schemaVersion: 4,
    goal: title,
    successCriteria: [{ text: STUB_CRITERION, kind: 'control' }],
    deadline: null,
    people: [],
    posture: null,
    plan: null,
    systemsNotes: null,
    riskNotes: [],
    criteriaStatus: [],
    stakeholders: [],
    exposure: [],
    capacity: null,
    forecasts: [],
    experiments: [],
    decisions: [],
    memory: [],
    log: [],
  };
}

export function parseGoalJson(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return goalSchema.parse(data);
}

// Soft reconciliation lint, run after schema validation — not a .refine()
// on the schema itself, since this checks content correctness (does a
// parent's status agree with its children's) rather than shape. A line or
// step whose children are all done but whose own status lags behind is a
// strong hint, not proof (something in nextActions could still be
// blocking) — so this returns warnings for a skill to weigh, not a hard
// failure.
export function reconcileGoal(data) {
  const warnings = [];
  const names = new Set([...data.people, ...data.stakeholders].map((p) => p.name));
  // Only a record written before the write path kept these apart can hold
  // both; the stakeholder copy is the stale one (ops.mjs writeSection).
  const onSide = new Set(data.people.map((p) => p.name.trim().toLowerCase()));
  for (const s of data.stakeholders) {
    if (onSide.has(s.name.trim().toLowerCase())) {
      warnings.push(`"${s.name}" is in both people and stakeholders; keep them in people only and rewrite stakeholders without them`);
    }
  }
  for (const r of data.riskNotes) {
    if (r.dependsOn && !names.has(r.dependsOn)) {
      warnings.push(`riskNote "${r.item}": dependsOn "${r.dependsOn}" matches no people or stakeholders name`);
    }
  }
  for (const line of data.plan?.linesOfOperation ?? []) {
    if (line.criticalPath.length > 0 && line.criticalPath.every((s) => s.status === 'done') && line.status !== 'done') {
      warnings.push(`lineOfOperation "${line.label}": all criticalPath steps done but status is "${line.status ?? 'unset'}"`);
    }
    for (const step of line.criticalPath) {
      if (step.items && step.items.length > 0 && step.items.every((i) => i.status === 'done') && step.status !== 'done') {
        warnings.push(`labeledStep "${step.label}": all items done but status is "${step.status}"`);
      }
    }
  }
  return warnings;
}

export function safeParseGoalJson(raw) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    return { success: false, error: `invalid JSON: ${err.message}` };
  }
  const result = goalSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  const message = result.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  return { success: false, error: message };
}
