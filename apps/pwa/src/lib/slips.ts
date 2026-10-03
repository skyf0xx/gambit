import type { LinePath } from './changes';
import type { Goal } from './types';
import { setLineStatus } from './edits';
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

/** Whether a next action's `who` is the user themselves ("me", "you"), or
 * unset — the page leaves that unsaid and names only someone else. */
export function isSelf(who?: string): boolean {
  return !who?.trim() || /^(me|you|i|myself|yourself|self|user|the user)$/i.test(who.trim());
}

/** The taped index card: the first `pending` next action on the focus line,
 * else the first in plan order, if any. */
export function nextMove(goal: Goal): SlipItem | null {
  const lines = goal.plan?.linesOfOperation ?? [];
  const order = lines.map((_, li) => li);
  const focus = lines.findIndex((l) => l.focus);
  if (focus > 0) order.unshift(...order.splice(focus, 1));
  for (const li of order) {
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

/** Flip a `proposed` next action to `pending` (keeping a sticky note). */
export async function keep(goalId: string, path: LinePath): Promise<void> {
  const res = await setLineStatus(goalId, path, 'pending', 'proposed');
  if (!res.ok) throw new Error(res.errors.map((e) => e.message).join('; '));
}

/** Flip a `proposed` next action to `dropped` (tossing a sticky note), then
 * erase it from this session's marks layer immediately (brand/identity.md
 * §05: the eraser mark "lasts only one session"). */
export async function toss(goalId: string, path: LinePath): Promise<void> {
  const res = await setLineStatus(goalId, path, 'dropped', 'proposed');
  if (!res.ok) throw new Error(res.errors.map((e) => e.message).join('; '));
  session.markDropped(goalId, path);
}

/** Flip a `pending` next action to `done` — the index card's "Done". */
export async function markDone(goalId: string, path: LinePath): Promise<void> {
  const res = await setLineStatus(goalId, path, 'done', 'pending');
  if (!res.ok) throw new Error(res.errors.map((e) => e.message).join('; '));
}
