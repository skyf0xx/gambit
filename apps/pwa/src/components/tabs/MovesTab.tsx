import type { Goal } from '../../lib/types';
import { PencilWord } from '../ui';
import { formatDate } from '../Sections';
import { IndexCard } from '../IndexCard';
import { StickyNotes } from '../StickyNotes';
import { Section, EmptySection, isEmptySection } from './SectionRenderer';

const DEFAULT_SECTIONS = ['plan'] as const;

/** Moves: the default landing tab (task spec) — the index card, sticky
 * notes, the plan ("future moves") with its focus, and a short "Lately"
 * log tail (last 5 entries only — the full log used to run to the bottom
 * of a single long page; the task's whole reason for tabs is trimming
 * that). The goal title, deadline and "what done looks like" moved to the
 * Goal tab (owner correction) — Moves is about doing, not defining. */
export function MovesTab({ g, goalId }: { g: Goal; goalId: string }) {
  const showPlan = !isEmptySection(g.plan) || DEFAULT_SECTIONS.includes('plan');
  return (
    <>
      <IndexCard goal={g} goalId={goalId} />
      <StickyNotes goal={g} goalId={goalId} />
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
