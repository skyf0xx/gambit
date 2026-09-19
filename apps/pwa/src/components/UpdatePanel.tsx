import { useState } from 'react';
import { create } from 'zustand';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSetting } from '../lib/db';
import { applyUpdate, canRollback, checkForUpdate, installedPackVersion, prepareUpdate, rollbackPack, type PreparedUpdate, type UpdateCheck } from '../lib/update';
import { Btn, Pill } from './ui';

export const useUpdates = create<{ check: UpdateCheck | null; error: string; set: (c: UpdateCheck | null, e?: string) => void }>((set) => ({
  check: null, error: '', set: (check, error = '') => set({ check, error }),
}));

export async function pollUpdates() {
  try { useUpdates.getState().set(await checkForUpdate()); }
  catch (e) { useUpdates.getState().set(null, (e as Error).message); }
}

export function UpdatePanel() {
  const { check, error } = useUpdates();
  const version = useLiveQuery(() => installedPackVersion(), []);
  const canBack = useLiveQuery(() => canRollback(), []);
  const last = useLiveQuery(() => getSetting<number>('lastUpdateCheck'), []);
  const [busy, setBusy] = useState(false);
  const [prep, setPrep] = useState<PreparedUpdate | null>(null);
  const [msg, setMsg] = useState('');

  const run = async (f: () => Promise<void>) => { setBusy(true); setMsg(''); try { await f(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); } };

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span>Skill pack <Pill tone="sky">{version ?? '…'}</Pill></span>
        <Btn disabled={busy} onClick={() => void run(async () => { setPrep(null); await pollUpdates(); })}>Check now</Btn>
      </div>
      {last && <div className="text-xs text-slate-500">Last checked {new Date(last).toLocaleString()}</div>}
      {error && <p className="text-xs text-amber-300">Couldn't reach the registry: {error}</p>}
      {check?.status === 'up_to_date' && <p className="text-xs text-slate-500">Up to date.</p>}
      {check?.status === 'needs_app_update' && <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-200">Skill pack {check.version} needs app version {check.appVersionMin} or newer. Update the app first; the pack is not offered until then.</p>}
      {check?.status === 'available' && !prep && (
        <div className="space-y-2 rounded-md bg-slate-900 p-3">
          <div>Version <strong>{check.manifest.version}</strong> is available.</div>
          <p className="text-xs text-slate-500">Skills are prompts that drive tools with write access to your goals, so updates are never automatic. The tarball is fetched at this exact version and checked against the registry's published hash before anything is shown or applied.</p>
          <Btn kind="primary" disabled={busy} onClick={() => void run(async () => setPrep(await prepareUpdate(check.manifest)))}>Review changes</Btn>
        </div>
      )}
      {prep && (
        <div className="space-y-3 rounded-md bg-slate-900 p-3">
          <div className="text-xs text-emerald-300">Hash verified. {prep.diff.added.length} added, {prep.diff.removed.length} removed, {prep.diff.changed.length} changed.</div>
          {prep.changelog && <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-slate-400">{prep.changelog}</pre>}
          {[...prep.diff.added.map((p) => `+ ${p}`), ...prep.diff.removed.map((p) => `− ${p}`)].map((l) => <div key={l} className="font-mono text-xs text-slate-400">{l}</div>)}
          {prep.diff.changed.map((c) => (
            <details key={c.path}>
              <summary className="font-mono text-xs text-sky-300">{c.path}</summary>
              <pre className="mt-1 max-h-64 overflow-auto rounded bg-slate-950 p-2 text-xs">
                {c.lines.map((l, i) => <div key={i} className={l.t === '+' ? 'text-emerald-300' : l.t === '-' ? 'text-red-300' : 'text-slate-500'}>{l.t} {l.s}</div>)}
              </pre>
            </details>
          ))}
          <div className="flex gap-2">
            <Btn kind="primary" disabled={busy} onClick={() => void run(async () => { const r = await applyUpdate(prep); setPrep(null); setMsg(`Applied ${prep.manifest.version}. ${r.migrated} goal(s) migrated; a backup was taken first.`); await pollUpdates(); })}>Approve and apply</Btn>
            <Btn onClick={() => setPrep(null)}>Cancel</Btn>
          </div>
        </div>
      )}
      {canBack && <Btn disabled={busy} onClick={() => confirm('Roll back to the previous skill pack? Goals migrated by the last update are restored from their pre-update backup.') && void run(async () => { await rollbackPack(); setMsg('Rolled back.'); })}>Roll back to previous pack</Btn>}
      {msg && <p className="text-xs text-slate-300">{msg}</p>}
    </div>
  );
}
