import type { Goal } from '../../lib/types';
import { IndexCard } from '../IndexCard';
import { PostureLine } from '../PostureLine';
import { StickyNotes } from '../StickyNotes';
import { DueNow } from '../DueNow';
import { Section, EmptySection, isEmptySection } from './SectionRenderer';

const DEFAULT_SECTIONS = ['plan'] as const;

/** Moves: the default landing tab (task spec) — the index card, sticky
 * notes, and the plan (posture beside its label) ("all moves") with its focus. The goal title,
 * deadline and "what done looks like" live on the Goal tab, and the log
 * on the Logs tab — Moves is about doing, not defining. */
export function MovesTab({ g, goalId }: { g: Goal; goalId: string }) {
  const showPlan = !isEmptySection(g.plan) || DEFAULT_SECTIONS.includes('plan');
  return (
    <>
      <IndexCard goal={g} goalId={goalId} />
      <StickyNotes goal={g} goalId={goalId} />
      <DueNow goal={g} />
      {showPlan && (isEmptySection(g.plan) ? <EmptySection k="plan" /> : <Section goalId={goalId} k="plan" data={g.plan} aside={<PostureLine goal={g} />} />)}
    </>
  );
}
