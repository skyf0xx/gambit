import { useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BR, ES, FR, GB, IT } from 'country-flag-icons/react/3x2';
import { db, getSetting } from '../lib/db';
import { deleteGoal, readRecord } from '../lib/goals';
import { downloadIcs, goalDates } from '../lib/calendar';
import { clearChat } from '../lib/agent';
import { readDurability, requestPersistence, installRoute, installSteps, useUi, type Durability } from '../lib/persist';
import { bindExportFile, commitImport, downloadExport, fileSyncState, fsAccessSupported, planImport, reauthorizeFileSync, unbindExportFile, type Choice, type ImportItem } from '../lib/portability';
import { setTheme, useTheme, type Theme } from '../lib/theme';
import { LOCALES, intlLocale, locale, setLocale, t, type Locale } from '../lib/i18n';
import { track } from '../lib/analytics';
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
  return d.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

const ADD_KEY = 'gambit:add-key';
let addKeyAsked = false;

/** Turn to Settings with the model form open, to add a key. */
export function openKeySettings() {
  addKeyAsked = true;
  window.dispatchEvent(new Event('gambit:menu'));
  window.dispatchEvent(new Event(ADD_KEY));
}

/** Provider and model, with the form opening under the row. */
function Model() {
  const [p, setP] = useState<{ s: ProviderSettings; key: boolean } | null>(null);
  const [open, setOpen] = useState(() => { const asked = addKeyAsked; addKeyAsked = false; return asked; });
  useEffect(() => {
    const onAsk = () => { addKeyAsked = false; setOpen(true); };
    window.addEventListener(ADD_KEY, onAsk);
    return () => window.removeEventListener(ADD_KEY, onAsk);
  }, []);
  const load = async () => { const s = await getProvider(); setP(s ? { s, key: await hasApiKey(s.kind) } : null); };
  useEffect(() => { void load(); }, []);
  const noKey = !!p && !p.key;
  return (
    <Row
      label={p ? PROVIDERS[p.s.kind]?.label ?? p.s.kind : t('settings.provider')}
      value={!p ? t('settings.notSet') : noKey ? t('settings.noKeySaved') : p.s.model}
      warn={!p || noKey}
      action={<Act aria-expanded={open} onClick={() => setOpen(!open)}>{open ? t('settings.close') : t('settings.change')}</Act>}
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
    ? <InkButton onClick={() => void installEvent.prompt()}>{t('settings.install')}</InkButton>
    : d?.persisted === false && !declined
      ? <Act onClick={guard(async () => { if (!(await requestPersistence())) setDeclined(true); })}>{t('settings.allow')}</Act>
      : null;

  return (
    <>
      {d && !kept && (
        <Row label={t('settings.storage')} value={t('settings.storageValue')} action={installAction}>
          {!installEvent && (route === 'ios' || route === 'mac-safari') ? <p className="text-[14px] text-graphite">{installSteps[route]}</p> : null}
        </Row>
      )}

      {fs && (
        <Row
          label={t('settings.autoBackup')}
          value={sync === 'active' ? t('settings.on') : sync === 'needs_permission' ? t('settings.paused') : t('settings.off')}
          warn={sync === 'needs_permission'}
          action={
            sync === 'active' ? <Act onClick={guard(unbindExportFile)}>{t('settings.turnOff')}</Act>
            : sync === 'needs_permission' ? <Act onClick={guard(reauthorizeFileSync)}>{t('settings.resume')}</Act>
            : <Act onClick={guard(bindExportFile)}>{t('settings.turnOn')}</Act>
          }
        />
      )}

      <Row
        label={t('settings.backupFile')}
        value={last ? t('settings.lastSaved', { day: shortDay(last) }) : t('settings.neverSaved')}
        warn={sync !== 'active' && stale}
        action={<Act onClick={guard(downloadExport)}>{t('settings.download')}</Act>}
      />

      <Row label={t('settings.restore')} value={t('settings.restoreValue')} action={<Act onClick={() => document.getElementById('import-file-input')?.click()}>{t('settings.chooseFile')}</Act>}>
        {items && (
          <div className="space-y-2 text-[17px]">
            {items.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate">{it.title}</div>
                  {it.error && <div className="text-[14px] text-accent">{it.error}</div>}
                  {it.conflict && !it.error && <div className="text-[14px] text-graphite">{t('settings.alreadyHere')}</div>}
                </div>
                {!it.error && (
                  <select className="border-0 border-b border-card-rule bg-transparent px-1 py-1 text-[14px] text-ink focus:border-ink focus:outline-none" value={choices[it.id] ?? (it.conflict ? 'copy' : 'replace')} onChange={(e) => setChoices({ ...choices, [it.id]: e.target.value as Choice })}>
                    {it.conflict ? <><option value="copy">{t('settings.addAsCopy')}</option><option value="replace">{t('settings.replace')}</option></> : <option value="replace">{t('settings.add')}</option>}
                    <option value="skip">{t('settings.skip')}</option>
                  </select>
                )}
              </div>
            ))}
            <div className="flex items-center gap-5 pt-1">
              <InkButton onClick={guard(async () => { const r = await commitImport(items, choices); setItems(null); setMsg(t('settings.restored', { added: r.added, replaced: r.replaced })); })}>{t('settings.restore')}</InkButton>
              <Act onClick={() => setItems(null)}>{t('settings.cancel')}</Act>
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
      label={t('settings.costLabel')}
      value={cost.dollars === null ? t('settings.costUnknown') : fmtUsd(cost.dollars)}
      action={<Act aria-expanded={open} onClick={() => setOpen(!open)}>{open ? t('settings.hide') : t('settings.details')}</Act>}
    >
      {open && <CostPanel />}
    </Row>
  );
}

const THEMES: { id: Theme; label: string }[] = [{ id: 'system', label: t('settings.themeAuto') }, { id: 'light', label: t('settings.themeLight') }, { id: 'dark', label: t('settings.themeDark') }];

/** The theme in use is in ink and circled; the others in graphite. */
function ThemePicker() {
  const theme = useTheme();
  return (
    <div role="radiogroup" aria-label={t('settings.theme')} className="flex items-center gap-x-8 pl-1">
      {THEMES.map((th) => {
        const on = theme === th.id;
        return (
          <TextAction key={th.id} circle={false} role="radio" aria-checked={on} data-selected={on} className={on ? '' : 'text-graphite! hover:text-ink!'} onClick={() => setTheme(th.id)}>
            {th.label}
          </TextAction>
        );
      })}
    </div>
  );
}

// The landing page's flags (landing-i18n.mjs): they only help the eye, and
// the name says the language, so Portuguese sits under Brazil's flag and
// English under the UK's.
const FLAGS: Record<Locale, typeof GB> = { en: GB, fr: FR, it: IT, es: ES, pt: BR };

/** Each language in its own words, behind its flag; the one in use is in
 * ink. Picking another reloads the app into it. */
function LanguagePicker() {
  const current = locale();
  return (
    <div role="radiogroup" aria-label={t('language.label')} className="flex flex-wrap items-center gap-x-8 pl-1">
      {(Object.keys(LOCALES) as Locale[]).map((l) => {
        const on = current === l;
        const Flag = FLAGS[l];
        return (
          <TextAction key={l} lang={l} circle={false} role="radio" aria-checked={on} data-selected={on} className={`inline-flex items-center gap-1.5 ${on ? '' : 'text-graphite! hover:text-ink!'}`} onClick={() => { if (!on) { track('language_set', { locale: l }); setLocale(l); } }}>
            <Flag aria-hidden="true" className={`h-[14px] w-[21px] shrink-0 rounded-[2px] ring-1 ring-rule ${on ? '' : 'opacity-90'}`} />
            {LOCALES[l]}
          </TextAction>
        );
      })}
    </div>
  );
}

const link = 'underline underline-offset-[3px] hover:text-ink';

/** The maker's mark, where a notebook carries it: inside the cover, at the
 * foot. The only place the wordmark appears once a notebook is open. */
function Colophon() {
  return (
    <footer className="space-y-1 border-t border-rule pt-6">
      <div className="font-serif text-[17px] font-semibold leading-[25.5px] tracking-[-0.01em] text-ink">gambit</div>
      <p className="text-[14px] leading-[22px] text-graphite">{t('settings.version', { version: __APP_VERSION__ })}</p>
      <p className="text-[14px] leading-[22px] text-graphite">
        {t('settings.bmad.before')}<a className={link} href="https://github.com/bmad-code-org/BMAD-METHOD" target="_blank" rel="noreferrer">{t('settings.bmad.link')}</a>{t('settings.bmad.between')}<a className={link} href="/licenses/BMAD/LICENSE" target="_blank" rel="noreferrer">{t('settings.bmad.licence')}</a>{t('settings.bmad.after')}
      </p>
      <p className="pt-4 text-[14px] leading-[22px] text-graphite">
        {t('settings.star.before')}<a className={link} href="https://github.com/skyf0xx/gambit" target="_blank" rel="noreferrer">{t('settings.star.link')}</a>{t('settings.star.after')}
      </p>
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

/** The goal's open dates as a calendar file. Hidden when it has none. */
function CalendarDates({ goalId }: { goalId: string }) {
  const goal = useLiveQuery(async () => {
    const rec = await db.goals.get(goalId);
    const read = rec ? await readRecord(rec) : null;
    return read?.status === 'ok' ? read.data : null;
  }, [goalId]);
  const n = goal ? goalDates(goal).length : 0;
  if (!goal || n === 0) return null;
  return (
    <Section title={t('settings.sectionCalendar')}>
      <Row label={t('settings.calendarAdd')} value={t('settings.calendarDates', { count: n })} action={<Act onClick={() => downloadIcs(goal, goalId)}>{t('settings.download')}</Act>} />
    </Section>
  );
}

/** Inside cover: AI model, backup, chat, theme, delete. */
export function SettingsPage({ goalId, cost }: SettingsPageProps) {
  return (
    <div className="space-y-6">
      <Section title={t('settings.sectionModel')}><Model /></Section>
      <Section title={t('settings.sectionBackup')}><Backup /></Section>
      {goalId && <CalendarDates goalId={goalId} />}
      <Section title={t('settings.sectionChat')}>
        <Spend cost={cost} />
        {goalId && (
          <Row label={t('settings.chatHistory')} value={t('settings.goalKept')} action={<Act onClick={() => confirm(t('settings.confirmClear')) && void clearChat(goalId)}>{t('settings.clear')}</Act>} />
        )}
      </Section>
      <Section title={t('settings.theme')}><ThemePicker /></Section>
      <Section title={t('language.label')}><LanguagePicker /></Section>
      <Section title={t('settings.sectionDelete')}>
        {goalId && (
          <Row label={t('settings.thisGoal')} value={t('settings.andItsChat')} action={<Act danger onClick={() => confirm(t('settings.confirmDelete')) && void deleteGoal(goalId)}>{t('settings.delete')}</Act>} />
        )}
        <Row label={t('settings.allData')} value={t('settings.allDataValue')} action={<Act danger onClick={() => confirm(t('settings.confirmErase')) && void db.delete().then(() => location.reload())}>{t('settings.erase')}</Act>} />
      </Section>
      <Colophon />
    </div>
  );
}
