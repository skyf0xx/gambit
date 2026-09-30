import type { Goal } from './types';

// A dotted path into a goal document, in the same syntax packages/core's
// `setStatus` op takes (see packages/core/src/ops.mjs), e.g.
// "plan.linesOfOperation.0.nextActions.2", "successCriteria.1",
// "riskNotes.3", "people.0", "decisions.2".
export type LinePath = string;

export interface ChangedLine {
  path: LinePath;
  text: string;
}

// Priority order the session's "what changed" line follows (brand/identity
// §05's "one pencilled line" for a turn's writes): next action, step,
// criterion, risk, person, decision.
type Bucket = 'nextAction' | 'step' | 'criterion' | 'risk' | 'person' | 'decision';
const PRIORITY: Bucket[] = ['nextAction', 'step', 'criterion', 'risk', 'person', 'decision'];

interface Item {
  bucket: Bucket;
  path: LinePath;
  text: string;
  before?: unknown;
  after: unknown;
}

function eq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function collectPlan(goal: Goal, out: Item[]) {
  const lines = goal.plan?.linesOfOperation ?? [];
  lines.forEach((line, li) => {
    line.criticalPath.forEach((step, si) => {
      out.push({ bucket: 'step', path: `plan.linesOfOperation.${li}.criticalPath.${si}`, text: step.label, after: step });
      (step.items ?? []).forEach((it, ii) => {
        out.push({ bucket: 'step', path: `plan.linesOfOperation.${li}.criticalPath.${si}.items.${ii}`, text: it.label, after: it });
      });
    });
    line.nextActions.forEach((a, ai) => {
      out.push({ bucket: 'nextAction', path: `plan.linesOfOperation.${li}.nextActions.${ai}`, text: a.action, after: a });
    });
  });
}

function indexByPath(goal: Goal): Map<LinePath, Item> {
  const items: Item[] = [];
  collectPlan(goal, items);
  (goal.successCriteria ?? []).forEach((c, i) => items.push({ bucket: 'criterion', path: `successCriteria.${i}`, text: c.text, after: c }));
  (goal.riskNotes ?? []).forEach((r, i) => items.push({ bucket: 'risk', path: `riskNotes.${i}`, text: r.item, after: r }));
  (goal.people ?? []).forEach((p, i) => items.push({ bucket: 'person', path: `people.${i}`, text: p.name, after: p }));
  (goal.decisions ?? []).forEach((d, i) => items.push({ bucket: 'decision', path: `decisions.${i}`, text: d.choice ?? d.question ?? '(open decision)', after: d }));
  return new Map(items.map((i) => [i.path, i]));
}

/**
 * Pure diff between two goal documents, returning the lines that changed —
 * added, edited, or newly flipped to `dropped` — ordered by priority (next
 * action, step, criterion, risk, person, decision), then by original array
 * order within a bucket.
 */
export function changedLines(before: Goal, after: Goal): ChangedLine[] {
  const beforeIdx = indexByPath(before);
  const afterIdx = indexByPath(after);

  const out: (Item & { order: number })[] = [];
  let order = 0;
  for (const [path, item] of afterIdx) {
    const prior = beforeIdx.get(path);
    if (prior && eq(prior.after, item.after)) continue;
    out.push({ ...item, before: prior?.after, order: order++ });
  }

  out.sort((a, b) => {
    const pa = PRIORITY.indexOf(a.bucket);
    const pb = PRIORITY.indexOf(b.bucket);
    if (pa !== pb) return pa - pb;
    return a.order - b.order;
  });

  return out.map(({ path, text }) => ({ path, text }));
}
