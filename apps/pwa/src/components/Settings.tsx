import { useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting } from '../lib/db';
import { deleteGoal } from '../lib/goals';
import { readDurability, requestPersistence, isIos, useUi, type Durability } from '../lib/persist';
import { bindExportFile, commitImport, downloadExport, fileSyncState, fsAccessSupported, planImport, reauthorizeFileSync, unbindExportFile, type Choice, type ImportItem } from '../lib/portability';
import { methodsLicense } from '../lib/skills';
import { fmtUsd } from '../lib/cost';
import { TextAction, InkButton, Leaf, PencilWord } from './ui';
import { ProviderForm } from './Setup';
import { CostPanel } from './CostPanel';
import type { GoalRecord } from '../lib/db';

const Section = ({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) => (
  <details open={open} className="border-b border-rule">
    <summary className="py-3 text-[17px] font-medium text-ink">{title}</summary>
    <div className="space-y-3 pb-4">{children}</div>
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
      <div className="space-y-1 text-[17px]">
        <div>Persistent storage: <PencilWord>{d?.persisted === null ? 'unsupported' : d?.persisted ? 'granted' : 'not granted'}</PencilWord></div>
        <div>Installed to home screen: <PencilWord>{d?.installed ? 'yes' : 'no'}</PencilWord></div>
        {d?.usageMB != null && <div className="text-[14px] text-graphite">Using {d.usageMB.toFixed(1)} MB of {Math.round(d.quotaMB ?? 0)} MB</div>}
        {!d?.installed && <p className="text-[14px] text-graphite">Browsers can erase data for sites that aren't installed after a stretch without use (Safari after about a week). Installing is the durability mechanism. {isIos() ? 'On iPhone/iPad: Share, then Add to Home Screen.' : ''}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {!d?.persisted && <TextAction className="underline underline-offset-[3px]" onClick={guard(async () => { await requestPersistence(); })}>Request persistent storage</TextAction>}
        {installEvent && <InkButton onClick={() => void installEvent.prompt()}>Install app</InkButton>}
      </div>
      <hr className="border-rule" />
      <div className="text-[17px]">Backup file{last ? <span className="text-[14px] text-graphite"> · last written {new Date(last).toLocaleString()}</span> : null}</div>
      <div className="flex flex-wrap items-center gap-4">
        <TextAction className="underline underline-offset-[3px]" onClick={guard(downloadExport)}>Export all goals (JSON)</TextAction>
        <TextAction className="cursor-pointer underline underline-offset-[3px]" onClick={() => document.getElementById('import-file-input')?.click()}>
          Import…
        </TextAction>
        <input id="import-file-input" type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
          const input = e.target;
          const f = input.files?.[0];
          input.value = '';
          if (!f) return;
          setMsg('');
          try { setItems(await planImport(await f.text())); setChoices({}); } catch (err) { setMsg((err as Error).message); }
        }} />
      </div>
      {fsAccessSupported() ? (
        <div className="space-y-1">
          <div className="text-[14px] text-graphite">Bind a file once and every change is written through to it automatically.</div>
          {sync === 'off' && <TextAction className="underline underline-offset-[3px]" onClick={guard(bindExportFile)}>Bind backup file</TextAction>}
          {sync === 'active' && (
            <div className="flex items-center gap-3 text-[17px]">
              <PencilWord>write-through on</PencilWord>
              <TextAction className="underline underline-offset-[3px]" onClick={guard(unbindExportFile)}>Unbind</TextAction>
            </div>
          )}
          {sync === 'needs_permission' && <InkButton onClick={guard(reauthorizeFileSync)}>Re-authorize file access</InkButton>}
        </div>
      ) : <p className="text-[14px] text-graphite">This browser can't write to a bound file, so export regularly; you'll be reminded.</p>}
      {items && (
        <div className="space-y-2 border-t border-card-rule pt-3 text-[17px]">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate">{it.title}</div>
                {it.error && <div className="text-[14px] text-accent">{it.error}</div>}
                {it.conflict && !it.error && <div className="text-[14px] text-graphite">A goal with this id already exists</div>}
              </div>
              {!it.error && (
                <select className="border-0 border-b border-card-rule bg-transparent px-1 py-1 text-[14px] text-ink focus:border-ink focus:outline-none" value={choices[it.id] ?? (it.conflict ? 'copy' : 'replace')} onChange={(e) => setChoices({ ...choices, [it.id]: e.target.value as Choice })}>
                  {it.conflict ? <><option value="copy">Add as copy</option><option value="replace">Replace (backup kept)</option></> : <option value="replace">Add</option>}
                  <option value="skip">Skip</option>
                </select>
              )}
            </div>
          ))}
          <div className="flex items-center gap-4">
            <InkButton onClick={guard(async () => { const r = await commitImport(items, choices); setItems(null); setMsg(`Added ${r.added}, replaced ${r.replaced}.`); })}>Import</InkButton>
            <TextAction className="underline underline-offset-[3px]" onClick={() => setItems(null)}>Cancel</TextAction>
          </div>
        </div>
      )}
      {msg && <p className="text-[14px] text-ink">{msg}</p>}
    </>
  );
}

