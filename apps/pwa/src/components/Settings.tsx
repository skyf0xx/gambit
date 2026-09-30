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
import { TextAction, InkButton, PencilWord } from './ui';
import { ProviderForm } from './Setup';
import { CostPanel } from './CostPanel';
import type { GoalRecord } from '../lib/db';

// The Inside cover page (owner correction: no longer a Leaf/popup — a real
// tab+panel, so its content is plain page sections per brand/identity.md
// §05 ("no containers around ordinary text" — a heading and text on the
// page, separated by whitespace), not the old <details> accordion. Order:
// Your notebooks, Model and key, Saving your work (install + backup file),
// Conversation and cost (clear chat, spend), the danger zone, and the maker's mark
// with the version and licenses at the foot.
//
// Three levels, and no rules between them: a section heading, a small
// graphite label over each group inside a section, then rows and actions.
// Sections sit further apart than anything inside one, so the whitespace
// alone shows where a section ends.

const PageSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-4">
    <h2 className="font-sans text-[20px] font-semibold leading-7">{title}</h2>
    {children}
  </section>
);

/** A labelled group inside a section. `note` is the group's current state,
 * pencilled at the end of the label's line. */
const Group = ({ label, note, children }: { label: string; note?: string; children: ReactNode }) => (
  <div className="space-y-1">
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-[14px] leading-5 text-graphite">{label}</h3>
      {note && <PencilWord className="shrink-0 text-[19px]">{note}</PencilWord>}
    </div>
    {children}
  </div>
);

/** One fact and its pencilled answer, at opposite ends of a line. */
const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-baseline justify-between gap-3 text-[17px] leading-[27px]">
    <span>{label}</span>
    <PencilWord className="shrink-0">{children}</PencilWord>
  </div>
);

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

/** "Saving your work": whether the browser will keep the notebooks, with
 * the action that fixes it when it won't, and the backup file. */
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
  const backupNote =
    sync === 'active' ? 'backing up automatically'
    : sync === 'needs_permission' ? 'needs permission'
    : !last ? 'not saved yet'
    : stale ? `last saved ${shortDay(last)}, a while ago`
    : `saved ${shortDay(last)}`;

  return (
    <div className="space-y-6">
      <Group label="In this browser" note={d ? (kept ? 'kept' : 'could be cleared') : undefined}>
        {d && (kept ? (
          <p className={smallCls}>
            Your notebooks live only in this browser, and it won't clear them on its own.
            {installed ? ' Gambit is installed on this device.' : ' The browser has agreed to keep them.'}
          </p>
        ) : (
          <>
            <p className={smallCls}>
              Your notebooks live only in this browser, and browsers clear sites you haven't opened in a while (Safari after about a week). Installing Gambit stops that.
            </p>
            <Actions>
              {installEvent && <InkButton className="my-2" onClick={() => void installEvent.prompt()}>Install Gambit</InkButton>}
              {d.persisted === false && !declined && (
                <TextAction className={linkCls} onClick={guard(async () => { if (!(await requestPersistence())) setDeclined(true); })}>
                  {installEvent ? 'Or ask the browser to keep them' : 'Ask the browser to keep them'}
                </TextAction>
              )}
            </Actions>
            {route === 'ios' || route === 'mac-safari' ? (
              <p className={smallCls}>To install: {installSteps[route].charAt(0).toLowerCase() + installSteps[route].slice(1)}</p>
            ) : route === 'none' ? (
              <p className={smallCls}>This browser can't install apps, so a backup file is your safety net.</p>
            ) : null}
            {declined && <p className={smallCls}>The browser said no. Installing usually changes its mind, and a backup file covers you either way.</p>}
          </>
        ))}
      </Group>

      <Group label="Backup file" note={backupNote}>
        {/* One action per line: the automatic backup first where the
            browser supports it, the one-off save under it. */}
        <div className="flex flex-col items-start">
          {fsAccessSupported() && sync === 'off' && <TextAction className={linkCls} onClick={guard(bindExportFile)}>Back up to a file automatically…</TextAction>}
          {fsAccessSupported() && sync === 'needs_permission' && <InkButton className="my-2" onClick={guard(reauthorizeFileSync)}>Resume automatic backups</InkButton>}
          <TextAction className={linkCls} onClick={guard(downloadExport)}>{fsAccessSupported() ? 'Save a backup file now' : 'Save a backup file'}</TextAction>
          {fsAccessSupported() && sync === 'active' && <TextAction className={linkCls} onClick={guard(unbindExportFile)}>Stop automatic backups</TextAction>}
        </div>
        {!fsAccessSupported() && <p className={smallCls}>This browser can't back up automatically, so save a backup file every so often.</p>}
      </Group>

      <Group label="Restore">
        <Actions>
          <TextAction className={linkCls} onClick={() => document.getElementById('import-file-input')?.click()}>
            Import a backup file…
          </TextAction>
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

const THEMES: { id: Theme; label: string }[] = [{ id: 'system', label: 'Match my device' }, { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }];

/** Light or dark paper, or whichever the device is using: one option per
 * line, the one in use circled in pencil. */
function Appearance() {
  const theme = useTheme();
  return (
    <div role="radiogroup" aria-label="Appearance" className="flex flex-col items-start gap-1.5 pl-2">
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
 * group) — the current one marked with a pencilled word. */
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

/** The session's estimated spend on one line, with the token and prompt
 * breakdown one tap behind it. Shows nothing until a turn has been billed. */
function Spend({ cost }: { cost: SettingsPageProps['cost'] }) {
  const [open, setOpen] = useState(false);
  if (!cost || cost.turns === 0) return null;
  return (
    <Group label="Estimated spend, last six hours">
      <Row label={cost.dollars === null ? 'No list price for this model' : fmtUsd(cost.dollars)}>{`${cost.turns} turn${cost.turns === 1 ? '' : 's'}`}</Row>
      <Actions>
        <TextAction className={linkCls} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide the breakdown' : 'Show the breakdown'}</TextAction>
      </Actions>
      {open && <div className="anim-fade-in pt-1"><CostPanel /></div>}
    </Group>
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
      <PageSection title="Your notebooks">
        <NotebookShelf goals={goals ?? []} activeId={activeId} onSwitch={(id) => onSwitchGoal?.(id)} onNew={() => onNewGoal?.()} />
      </PageSection>
      <PageSection title="Model and key"><ProviderForm /></PageSection>
      <PageSection title="Saving your work"><KeepSafe /></PageSection>
      <PageSection title="Appearance"><Appearance /></PageSection>
      <PageSection title="Conversation and cost">
        <div className="space-y-6">
          {goalId && (
            <Group label="Conversation">
              <Actions>
                <TextAction className={linkCls} onClick={() => confirm('Clear the conversation? The goal itself is kept.') && void clearChat(goalId)}>
                  Clear the conversation
                </TextAction>
              </Actions>
            </Group>
          )}
          <Spend cost={cost} />
        </div>
      </PageSection>
      <PageSection title="Danger zone">
        <Actions>
          {goalId && <TextAction className={linkCls} onClick={() => confirm('Delete the active goal and its chat? This cannot be undone. Export first if unsure.') && void deleteGoal(goalId)}>Delete active goal</TextAction>}
          <TextAction className={linkCls} onClick={() => confirm('Erase ALL Gambit data on this device, including your saved key?') && void db.delete().then(() => location.reload())}>Erase everything</TextAction>
        </Actions>
      </PageSection>
      <Colophon />
    </div>
  );
}
