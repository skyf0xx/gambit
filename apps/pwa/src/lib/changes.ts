import { lineText } from '@gambit/core';
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

// Where each bucket's lines sit; their text comes from core's `lineText`,
// the same table the page's inline edits use.
function linePaths(goal: Goal): { bucket: Bucket; path: LinePath; node: unknown }[] {
  const out: { bucket: Bucket; path: LinePath; node: unknown }[] = [];
  (goal.plan?.linesOfOperation ?? []).forEach((line, li) => {
    line.criticalPath.forEach((step, si) => {
      out.push({ bucket: 'step', path: `plan.linesOfOperation.${li}.criticalPath.${si}`, node: step });
    });
    line.nextActions.forEach((a, ai) => out.push({ bucket: 'nextAction', path: `plan.linesOfOperation.${li}.nextActions.${ai}`, node: a }));
  });
  const keyed: [Bucket, keyof Goal][] = [['criterion', 'successCriteria'], ['risk', 'riskNotes'], ['person', 'people'], ['decision', 'decisions']];
  for (const [bucket, key] of keyed) {
    ((goal[key] ?? []) as unknown[]).forEach((node, i) => out.push({ bucket, path: `${key}.${i}`, node }));
  }
  return out;
}

function indexByPath(goal: Goal): Map<LinePath, Item> {
  return new Map(linePaths(goal).map(({ bucket, path, node }) => [path, { bucket, path, text: lineText(goal, path) ?? '(open decision)', after: node }]));
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

// Keys that change on nearly every turn (log) or aren't drawn on the page
// (schemaVersion), so they'd flag a tab with nothing new to see.
const IGNORED_KEYS = new Set(['schemaVersion', 'log']);

// The page draws only part of a key; a change elsewhere in it (posture's
// lastReviewed, bumped on every strategy pass) has nothing new to see.
const DRAWN: Record<string, (v: unknown) => unknown> = {
  posture: (v) => (v as Goal['posture'])?.current ?? null,
};

/** Top-level goal keys whose value differs between the two documents — the
 * section-level counterpart to `changedLines`, covering keys it doesn't
 * index line by line (capacity, exposure, experiments, …). */
export function changedKeys(before: Goal, after: Goal): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const drawn = (k: string, g: Goal) => (DRAWN[k] ?? ((v) => v))((g as Record<string, unknown>)[k]);
  return [...keys].filter((k) => !IGNORED_KEYS.has(k) && !eq(drawn(k, before), drawn(k, after)));
}
