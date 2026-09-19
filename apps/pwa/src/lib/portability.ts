import { CURRENT_SCHEMA_VERSION, readGoal } from '@gambit/core';
import { db, getSetting, setSetting } from './db';
import { activeMigrations, newGoalId, snapshot } from './goals';
import { installedPackVersion } from './update';

export interface ExportFile {
  app: 'gambit';
  exportVersion: 1;
  exportedAt: string;
  schemaVersion: number;
  skillPackVersion: string;
  goals: { id: string; title: string; doc: unknown }[];
}

export async function buildExport(): Promise<ExportFile> {
  const goals = await db.goals.toArray();
  return {
    app: 'gambit',
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    skillPackVersion: await installedPackVersion(),
    goals: goals.map((g) => ({ id: g.id, title: g.title, doc: g.doc })),
  };
}

export async function downloadExport() {
  const blob = new Blob([JSON.stringify(await buildExport(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gambit-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  await setSetting('lastExportAt', Date.now());
}

export interface ImportItem {
  id: string;
  title: string;
  doc?: unknown;
  conflict: boolean;
  error?: string;
}

/** Validate (and migrate if older) every goal in an untrusted file. Nothing is written. */
export async function planImport(text: string): Promise<ImportItem[]> {
  let parsed: Partial<ExportFile>;
  try { parsed = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
  if (parsed?.app !== 'gambit' || !Array.isArray(parsed.goals)) throw new Error('That file is not a Gambit export.');
  const migrations = await activeMigrations();
  const existing = new Set((await db.goals.toArray()).map((g) => g.id));
  return parsed.goals.map((g, i) => {
    const id = typeof g?.id === 'string' && g.id ? g.id : `imported-${i}`;
    const r = readGoal(g?.doc, { migrations });
    if (r.status === 'ok') return { id, title: r.data.goal, doc: r.data, conflict: existing.has(id) };
    const error = r.status === 'needs_app_update' ? `saved by a newer app (schema v${r.version}); update the app first` : r.error;
    return { id, title: String(g?.title ?? id), conflict: existing.has(id), error };
  });
}

export type Choice = 'copy' | 'replace' | 'skip';

/** Add goals as new by default; replacing an existing goal is explicit and snapshotted first. Never silent. */
export async function commitImport(items: ImportItem[], choices: Record<string, Choice>) {
  let added = 0;
  let replaced = 0;
  for (const it of items) {
    if (it.error || !it.doc) continue;
    const choice = choices[it.id] ?? (it.conflict ? 'copy' : 'replace');
    if (choice === 'skip') continue;
    const goal = it.doc as { goal: string; schemaVersion: number };
    if (choice === 'replace' && it.conflict) {
      await snapshot(it.id, 'import');
      await db.goals.put({ id: it.id, title: goal.goal, doc: goal, schemaVersion: goal.schemaVersion, updatedAt: Date.now() });
      replaced++;
    } else {
      const id = it.conflict ? newGoalId(goal.goal) : it.id;
      await db.goals.put({ id, title: goal.goal, doc: goal, schemaVersion: goal.schemaVersion, updatedAt: Date.now() });
      added++;
    }
  }
  return { added, replaced };
}

// ---- File System Access write-through ----

type Handle = FileSystemFileHandle & {
  queryPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
};

export const fsAccessSupported = () => 'showSaveFilePicker' in window;

export async function bindExportFile(): Promise<void> {
  const picker = (window as unknown as { showSaveFilePicker: (o: unknown) => Promise<Handle> }).showSaveFilePicker;
  const handle = await picker({ suggestedName: 'gambit-goals.json', types: [{ description: 'Gambit goals', accept: { 'application/json': ['.json'] } }] });
  await setSetting('fileHandle', handle);
  await writeThrough();
}

export async function unbindExportFile() {
  await db.settings.delete('fileHandle');
}

export async function fileSyncState(): Promise<'off' | 'active' | 'needs_permission'> {
  const h = await getSetting<Handle>('fileHandle');
  if (!h) return 'off';
  return (await h.queryPermission?.({ mode: 'readwrite' })) === 'granted' ? 'active' : 'needs_permission';
}

/** Call from a user gesture to re-grant access after a browser restart. */
export async function reauthorizeFileSync(): Promise<void> {
  const h = await getSetting<Handle>('fileHandle');
  if (h && (await h.requestPermission?.({ mode: 'readwrite' })) === 'granted') await writeThrough();
}

async function writeThrough() {
  const h = await getSetting<Handle>('fileHandle');
  if (!h || (await h.queryPermission?.({ mode: 'readwrite' })) !== 'granted') return;
  const w = await h.createWritable();
  await w.write(JSON.stringify(await buildExport(), null, 2));
  await w.close();
  await setSetting('lastExportAt', Date.now());
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** Debounced: any goal change is mirrored into the bound file. */
export function startFileSync(): () => void {
  const onChange = () => schedule();
  db.goals.hook('creating', onChange);
  db.goals.hook('updating', onChange);
  db.goals.hook('deleting', onChange);
  return () => {
    db.goals.hook('creating').unsubscribe(onChange);
    db.goals.hook('updating').unsubscribe(onChange);
    db.goals.hook('deleting').unsubscribe(onChange);
  };
}
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => void writeThrough().catch(() => {}), 1500);
}
