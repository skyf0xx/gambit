import { useState } from 'react';
import { writeSection } from '@gambit/core';
import { applyOp } from '../../lib/goals';
import type { Goal } from '../../lib/types';
import { RuledInput, PencilWord } from '../ui';
import { formatDate } from '../Sections';
import { IndexCard } from '../IndexCard';
import { StickyNotes } from '../StickyNotes';
import { timeLeft } from '../../lib/dates';
import { Section, EmptySection, isEmptySection } from './SectionRenderer';

const DEFAULT_SECTIONS = ['plan'] as const;

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
 * the wordmark only. The menu action used to live here as an icon button;
 * it's now the "Menu" tab pinned to the bottom of the divider stack
 * (DividerTabs.tsx), so there's only the one menu control on the page. */
function PageHeader() {
  return (
    <div className="-mt-6 mb-7 flex items-center justify-between md:-mt-11">
      <span className="font-serif text-[17px] font-semibold text-ink">gambit</span>
    </div>
  );
}

/** Moves: the default landing tab (task spec) — the in-page header, the
 * index card, sticky notes, goal title/deadline, successCriteria ("what
 * done looks like"), the plan ("future moves"), and a short "Lately" log
 * tail (last 5 entries only — the full log used to run to the bottom of a
 * single long page; the task's whole reason for tabs is trimming that). */
export function MovesTab({ g, goalId }: { g: Goal; goalId: string }) {
  const showPlan = !isEmptySection(g.plan) || DEFAULT_SECTIONS.includes('plan');
  return (
    <>
      <PageHeader />
      <IndexCard goal={g} goalId={goalId} />
      <StickyNotes goal={g} goalId={goalId} />
      <GoalHeader g={g} goalId={goalId} />
      {isEmptySection(g.successCriteria) ? null : <Section goalId={goalId} k="successCriteria" data={g.successCriteria} />}
      {showPlan && (isEmptySection(g.plan) ? <EmptySection k="plan" /> : <Section goalId={goalId} k="plan" data={g.plan} />)}
      {isEmptySection(g.criteriaStatus) ? null : <Section goalId={goalId} k="criteriaStatus" data={g.criteriaStatus} />}
      {g.log.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-sans text-[17px] font-semibold leading-6">Lately</h2>
          <ul className="space-y-3 text-[17px] leading-[27px]">
            {[...g.log].reverse().slice(0, 5).map((e, i) => (
              <li key={i}>
                <PencilWord className="text-[16px]">{formatDate(e.date)}{e.source ? ` · ${e.source}` : ''}</PencilWord>
                <ul className="list-disc pl-5">{e.notes.map((n, j) => <li key={j}>{n}</li>)}</ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
