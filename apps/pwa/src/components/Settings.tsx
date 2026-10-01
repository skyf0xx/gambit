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

// The Inside cover page: plain page sections split by a light rule, no
// containers around ordinary text (brand/identity.md §05).
//
// Every setting is one Row: what it is, its current value under that, and
// one action at the right. Forms and detail open below the row that owns
// them. Pencil marks only a value that needs attention (no key, never
// backed up), and actions here skip the hover circle, so a page with
// nothing wrong reads quietly.

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-2 border-t border-rule pt-6 first:border-t-0 first:pt-0">
    <h2 className="pb-1 font-sans text-[20px] font-semibold leading-7">{title}</h2>
    {children}
  </section>
);

/** One setting: its name, its current value under it, one action. */
function Row({ label, value, warn, action, children }: { label: string; value?: ReactNode; warn?: boolean; action?: ReactNode; children?: ReactNode }) {
  return (
    <div>
      <div className="flex min-h-[52px] items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[17px] leading-6 text-ink">{label}</div>
          {value && (warn
            ? <PencilWord className="block text-[18px] leading-6">{value}</PencilWord>
            : <div className="break-words text-[14px] leading-5 text-graphite">{value}</div>)}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children && <div className="anim-fade-in pt-2 pb-4">{children}</div>}
    </div>
  );
}

// Actions in pencil, not ink: graphite over a faint underline, ink on hover.
const linkCls = 'text-graphite! underline decoration-graphite/40 underline-offset-[3px] hover:text-ink! hover:decoration-ink/60';
const dangerCls = 'text-accent! underline decoration-accent/40 underline-offset-[3px] hover:decoration-accent';
const Act = ({ className = '', danger = false, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) => (
  <TextAction circle={false} className={`${danger ? dangerCls : linkCls} ${className}`} {...p} />
);

/** "19 Sep", with the year only when it isn't this one. */
function shortDay(ts: number): string {
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** The goal switcher. The open goal is in ink, the rest in graphite. */
function Goals({ goals, activeId, onSwitch, onNew }: { goals: GoalRecord[]; activeId?: string; onSwitch: (id: string) => void; onNew: () => void }) {
  return (
    <>
      <ul>
        {goals.map((g) => {
          const on = g.id === activeId;
          return (
            <li key={g.id}>
              <TextAction
                circle={false}
                aria-current={on || undefined}
                className={`flex w-full py-1.5 text-left font-serif text-[18px] leading-[26px] ${on ? 'font-semibold text-ink' : 'text-graphite! hover:text-ink!'}`}
                onClick={() => onSwitch(g.id)}
              >
                {g.title}
              </TextAction>
            </li>
          );
        })}
      </ul>
      <Act onClick={onNew}>New goal</Act>
    </>
  );
}

/** Provider and model, with the form opening under the row. */
function Model() {
  const [p, setP] = useState<{ s: ProviderSettings; key: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const load = async () => { const s = await getProvider(); setP(s ? { s, key: await hasApiKey(s.kind) } : null); };
  useEffect(() => { void load(); }, []);
  const noKey = !!p && !p.key;
  return (
    <Row
      label={p ? PROVIDERS[p.s.kind]?.label ?? p.s.kind : 'Provider'}
      value={!p ? 'Not set' : noKey ? 'no key saved' : p.s.model}
      warn={!p || noKey}
      action={<Act aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Close' : 'Change'}</Act>}
    >
      {open && <ProviderForm onDone={() => { setOpen(false); void load(); }} />}
    </Row>
  );
}

/** Backup: install (only when the browser could clear the data), the
 * automatic backup, a one-off download, and restore. */
function Backup() {
  const [d, setD] = useState<Durability | null>(null);
  const [sync, setSync] = useState<'off' | 'active' | 'needs_permission'>('off');
  const [items, setItems] = useState<ImportItem[] | null>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [msg, setMsg] = useState('');
  const last = useLiveQuery(() => getSetting<number>('lastExportAt'), []);
  const installEvent = useUi((s) => s.installEvent);
  const justInstalled = useUi((s) => s.justInstalled);
  const [declined, setDeclined] = useState(false);
  const refresh = async () => { setD(await readDurability()); setSync(await fileSyncState()); };
  useEffect(() => { void refresh(); }, []);
  const guard = (f: () => Promise<void>) => async () => { setMsg(''); try { await f(); } catch (e) { if ((e as Error).name !== 'AbortError') setMsg((e as Error).message); } await refresh(); };

  // Either one stops the browser clearing the data on its own.
  const kept = !!d?.installed || justInstalled || !!d?.persisted;
  const route = installRoute(!!installEvent);
  const fs = fsAccessSupported();
  const stale = !last || Date.now() - last > 14 * 864e5;

  const installAction = installEvent
    ? <InkButton onClick={() => void installEvent.prompt()}>Install</InkButton>
    : d?.persisted === false && !declined
      ? <Act onClick={guard(async () => { if (!(await requestPersistence())) setDeclined(true); })}>Allow</Act>
      : null;

  return (
    <>
      {d && !kept && (
        <Row label="Storage" value="Install to ensure your conversations are saved." action={installAction}>
          {!installEvent && (route === 'ios' || route === 'mac-safari') ? <p className="text-[14px] text-graphite">{installSteps[route]}</p> : null}
        </Row>
      )}

      {fs && (
        <Row
          label="Automatic backup"
          value={sync === 'active' ? 'On' : sync === 'needs_permission' ? 'paused' : 'Off'}
          warn={sync === 'needs_permission'}
          action={
            sync === 'active' ? <Act onClick={guard(unbindExportFile)}>Turn off</Act>
            : sync === 'needs_permission' ? <Act onClick={guard(reauthorizeFileSync)}>Resume</Act>
            : <Act onClick={guard(bindExportFile)}>Turn on</Act>
          }
        />
      )}

      <Row
        label="Backup file"
        value={last ? `Last saved ${shortDay(last)}` : 'never saved'}
        warn={sync !== 'active' && stale}
        action={<Act onClick={guard(downloadExport)}>Download</Act>}
      />

      <Row label="Restore" value="From a backup file" action={<Act onClick={() => document.getElementById('import-file-input')?.click()}>Choose file</Act>}>
        {items && (
          <div className="space-y-2 text-[17px]">
            {items.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate">{it.title}</div>
                  {it.error && <div className="text-[14px] text-accent">{it.error}</div>}
                  {it.conflict && !it.error && <div className="text-[14px] text-graphite">Already here</div>}
                </div>
                {!it.error && (
                  <select className="border-0 border-b border-card-rule bg-transparent px-1 py-1 text-[14px] text-ink focus:border-ink focus:outline-none" value={choices[it.id] ?? (it.conflict ? 'copy' : 'replace')} onChange={(e) => setChoices({ ...choices, [it.id]: e.target.value as Choice })}>
                    {it.conflict ? <><option value="copy">Add as copy</option><option value="replace">Replace</option></> : <option value="replace">Add</option>}
                    <option value="skip">Skip</option>
                  </select>
                )}
              </div>
            ))}
            <div className="flex items-center gap-5 pt-1">
              <InkButton onClick={guard(async () => { const r = await commitImport(items, choices); setItems(null); setMsg(`Added ${r.added}, replaced ${r.replaced}.`); })}>Restore</InkButton>
              <Act onClick={() => setItems(null)}>Cancel</Act>
            </div>
          </div>
        )}
      </Row>
      <input id="import-file-input" type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
        const input = e.target;
        const f = input.files?.[0];
        input.value = '';
        if (!f) return;
        setMsg('');
        try { setItems(await planImport(await f.text())); setChoices({}); } catch (err) { setMsg((err as Error).message); }
      }} />
      {msg && <p className="text-[14px] text-ink">{msg}</p>}
    </>
  );
}

