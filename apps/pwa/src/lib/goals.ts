import { readGoal, stubGoal, summarizeChange, CURRENT_SCHEMA_VERSION } from '@gambit/core';
import type { Goal } from './types';
import { db, getSetting, setSetting, type GoalRecord, type SnapshotRecord } from './db';

export type Read =
  | { status: 'ok'; data: Goal }
  | { status: 'needs_app_update'; version: number }
  | { status: 'invalid'; error: string };

export async function readRecord(rec: GoalRecord): Promise<Read> {
  const r = readGoal(rec.doc);
  return r.status === 'ok' ? { status: 'ok', data: r.data as Goal } : (r as Read);
}

const slug = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'goal';

export function newGoalId(title: string) {
  return `${slug(title)}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function createGoal(title: string): Promise<string> {
  const id = newGoalId(title);
  const doc = stubGoal(title.slice(0, 200));
  await db.goals.put({ id, title: doc.goal, doc, schemaVersion: CURRENT_SCHEMA_VERSION, updatedAt: Date.now() });
  await setActiveGoal(id);
  return id;
}

export const getActiveGoalId = () => getSetting<string>('activeGoal');
export const setActiveGoal = (id: string) => setSetting('activeGoal', id);

export async function deleteGoal(id: string) {
  await db.transaction('rw', db.goals, db.chats, db.snapshots, db.settings, async () => {
    await db.goals.delete(id);
    await db.chats.delete(id);
    await db.snapshots.where('goalId').equals(id).delete();
    if ((await getActiveGoalId()) === id) {
      const next = (await db.goals.orderBy('updatedAt').last())?.id;
      await setSetting('activeGoal', next ?? null);
    }
  });
}

export async function snapshot(goalId: string, kind: SnapshotRecord['kind']): Promise<number> {
  const rec = await db.goals.get(goalId);
  const id = await db.snapshots.add({ goalId, ts: Date.now(), kind, doc: structuredClone(rec?.doc) });
  // Keep per-goal history bounded: newest 30 snapshots, plus any migration/update backups.
  const all = await db.snapshots.where('goalId').equals(goalId).toArray();
  const stale = all.filter((s) => s.kind === 'turn' || s.kind === 'edit').slice(0, -30);
  if (stale.length) await db.snapshots.bulkDelete(stale.map((s) => s.id!));
  return id;
}

export async function restoreSnapshot(snapshotId: number) {
  const s = await db.snapshots.get(snapshotId);
  if (!s) throw new Error('snapshot no longer exists');
  const doc = s.doc as Goal;
  await db.goals.put({
    id: s.goalId,
    title: (doc as { goal?: string }).goal ?? s.goalId,
    doc,
    schemaVersion: (doc as { schemaVersion?: number }).schemaVersion ?? CURRENT_SCHEMA_VERSION,
    updatedAt: Date.now(),
  });
}

export type OpResult =
  | { ok: true; goal: Goal; warnings: string[] }
  | { ok: false; errors: { path: string; message: string }[] };

/** Read-validate-apply-write in one transaction. Refuses goals that need an app update. */
export async function applyOp(goalId: string, op: (g: Goal) => OpResult): Promise<OpResult> {
  return db.transaction('rw', db.goals, db.settings, async () => {
    const rec = await db.goals.get(goalId);
    if (!rec) return { ok: false, errors: [{ path: '(goal)', message: 'goal not found' }] } as OpResult;
    const read = await readRecord(rec);
    if (read.status === 'needs_app_update')
      return { ok: false, errors: [{ path: '(goal)', message: 'goal was saved by a newer app version; update the app' }] } as OpResult;
    if (read.status === 'invalid')
      return { ok: false, errors: [{ path: '(goal)', message: `stored goal is invalid: ${read.error}` }] } as OpResult;
    const res = op(read.data);
    if (res.ok)
      await db.goals.put({ ...rec, title: res.goal.goal, doc: res.goal, schemaVersion: res.goal.schemaVersion, updatedAt: Date.now() });
    return res;
  });
}

/** Migrate every stored goal up to the current schema, backing up first. */
export async function migrateAll(): Promise<{ migrated: number; failed: string[] }> {
  let migrated = 0;
  const failed: string[] = [];
  for (const rec of await db.goals.toArray()) {
    const v = (rec.doc as { schemaVersion?: number })?.schemaVersion;
    if (v === CURRENT_SCHEMA_VERSION || (typeof v === 'number' && v > CURRENT_SCHEMA_VERSION)) continue;
    await snapshot(rec.id, 'premigration');
    const r = readGoal(rec.doc);
    if (r.status !== 'ok') { failed.push(rec.id); continue; }
    await db.goals.put({ ...rec, doc: r.data, schemaVersion: CURRENT_SCHEMA_VERSION, updatedAt: Date.now() });
    migrated++;
  }
  return { migrated, failed };
}

export { summarizeChange };
