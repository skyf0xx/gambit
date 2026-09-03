// The Zod schema for GOAL.json — the single source of truth every reader
// (store index, visualize, CLI, `gambit check`) validates through. Mirrors
// AGENTS.md's "each section has exactly one owning skill, which replaces
// its own content" rule: each top-level key here is owned by exactly one
// skill and is replaced wholesale on write, never appended to. `log` is
// the one append-only array.
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
});

const nextAction = z.object({
  action: mediumLabel,
  who: shortLabel,
  when: shortLabel,
  status: z.enum(['pending', 'done', 'dropped']).default('pending'),
  detail,
});

const labeledStep = z.object({
  label: shortLabel,
  detail,
  status: z.enum(['pending', 'done', 'dropped']).default('pending'),
});

const lineOfOperation = z.object({
  label: shortLabel,
  criticalPath: z.array(labeledStep).max(6),
  nextActions: z.array(nextAction).max(5),
  status: z.enum(['on_schedule', 'at_risk', 'blocked', 'done']).optional(),
  blocker: mediumLabel.optional(),
});

const plan = z.object({
  linesOfOperation: z.array(lineOfOperation).min(1),
});

const labeledFinding = z.object({
  label: mediumLabel,
  detail,
});

const systemsNotes = z.object({
  schwerpunkt: mediumLabel,
  rationale: mediumLabel.optional(),
  confidence: z.enum(['high', 'moderate', 'low']),
  topFindings: z.array(labeledFinding).max(5),
});

const riskNote = z.object({
  item: mediumLabel,
  detail: mediumLabel.optional(),
  source: z.enum(['threat', 'premortem']),
  accepted: z.boolean(),
});

const criterionStatus = z.object({
  text: z.string().min(1).max(120),
  kind,
  lineOfOperation: shortLabel.optional(),
  status: assessment,
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

const decision = z.object({
  date: dateString,
  choice: mediumLabel,
  because: mediumLabel.optional(),
  reverseIf: mediumLabel,
  reviewBy: dateString.optional(),
});

const logEntry = z.object({
  date: dateString,
  assessment: assessment.optional(),
  focus: z.string().max(160).nullable(),
  notes: z.array(mediumLabel).max(200),
  source: shortLabel.optional(),
});

export const goalSchema = z.object({
  schemaVersion: z.literal(1),
  goal: z.string().min(1).max(200),
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
  log: z.array(logEntry),
});

// Schema-default stub for `gambit new` / `store.create()` — every array
// empty, every optional section null, goal/successCriteria seeded from
// the title so the file is valid the instant it's written.
export function stubGoal(title) {
  return {
    schemaVersion: 1,
    goal: title,
    successCriteria: [{ text: 'define success criteria', kind: 'control' }],
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
    log: [],
  };
}

export function parseGoalJson(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return goalSchema.parse(data);
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