/** Spend over the last six hours, the breakdown opening under it. Hidden
 * until a turn has been billed. */
function Spend({ cost }: { cost: SettingsPageProps['cost'] }) {
  const [open, setOpen] = useState(false);
  if (!cost || cost.turns === 0) return null;
  return (
    <Row
      label="Cost, last 6 hours"
      value={cost.dollars === null ? 'Unknown for this model' : fmtUsd(cost.dollars)}
      action={<Act aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Details'}</Act>}
    >
      {open && <CostPanel />}
    </Row>
  );
}

const THEMES: { id: Theme; label: string }[] = [{ id: 'system', label: 'Auto' }, { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }];

/** The theme in use is in ink and circled; the others in graphite. */
function ThemePicker() {
  const theme = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="flex items-center gap-x-8 pl-1">
      {THEMES.map((t) => {
        const on = theme === t.id;
        return (
          <TextAction key={t.id} circle={false} role="radio" aria-checked={on} data-selected={on} className={on ? '' : 'text-graphite! hover:text-ink!'} onClick={() => setTheme(t.id)}>
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

/** The maker's mark, where a notebook carries it: inside the cover, at the
 * foot. The only place the wordmark appears once a notebook is open. */
function Colophon() {
  const [open, setOpen] = useState(false);
  return (
    <footer className="space-y-1 border-t border-rule pt-6">
      <div className="font-serif text-[17px] font-semibold leading-[25.5px] tracking-[-0.01em] text-ink">gambit</div>
      <p className="text-[14px] leading-[22px] text-graphite">Version {__APP_VERSION__}</p>
      <Act className="text-[14px]!" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide licenses' : 'Licenses'}</Act>
      {open && <div className="anim-fade-in"><Licenses /></div>}
    </footer>
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

/** Inside cover: goals, AI model, backup, chat, theme, delete. */
export function SettingsPage({ goalId, goals, activeId, cost, onSwitchGoal, onNewGoal }: SettingsPageProps) {
  return (
    <div className="space-y-6">
      <Section title="Goals">
        <Goals goals={goals ?? []} activeId={activeId} onSwitch={(id) => onSwitchGoal?.(id)} onNew={() => onNewGoal?.()} />
      </Section>
      <Section title="AI model"><Model /></Section>
      <Section title="Backup"><Backup /></Section>
      <Section title="Chat">
        <Spend cost={cost} />
        {goalId && (
          <Row label="Chat history" value="Your goal is kept" action={<Act onClick={() => confirm('Clear the chat history? Your goal is kept.') && void clearChat(goalId)}>Clear</Act>} />
        )}
      </Section>
      <Section title="Theme"><ThemePicker /></Section>
      <Section title="Delete">
        {goalId && (
          <Row label="This goal" value="And its chat" action={<Act danger onClick={() => confirm('Delete this goal and its chat? This cannot be undone.') && void deleteGoal(goalId)}>Delete</Act>} />
        )}
        <Row label="All data" value="Every goal and your key" action={<Act danger onClick={() => confirm('Erase all Gambit data on this device, including your key?') && void db.delete().then(() => location.reload())}>Erase</Act>} />
      </Section>
      <Colophon />
    </div>
  );
}
