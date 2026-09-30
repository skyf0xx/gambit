import { setStatus } from '@gambit/core';
import type { LinePath } from './changes';
import type { Goal } from './types';
import { applyOp } from './goals';
import { session } from './session';

// The two slips (brand/identity.md §03 "Slips", §05 "Pencil marks"): the
// taped index card showing the single next move, and the sticky-note
// suggestions the advisor has proposed but the user hasn't taken yet.
// Both are read straight off `plan.linesOfOperation[].nextActions` — the
// one key that already carries a `status` a person can flip themselves
// (AGENTS.md's "the single user-driven write is flipping a next action's
// status").

export interface SlipItem {
  path: LinePath;
  action: string;
  who?: string;
  when?: string;
  detail?: string;
}

interface Found extends SlipItem {
  li: number;
  ai: number;
}

/** Every next action across all lines of operation, in plan order, tagged
 * with its dotted path and array position. */
function allNextActions(goal: Goal): Found[] {
  const lines = goal.plan?.linesOfOperation ?? [];
  const out: Found[] = [];
  lines.forEach((line, li) => {
    line.nextActions.forEach((a, ai) => {
      out.push({
        path: `plan.linesOfOperation.${li}.nextActions.${ai}`,
        action: a.action,
        who: a.who,
        when: a.when,
        detail: a.detail,
        li,
        ai,
      });
    });
  });
  return out;
}

/** The taped index card: the first `pending` next action, if any, in plan order. */
export function nextMove(goal: Goal): SlipItem | null {
  const lines = goal.plan?.linesOfOperation ?? [];
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    for (let ai = 0; ai < line.nextActions.length; ai++) {
      const a = line.nextActions[ai];
      if (a.status === 'pending') {
        return { path: `plan.linesOfOperation.${li}.nextActions.${ai}`, action: a.action, who: a.who, when: a.when, detail: a.detail };
      }
    }
  }
  return null;
}

/** Sticky notes: every next action with status `proposed`, in plan order. */
export function proposals(goal: Goal): SlipItem[] {
  const lines = goal.plan?.linesOfOperation ?? [];
  const out: SlipItem[] = [];
  lines.forEach((line, li) => {
    line.nextActions.forEach((a, ai) => {
      if (a.status === 'proposed') {
        out.push({ path: `plan.linesOfOperation.${li}.nextActions.${ai}`, action: a.action, who: a.who, when: a.when, detail: a.detail });
      }
    });
  });
  return out;
}

/** Read the next action currently at `path`, or null if there's nothing
 * there or it isn't a next action. */
function nextActionAt(goal: Goal, path: LinePath): { status: string } | null {
  const parts = String(path).split('.').filter(Boolean);
  let node: unknown = goal;
  for (const p of parts) {
    if (node == null || typeof node !== 'object') return null;
    node = (node as Record<string, unknown>)[p];
  }
  if (node == null || typeof node !== 'object') return null;
  const status = (node as { status?: unknown }).status;
  return typeof status === 'string' ? { status } : null;
}

/** Flip a `proposed` next action to `pending` (keeping a sticky note). */
export async function keep(goalId: string, path: LinePath): Promise<void> {
  const res = await applyOp(goalId, (g) => {
    const item = nextActionAt(g, path);
    if (!item || item.status !== 'proposed') {
      return { ok: false, errors: [{ path, message: 'target is not a proposed next action' }] } as never;
    }
    return setStatus(g, path, 'pending') as never;
  });
  if (!res.ok) throw new Error(res.errors.map((e) => e.message).join('; '));
}

/** Flip a `proposed` next action to `dropped` (tossing a sticky note), then
 * erase it from this session's marks layer immediately (brand/identity.md
 * §05: the eraser mark "lasts only one session"). */
export async function toss(goalId: string, path: LinePath): Promise<void> {
  const res = await applyOp(goalId, (g) => {
    const item = nextActionAt(g, path);
    if (!item || item.status !== 'proposed') {
      return { ok: false, errors: [{ path, message: 'target is not a proposed next action' }] } as never;
    }
    return setStatus(g, path, 'dropped') as never;
  });
  if (!res.ok) throw new Error(res.errors.map((e) => e.message).join('; '));
  session.markDropped(goalId, path);
}

/** Flip a `pending` next action to `done` — the index card's "Done". */
export async function markDone(goalId: string, path: LinePath): Promise<void> {
  const res = await applyOp(goalId, (g) => {
    const item = nextActionAt(g, path);
    if (!item || item.status !== 'pending') {
      return { ok: false, errors: [{ path, message: 'target is not a pending next action' }] } as never;
    }
    return setStatus(g, path, 'done') as never;
  });
  if (!res.ok) throw new Error(res.errors.map((e) => e.message).join('; '));
}
