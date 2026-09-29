import { useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting } from '../lib/db';
import { deleteGoal } from '../lib/goals';
import { readDurability, requestPersistence, isIos, useUi, type Durability } from '../lib/persist';
import { bindExportFile, commitImport, downloadExport, fileSyncState, fsAccessSupported, planImport, reauthorizeFileSync, unbindExportFile, type Choice, type ImportItem } from '../lib/portability';
import { methodsLicense } from '../lib/skills';
import { Btn, Modal, Pill } from './ui';
import { ProviderForm } from './Setup';
import { CostPanel } from './CostPanel';

const Section = ({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) => (
  <details open={open} className="rounded-lg border border-slate-800">
    <summary className="px-4 py-3 text-sm font-medium">{title}</summary>
    <div className="space-y-3 border-t border-slate-800 p-4">{children}</div>
  </details>
);

function DataPanel() {
  const [d, setD] = useState<Durability | null>(null);
  const [sync, setSync] = useState<'off' | 'active' | 'needs_permission'>('off');
  const [items, setItems] = useState<ImportItem[] | null>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [msg, setMsg] = useState('');
  const last = useLiveQuery(() => getSetting<number>('lastExportAt'), []);
  const installEvent = useUi((s) => s.installEvent);
  const refresh = async () => { setD(await readDurability()); setSync(await fileSyncState()); };
  useEffect(() => { void refresh(); }, []);
  const guard = (f: () => Promise<void>) => async () => { setMsg(''); try { await f(); } catch (e) { if ((e as Error).name !== 'AbortError') setMsg((e as Error).message); } await refresh(); };

  return (
    <>
      <div className="space-y-1 text-sm">
        <div>Persistent storage: {d?.persisted === null ? 'unsupported' : d?.persisted ? <Pill tone="green">granted</Pill> : <Pill tone="amber">not granted</Pill>}</div>
        <div>Installed to home screen: {d?.installed ? <Pill tone="green">yes</Pill> : <Pill tone="amber">no</Pill>}</div>
        {d?.usageMB != null && <div className="text-xs text-slate-500">Using {d.usageMB.toFixed(1)} MB of {Math.round(d.quotaMB ?? 0)} MB</div>}
        {!d?.installed && <p className="text-xs text-slate-500">Browsers can erase data for sites that aren't installed after a stretch without use (Safari after about a week). Installing is the durability mechanism. {isIos() ? 'On iPhone/iPad: Share, then Add to Home Screen.' : ''}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {!d?.persisted && <Btn onClick={guard(async () => { await requestPersistence(); })}>Request persistent storage</Btn>}
        {installEvent && <Btn kind="primary" onClick={() => void installEvent.prompt()}>Install app</Btn>}
      </div>
      <hr className="border-slate-800" />
      <div className="text-sm">Backup file{last ? <span className="text-xs text-slate-500"> · last written {new Date(last).toLocaleString()}</span> : null}</div>
      <div className="flex flex-wrap gap-2">
        <Btn onClick={guard(downloadExport)}>Export all goals (JSON)</Btn>
        <label className="cursor-pointer rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium hover:bg-slate-700">
          Import…
          <input type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
            const input = e.target;
            const f = input.files?.[0];
            input.value = '';
            if (!f) return;
            setMsg('');
            try { setItems(await planImport(await f.text())); setChoices({}); } catch (err) { setMsg((err as Error).message); }
          }} />
        </label>
      </div>
      {fsAccessSupported() ? (
        <div className="space-y-1">
          <div className="text-xs text-slate-500">Bind a file once and every change is written through to it automatically.</div>
          {sync === 'off' && <Btn onClick={guard(bindExportFile)}>Bind backup file</Btn>}
          {sync === 'active' && <div className="flex items-center gap-2 text-sm"><Pill tone="green">write-through on</Pill><Btn onClick={guard(unbindExportFile)}>Unbind</Btn></div>}
          {sync === 'needs_permission' && <Btn kind="primary" onClick={guard(reauthorizeFileSync)}>Re-authorize file access</Btn>}
        </div>
      ) : <p className="text-xs text-slate-500">This browser can't write to a bound file, so export regularly; you'll be reminded.</p>}
      {items && (
        <div className="space-y-2 rounded-md bg-slate-900 p-3 text-sm">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0"><div className="truncate">{it.title}</div>{it.error && <div className="text-xs text-red-300">{it.error}</div>}{it.conflict && !it.error && <div className="text-xs text-amber-300">A goal with this id already exists</div>}</div>
              {!it.error && (
                <select className="rounded bg-slate-800 px-2 py-1 text-xs" value={choices[it.id] ?? (it.conflict ? 'copy' : 'replace')} onChange={(e) => setChoices({ ...choices, [it.id]: e.target.value as Choice })}>
                  {it.conflict ? <><option value="copy">Add as copy</option><option value="replace">Replace (backup kept)</option></> : <option value="replace">Add</option>}
                  <option value="skip">Skip</option>
                </select>
              )}
            </div>
          ))}
          <div className="flex gap-2"><Btn kind="primary" onClick={guard(async () => { const r = await commitImport(items, choices); setItems(null); setMsg(`Added ${r.added}, replaced ${r.replaced}.`); })}>Import</Btn><Btn onClick={() => setItems(null)}>Cancel</Btn></div>
        </div>
      )}
      {msg && <p className="text-xs text-slate-300">{msg}</p>}
    </>
  );
}

function Licenses() {
  const [t, setT] = useState('');
  useEffect(() => { void methodsLicense().then(setT); }, []);
  return <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-slate-400">{t}</pre>;
}

export function Settings({ goalId }: { goalId?: string }) {
  const close = () => useUi.getState().openSettings(false);
  return (
    <Modal title="Settings" onClose={close} wide>
      <div className="space-y-3">
        <Section title="Model and key" open><ProviderForm /></Section>
        <Section title="Data and durability"><DataPanel /></Section>
        <Section title="Cost"><CostPanel /></Section>
        <Section title="About and licenses">
          <p className="text-xs text-slate-400">App {__APP_VERSION__}. No analytics, no third-party scripts, no account.</p>
          <Licenses />
        </Section>
        <Section title="Danger zone">
          {goalId && <Btn kind="danger" onClick={() => confirm('Delete the active goal and its chat? This cannot be undone. Export first if unsure.') && void deleteGoal(goalId).then(close)}>Delete active goal</Btn>}
          <Btn kind="danger" onClick={() => confirm('Erase ALL Gambit data on this device, including your saved key?') && void db.delete().then(() => location.reload())}>Erase everything</Btn>
        </Section>
      </div>
    </Modal>
  );
}
