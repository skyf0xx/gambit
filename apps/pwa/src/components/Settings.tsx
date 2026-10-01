import { useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting } from '../lib/db';
import { deleteGoal } from '../lib/goals';
import { clearChat } from '../lib/agent';
import { readDurability, requestPersistence, installRoute, installSteps, useUi, type Durability } from '../lib/persist';
import { bindExportFile, commitImport, downloadExport, fileSyncState, fsAccessSupported, planImport, reauthorizeFileSync, unbindExportFile, type Choice, type ImportItem } from '../lib/portability';
import { setTheme, useTheme, type Theme } from '../lib/theme';
import { methodsLicense } from '../lib/skills';
import { fmtUsd } from '../lib/cost';
import { getProvider, PROVIDERS, type ProviderSettings } from '../lib/providers';
import { hasApiKey } from '../lib/crypto';
import { TextAction, InkButton, PencilWord } from './ui';
import { ProviderForm } from './Setup';
import { CostPanel } from './CostPanel';
import type { GoalRecord } from '../lib/db';

// The Inside cover page: plain page sections, no containers around ordinary
// text (brand/identity.md §05). Ordered by how often each is reached for:
// notebooks, model, chat, backup, theme, danger zone, then the maker's mark.
//
// Each section shows one line of current state and a short action; detail
// and forms sit one tap behind it. Pencil marks only what needs attention
// (a backup that's stale, notebooks the browser could clear), so a page
// with nothing wrong reads quietly.

const PageSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-4">
    <h2 className="font-sans text-[20px] font-semibold leading-7">{title}</h2>
    {children}
  </section>
);

/** A labelled group inside a section. `note` is its current state, at the
 * end of the label's line; pencilled only when it needs attention. */
const Group = ({ label, note, warn, children }: { label: string; note?: string; warn?: boolean; children?: ReactNode }) => (
  <div className="space-y-1">
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-[14px] leading-5 text-graphite">{label}</h3>
      {note && (warn ? <PencilWord className="shrink-0 text-[19px]">{note}</PencilWord> : <span className="shrink-0 text-[14px] leading-5 text-graphite">{note}</span>)}
    </div>
    {children}
  </div>
);

/** A summary line with its detail one tap behind it. */
function Reveal({ summary, more, less = 'Hide', children }: { summary: ReactNode; more: string; less?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 text-[17px] leading-[27px]">
        <span className="min-w-0 truncate">{summary}</span>
        <TextAction className={`${linkCls} shrink-0`} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? less : more}</TextAction>
      </div>
      {open && <div className="anim-fade-in">{children}</div>}
    </div>
  );
}

const Actions = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap items-center gap-x-5">{children}</div>
);

const linkCls = 'underline underline-offset-[3px]';
const smallCls = 'text-[14px] leading-[22px] text-graphite';