function Licenses() {
  const [t, setT] = useState('');
  useEffect(() => { void methodsLicense().then(setT); }, []);
  return <pre className="max-h-64 overflow-auto border-t border-card-rule pt-2 whitespace-pre-wrap font-mono text-[13px] text-graphite">{t}</pre>;
}

/** The goal switcher, as a shelf of notebooks (menu.html's "Notebooks"
 * group) — the current one marked with a pencilled word, matching the
 * mockup rather than the old header's plain <select>. */
function NotebookShelf({ goals, activeId, onSwitch, onNew }: { goals: GoalRecord[]; activeId?: string; onSwitch: (id: string) => void; onNew: () => void }) {
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {goals.map((g) => (
          <li key={g.id}>
            <TextAction
              className={`!min-h-0 block w-full py-1 text-left font-serif text-[18px] font-medium not-italic underline-offset-[3px] ${g.id === activeId ? '' : 'no-underline'}`}
              onClick={() => onSwitch(g.id)}
            >
              <span className="block truncate">{g.title}</span>
              {g.id === activeId && <PencilWord className="mt-0.5 block text-[16px]">current</PencilWord>}
            </TextAction>
          </li>
        ))}
      </ul>
      <TextAction className="underline underline-offset-[3px]" onClick={onNew}>New goal</TextAction>
    </div>
  );
}

/** The export-status line + Export action — lives only here (work item 5),
 * never on the main page. */
function ExportStatus() {
  const [sync, setSync] = useState<'off' | 'active' | 'needs_permission'>('off');
  const last = useLiveQuery(() => getSetting<number>('lastExportAt'), []);
  useEffect(() => { void fileSyncState().then(setSync); }, []);
  const stale = sync !== 'active' && Date.now() - (last ?? 0) > 14 * 864e5;
  if (!stale) return <p className="text-[14px] text-graphite">Backed up{last ? ` ${new Date(last).toLocaleDateString()}` : ''}.</p>;
  return (
    <p className="hand text-[16px]">
      Your goals haven't been exported in a while.{' '}
      <TextAction className="!min-h-0 font-sans text-[15px] not-italic underline underline-offset-[3px]" onClick={() => downloadExport()}>Export</TextAction>
    </p>
  );
}

interface SettingsProps {
  goalId?: string;
  goals?: GoalRecord[];
  activeId?: string;
  cost?: { dollars: number | null; turns: number } | null;
  onSwitchGoal?: (id: string) => void;
  onNewGoal?: () => void;
}

export function Settings({ goalId, goals, activeId, cost, onSwitchGoal, onNewGoal }: SettingsProps) {
  const close = () => useUi.getState().openSettings(false);
  return (
    <Leaf title="Menu" onClose={close} wide>
      <div>
        <Section title="Notebooks" open>
          <NotebookShelf goals={goals ?? []} activeId={activeId} onSwitch={(id) => { onSwitchGoal?.(id); }} onNew={() => onNewGoal?.()} />
        </Section>
        <Section title="This device" open>
          <ExportStatus />
          {cost && cost.turns > 0 && <p className="text-[14px] text-graphite">Estimated session spend: {fmtUsd(cost.dollars)}</p>}
        </Section>
        <Section title="Model and key"><ProviderForm /></Section>
        <Section title="Data and durability"><DataPanel /></Section>
        <Section title="Cost"><CostPanel /></Section>
        <Section title="About and licenses">
          <p className="text-[14px] text-graphite">App {__APP_VERSION__}. No analytics, no third-party scripts, no account.</p>
          <Licenses />
        </Section>
        <Section title="Danger zone">
          <div className="flex flex-wrap items-center gap-4">
            {goalId && <TextAction className="text-ink underline underline-offset-[3px]" onClick={() => confirm('Delete the active goal and its chat? This cannot be undone. Export first if unsure.') && void deleteGoal(goalId).then(close)}>Delete active goal</TextAction>}
            <TextAction className="text-ink underline underline-offset-[3px]" onClick={() => confirm('Erase ALL Gambit data on this device, including your saved key?') && void db.delete().then(() => location.reload())}>Erase everything</TextAction>
          </div>
        </Section>
      </div>
    </Leaf>
  );
}
