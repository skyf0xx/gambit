import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { writeSection } from '@gambit/core';
import { db } from '../lib/db';
import { applyOp, readRecord, snapshot } from '../lib/goals';
import type { Goal } from '../lib/types';
import { TextAction, InkButton, PencilWord, RuledInput, inputCls } from './ui';
import { SectionBody, EMPTY_PROMPTS, formatDate } from './Sections';
import { sectionTitleFor } from './sectionTitles';
import { MarksProvider } from './marks/context';
import { MarksLayer } from './marks/MarksLayer';
import { IndexCard } from './IndexCard';
import { StickyNotes } from './StickyNotes';
import { timeLeft } from '../lib/dates';

const SECTION_KEYS = ['plan', 'criteriaStatus', 'people', 'stakeholders', 'systemsNotes', 'riskNotes', 'decisions', 'exposure', 'capacity', 'forecasts', 'experiments'] as const;
const isEmpty = (v: unknown) => v == null || (Array.isArray(v) ? v.length === 0 : typeof v === 'object' && Object.keys(v as object).length === 0);

function EditJson({ goalId, k, value, onDone }: { goalId: string; k: string; value: unknown; onDone: () => void }) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [errs, setErrs] = useState<string[]>([]);
  async function save() {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch (e) { return setErrs([`Invalid JSON: ${(e as Error).message}`]); }
    await snapshot(goalId, 'edit');
    const r = await applyOp(goalId, (g) => writeSection(g, k, parsed) as never);
    if (r.ok) onDone(); else setErrs(r.errors.map((e) => `${e.path}: ${e.message}`));
  }
  return (
    <div className="space-y-2">
      <textarea className={`${inputCls} min-h-64 font-mono text-[14px]`} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      {errs.map((e, i) => <p key={i} className="text-[14px] text-accent">{e}</p>)}
      <div className="flex gap-3"><InkButton onClick={() => void save()}>Save</InkButton><TextAction onClick={onDone}>Cancel</TextAction></div>
    </div>
  );
}

function Section({ goalId, k, data }: { goalId: string; k: (typeof SECTION_KEYS)[number]; data: unknown }) {
  const [editing, setEditing] = useState(false);
  const { title, method, methodNote } = sectionTitleFor(k);
  return (
    <section className="anim-fade-in space-y-2">
      <h2 className="font-sans text-[17px] font-semibold leading-6">
        {title}
        {method && (
          <>
            <span className="sr-only"> — </span>
            <span data-note={methodNote}>
              <PencilWord className="ml-2 text-[19px]">{method}</PencilWord>
            </span>
          </>
        )}
      </h2>
      {editing ? (
        <EditJson goalId={goalId} k={k} value={data} onDone={() => setEditing(false)} />
      ) : (
        <>
          <SectionBody k={k} data={data} goalId={goalId} editable />
          <TextAction className="mt-1 hidden text-[14px] text-graphite md:inline-flex" onClick={() => setEditing(true)}>Edit</TextAction>
        </>
      )}
    </section>
  );
}

function EmptySection({ k, onTap }: { k: string; onTap?: () => void }) {
  const { title } = sectionTitleFor(k);
  const prompt = EMPTY_PROMPTS[k] ?? 'Nothing here yet.';
  return (
    <section className="anim-fade-in space-y-2">
      <h2 className="font-sans text-[17px] font-semibold leading-6">{title}</h2>
      <TextAction className="text-left" onClick={onTap}>
        <PencilWord>{prompt}</PencilWord>
      </TextAction>
    </section>
  );
}