/** "19 Sep", with the year only when it isn't this one. */
function shortDay(ts: number): string {
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Backup: a warning only when the browser could clear the notebooks, then
 * the backup file's state and its actions on one line. */
function KeepSafe() {
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

  const justInstalled = useUi((s) => s.justInstalled);
  const [declined, setDeclined] = useState(false);
  const installed = !!d?.installed || justInstalled;
  const route = installRoute(!!installEvent);
  // Either one stops the browser clearing the notebooks on its own.
  const kept = installed || !!d?.persisted;
  const stale = Date.now() - (last ?? 0) > 14 * 864e5;
  const fs = fsAccessSupported();
  // Only a backup that needs doing is pencilled.
  const [backupNote, backupWarn] =
    sync === 'active' ? ['automatic', false]
    : sync === 'needs_permission' ? ['paused', true]
    : !last ? ['never saved', true]
    : stale ? [`last ${shortDay(last)}`, true]
    : [`last ${shortDay(last)}`, false];

  return (
    <div className="space-y-6">
      {d && !kept && (
        <Group label="Browser storage" note="not guaranteed" warn>
          <p className={smallCls}>{declined ? 'Permission was denied, so install to ensure your conversations are saved.' : 'Install to ensure your conversations are saved.'}</p>
          <Actions>
            {installEvent && <InkButton className="my-2" onClick={() => void installEvent.prompt()}>Install</InkButton>}
            {d.persisted === false && !declined && (
              <TextAction className={linkCls} onClick={guard(async () => { if (!(await requestPersistence())) setDeclined(true); })}>Ask to keep them</TextAction>
            )}
          </Actions>
          {(route === 'ios' || route === 'mac-safari') && <p className={smallCls}>{installSteps[route]}</p>}
        </Group>
      )}

      <Group label="Backup file" note={backupNote} warn={backupWarn}>
        <Actions>
          {fs && sync === 'needs_permission' && <InkButton className="my-2" onClick={guard(reauthorizeFileSync)}>Resume</InkButton>}
          <TextAction className={linkCls} onClick={guard(downloadExport)}>Save now</TextAction>
          {fs && sync === 'off' && <TextAction className={linkCls} onClick={guard(bindExportFile)}>Turn on auto…</TextAction>}
          {fs && sync === 'active' && <TextAction className={linkCls} onClick={guard(unbindExportFile)}>Turn off auto</TextAction>}
          <TextAction className={linkCls} onClick={() => document.getElementById('import-file-input')?.click()}>Restore…</TextAction>
          <input id="import-file-input" type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
            const input = e.target;
            const f = input.files?.[0];
            input.value = '';
            if (!f) return;
            setMsg('');
            try { setItems(await planImport(await f.text())); setChoices({}); } catch (err) { setMsg((err as Error).message); }
          }} />
        </Actions>
        {items && (
          <div className="space-y-2 pt-2 text-[17px]">
            {items.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate">{it.title}</div>
                  {it.error && <div className="text-[14px] text-accent">{it.error}</div>}
                  {it.conflict && !it.error && <div className="text-[14px] text-graphite">Already here</div>}
                </div>
                {!it.error && (
                  <select className="border-0 border-b border-card-rule bg-transparent px-1 py-1 text-[14px] text-ink focus:border-ink focus:outline-none" value={choices[it.id] ?? (it.conflict ? 'copy' : 'replace')} onChange={(e) => setChoices({ ...choices, [it.id]: e.target.value as Choice })}>
                    {it.conflict ? <><option value="copy">Add as copy</option><option value="replace">Replace (backup kept)</option></> : <option value="replace">Add</option>}
                    <option value="skip">Skip</option>
                  </select>
                )}
              </div>
            ))}
            <div className="flex items-center gap-5 pt-1">
              <InkButton onClick={guard(async () => { const r = await commitImport(items, choices); setItems(null); setMsg(`Added ${r.added}, replaced ${r.replaced}.`); })}>Import</InkButton>
              <TextAction className={linkCls} onClick={() => setItems(null)}>Cancel</TextAction>
            </div>
          </div>
        )}
      </Group>
      {msg && <p className="text-[14px] text-ink">{msg}</p>}
    </div>
  );
}

const THEMES: { id: Theme; label: string }[] = [{ id: 'system', label: 'Auto' }, { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }];

/** Light or dark paper, or whichever the device is using, on one line;
 * the one in use circled in pencil. */
function Appearance() {
  const theme = useTheme();
  return (
    <div role="radiogroup" aria-label="Appearance" className="flex flex-wrap items-center gap-x-6">
      {THEMES.map((t) => {
        const on = theme === t.id;
        return (
          <TextAction key={t.id} role="radio" aria-checked={on} data-selected={on} className={on ? '' : 'text-graphite!'} onClick={() => setTheme(t.id)}>
            {t.label}
          </TextAction>
        );
      })}
    </div>
  );
}

function Licenses() {
  const [t, setT] = useState('');
  useEffect(() => { void methodsLicense().then(setT); }, []);
  return <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[13px] text-graphite">{t}</pre>;
}

/** The goal switcher, as a shelf of notebooks (menu.html's "Notebooks"
 * group), the open one underlined. */
