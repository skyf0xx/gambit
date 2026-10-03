import { useLiveQuery } from 'dexie-react-hooks';
import { editLine as coreEditLine, addNextAction, setStatus, lineText } from '@gambit/core';
import { db, type ChatRecord } from './db';
import { applyOp, type OpResult } from './goals';
import type { LinePath } from './changes';
import { today } from './dates';
import type { Goal } from './types';

// Edits the user makes on the page itself, outside the chat. Each one is
// written straight to the goal, then queued on the chat record so the next
// turn's state block tells the advisor what the user changed. The queue
// clears once a turn has carried it.

export interface PageEdit {
  path: LinePath;
  kind: 'text' | 'added' | 'status';
  /** The line's text, for a status flip (whose before/after are statuses). */
  label?: string;
  before?: string;
  after: string;
}

/** Fold one edit into the queue: one entry per line and kind, keeping the
 * first `before` and the latest `after`. A move added and then reworded
 * stays one "added" entry; an edit undone by hand drops out. */
export function coalesce(queue: PageEdit[], edit: PageEdit): PageEdit[] {
  const kind = edit.kind === 'text' && queue.some((e) => e.path === edit.path && e.kind === 'added') ? 'added' : edit.kind;
  const prior = queue.find((e) => e.path === edit.path && e.kind === kind);
  const merged: PageEdit = prior ? { ...prior, label: edit.label ?? prior.label, after: edit.after } : { ...edit, kind };
  const rest = queue.filter((e) => e !== prior);
  return merged.kind !== 'added' && merged.before === merged.after ? rest : [...rest, merged];
}

async function recordEdit(goalId: string, edit: PageEdit) {
  await db.transaction('rw', db.chats, async () => {
    const chat: ChatRecord = (await db.chats.get(goalId)) ?? { goalId, model: [], display: [] };
    chat.pendingEdits = coalesce(chat.pendingEdits ?? [], edit);
    await db.chats.put(chat);
  });
}

/** Rewrite one line's text. Refused (with the rule's message) if the text
 * breaks a write rule or the line changed since `expected` was read. */
export async function editLine(goalId: string, path: LinePath, value: string, expected: string): Promise<OpResult> {
  const res = await applyOp(goalId, (g) => coreEditLine(g, path, value, expected) as never);
  if (res.ok) await recordEdit(goalId, { path, kind: 'text', before: expected, after: lineText(res.goal, path) ?? value });
  return res;
}

/** Add a pending move of the user's own to line `li` of the plan. */
export async function addMove(goalId: string, li: number, value: string): Promise<OpResult> {
  let path = '';
  const res = await applyOp(goalId, (g) => {
    path = `plan.linesOfOperation.${li}.nextActions.${g.plan?.linesOfOperation[li]?.nextActions.length ?? 0}`;
    return addNextAction(g, li, value) as never;
  });
  if (res.ok) await recordEdit(goalId, { path, kind: 'added', after: lineText(res.goal, path) ?? value });
  return res;
}

function statusAt(goal: Goal, path: LinePath): string | undefined {
  const node = path.split('.').reduce<unknown>((n, p) => (n && typeof n === 'object' ? (n as Record<string, unknown>)[p] : undefined), goal);
  return (node as { status?: string } | undefined)?.status ?? undefined;
}

/** Flip a step, sub-item or next action's status, guarded by `allow` (the
 * status it must have now, if any), and queue the flip for the advisor. */
export async function setLineStatus(goalId: string, path: LinePath, status: string, allow?: string): Promise<OpResult> {
  let before: string | undefined;
  const res = await applyOp(goalId, (g) => {
    before = statusAt(g, path) ?? 'pending';
    if (allow && before !== allow) return { ok: false, errors: [{ path, message: `target is not a ${allow} item` }] };
    return setStatus(g, path, status, today()) as never;
  });
  if (res.ok) await recordEdit(goalId, { path, kind: 'status', label: lineText(res.goal, path), before, after: status });
  return res;
}

/** The queued edits as the lines of the turn's state block, or ''. */
export function pendingEditsText(edits: PageEdit[] | undefined): string {
  if (!edits?.length) return '';
  const line = (e: PageEdit) =>
    e.kind === 'added' ? `- added ${e.path}: "${e.after}"`
    : e.kind === 'text' ? `- reworded ${e.path}: "${e.before}" → "${e.after}"`
    : `- marked ${e.path}${e.label ? ` ("${e.label}")` : ''} ${e.after}${e.before ? ` (was ${e.before})` : ''}`;
  return [
    'Since your last turn the user edited the page directly. These are their own word: build on them, never revert or reword them, and mention them only where they change your advice.',
    ...edits.map(line),
  ].join('\n');
}

/** Paths edited on the page since the last turn, for the "edited" tag. */
export function useEditedPaths(goalId: string | undefined): Set<string> {
  const edits = useLiveQuery(async () => (goalId ? (await db.chats.get(goalId))?.pendingEdits : undefined), [goalId]);
  return new Set((edits ?? []).filter((e) => e.kind !== 'status').map((e) => e.path));
}