function GoalHeader({ g, goalId }: { g: Goal; goalId: string }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(g.goal);
  const stub = g.successCriteria.length === 1 && g.successCriteria[0].text === 'define success criteria';
  return (
    <header className="space-y-1">
      {editing ? (
        <RuledInput
          autoFocus
          value={val}
          maxLength={200}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => { setEditing(false); if (val.trim() && val !== g.goal) void applyOp(goalId, (x) => writeSection(x, 'goal', val.trim()) as never); }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      ) : (
        <h1
          data-line="goal"
          className="ink-bleed cursor-text font-serif text-[29px] font-medium leading-[37px] text-ink"
          onDoubleClick={() => { setVal(g.goal); setEditing(true); }}
        >
          {g.goal}
        </h1>
      )}
      {stub ? (
        <PencilWord>Not yet defined — describe the goal in the chat to fill this in.</PencilWord>
      ) : g.deadline ? (
        <PencilWord>{timeLeft(g.deadline)}</PencilWord>
      ) : null}
    </header>
  );
}

/** The small in-page header (brand/mockups/notebook.html's `.topbar`):
 * wordmark and a single menu icon button that opens the chrome's menu leaf. */
function PageHeader() {
  return (
    <div className="-mt-6 mb-7 flex items-center justify-between md:-mt-11">
      <span className="font-serif text-[17px] font-semibold text-ink">gambit</span>
      <TextAction
        aria-label="Menu"
        data-note="Menu"
        className="min-h-11! min-w-11! justify-center text-graphite"
        onClick={() => window.dispatchEvent(new CustomEvent('gambit:menu'))}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M2.5 5.5h15M2.5 10h15M2.5 14.5h15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </TextAction>
    </div>
  );
}

export function useGoalView(goalId: string) {
  return useLiveQuery(async () => {
    const rec = await db.goals.get(goalId);
    return rec ? await readRecord(rec) : null;
  }, [goalId]);
}

// Sections shown by default (with a tappable empty prompt) even before the
// conversation has written to them, matching brand/identity.md §09's
// "three sections by default". Everything else appears only once it has
// content.
const DEFAULT_SECTIONS: (typeof SECTION_KEYS)[number][] = ['plan', 'people', 'riskNotes'];

export function Dashboard({ goalId }: { goalId: string }) {
  const read = useGoalView(goalId);
  if (!read) return <div className="paper p-6"><PencilWord>Loading…</PencilWord></div>;
  if (read.status === 'needs_app_update') return <div className="paper m-4 p-4 text-[17px] leading-[27px] text-accent">This goal was saved by a newer version of Gambit (schema v{read.version}). Update the app to open it. It has not been changed.</div>;
  if (read.status === 'invalid') return <div className="paper m-4 p-4 text-[17px] leading-[27px] text-accent">This goal doesn't match the current schema: {read.error}. Restore it from a backup or fix the JSON.</div>;
  const g = read.data;

  const shownKeys = SECTION_KEYS.filter((k) => !isEmpty(g[k]) || DEFAULT_SECTIONS.includes(k));

  return (
    <MarksProvider goal={g} goalId={goalId}>
      <div
        className="paper relative mx-auto min-h-full max-w-xl rounded-t-[3px] px-8.5 py-6 md:mt-8 md:min-h-[calc(100%-2rem)] md:px-16 md:py-11 md:shadow-[0_1px_1px_var(--lift),0_8px_30px_-8px_var(--lift-far)]"
        style={{ borderLeft: '2px solid var(--margin-rule)' }}
      >
        <MarksLayer />
        <PageHeader />
        <div className="space-y-6">
          <IndexCard goal={g} goalId={goalId} />
          <StickyNotes goal={g} goalId={goalId} />
          <GoalHeader g={g} goalId={goalId} />
          {shownKeys.map((k) =>
            isEmpty(g[k]) ? <EmptySection key={k} k={k} /> : <Section key={k} goalId={goalId} k={k} data={g[k]} />
          )}
          {g.log.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-sans text-[17px] font-semibold leading-6">Log</h2>
              <ul className="space-y-3 text-[17px] leading-[27px]">
                {[...g.log].reverse().slice(0, 30).map((e, i) => (
                  <li key={i}>
                    <PencilWord className="text-[16px]">{formatDate(e.date)}{e.source ? ` · ${e.source}` : ''}</PencilWord>
                    <ul className="list-disc pl-5">{e.notes.map((n, j) => <li key={j}>{n}</li>)}</ul>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </MarksProvider>
  );
}