function NotebookShelf({ goals, activeId, onSwitch, onNew }: { goals: GoalRecord[]; activeId?: string; onSwitch: (id: string) => void; onNew: () => void }) {
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {goals.map((g) => (
          <li key={g.id} className="flex items-baseline justify-between gap-3">
            <TextAction
              className={`!min-h-0 block min-w-0 py-1 text-left font-serif text-[18px] font-medium not-italic underline-offset-[3px] ${g.id === activeId ? '' : 'no-underline'}`}
              aria-current={g.id === activeId || undefined}
              onClick={() => onSwitch(g.id)}
            >
              <span className="block truncate">{g.title}</span>
            </TextAction>
            {g.id === activeId && <span className="shrink-0 text-[14px] text-graphite">open</span>}
          </li>
        ))}
      </ul>
      <TextAction className={linkCls} onClick={onNew}>New goal</TextAction>
    </div>
  );
}

export interface SettingsPageProps {
  goalId?: string;
  goals?: GoalRecord[];
  activeId?: string;
  cost?: { dollars: number | null; turns: number } | null;
  onSwitchGoal?: (id: string) => void;
  onNewGoal?: () => void;
}

/** Estimated spend on one line, the breakdown one tap behind it. Shows
 * nothing until a turn has been billed. */
function Spend({ cost }: { cost: SettingsPageProps['cost'] }) {
  if (!cost || cost.turns === 0) return null;
  return (
    <Reveal summary={<>{cost.dollars === null ? 'Spend unknown' : fmtUsd(cost.dollars)} <span className="text-graphite">in the last 6 hours</span></>} more="Details">
      <CostPanel />
    </Reveal>
  );
}

/** The provider and model in use on one line, the form one tap behind it. */
function Model() {
  const [p, setP] = useState<{ s: ProviderSettings; key: boolean } | null>(null);
  const load = async () => { const s = await getProvider(); setP(s ? { s, key: await hasApiKey(s.kind) } : null); };
  useEffect(() => { void load(); }, []);
  const summary = p ? <>{PROVIDERS[p.s.kind]?.label ?? p.s.kind} <span className="text-graphite">· {p.s.model}</span></> : 'Not set';
  return (
    <div className="space-y-1">
      <Reveal summary={summary} more="Change" less="Close">
        <ProviderForm onDone={() => void load()} />
      </Reveal>
      {p && !p.key && <PencilWord className="block text-[19px]">no key saved</PencilWord>}
    </div>
  );
}

/** The maker's mark, where a notebook carries it: inside the cover, at the
 * foot. The only place the wordmark appears once a notebook is open. */
function Colophon() {
  const [open, setOpen] = useState(false);
  return (
    <footer className="space-y-1">
      <div className="font-serif text-[17px] font-semibold leading-[25.5px] tracking-[-0.01em] text-ink">gambit</div>
      <p className={smallCls}>Version {__APP_VERSION__}.</p>
      <TextAction className={`${linkCls} text-[14px]! text-graphite!`} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide licenses' : 'Licenses'}</TextAction>
      {open && <div className="anim-fade-in"><Licenses /></div>}
    </footer>
  );
}

/** Inside cover: everything the old menu Leaf had, laid out as plain page
 * sections (owner correction — "it's a page, not a Leaf"). */
export function SettingsPage({ goalId, goals, activeId, cost, onSwitchGoal, onNewGoal }: SettingsPageProps) {
  return (
    <div className="space-y-12">
      <PageSection title="Notebooks">
        <NotebookShelf goals={goals ?? []} activeId={activeId} onSwitch={(id) => onSwitchGoal?.(id)} onNew={() => onNewGoal?.()} />
      </PageSection>
      <PageSection title="Model"><Model /></PageSection>
      <PageSection title="Chat">
        <Spend cost={cost} />
        {goalId && (
          <Actions>
            <TextAction className={linkCls} onClick={() => confirm('Clear the chat? Your goal is kept.') && void clearChat(goalId)}>Clear chat</TextAction>
          </Actions>
        )}
      </PageSection>
      <PageSection title="Backup"><KeepSafe /></PageSection>
      <PageSection title="Theme"><Appearance /></PageSection>
      <PageSection title="Danger zone">
        <Actions>
          {goalId && <TextAction className={linkCls} onClick={() => confirm('Delete this goal and its chat? This cannot be undone.') && void deleteGoal(goalId)}>Delete this goal</TextAction>}
          <TextAction className={linkCls} onClick={() => confirm('Erase all Gambit data on this device, including your key?') && void db.delete().then(() => location.reload())}>Erase everything</TextAction>
        </Actions>
      </PageSection>
      <Colophon />
    </div>
  );
}
