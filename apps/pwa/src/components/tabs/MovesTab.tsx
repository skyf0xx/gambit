import type { Goal } from '../../lib/types';
import { IndexCard } from '../IndexCard';
import { PostureLine } from '../PostureLine';
import { StickyNotes } from '../StickyNotes';
import { Section, EmptySection, isEmptySection } from './SectionRenderer';

const DEFAULT_SECTIONS = ['plan'] as const;

/** Moves: the default landing tab (task spec) — the posture line, the
 * index card, sticky notes, and the plan ("all moves") with its focus. The goal title,
 * deadline and "what done looks like" live on the Goal tab, and the log
 * on the Logs tab — Moves is about doing, not defining. */
export function MovesTab({ g, goalId }: { g: Goal; goalId: string }) {
  const showPlan = !isEmptySection(g.plan) || DEFAULT_SECTIONS.includes('plan');
  return (
    <>
      <PostureLine goal={g} />
      <IndexCard goal={g} goalId={goalId} />
      <StickyNotes goal={g} goalId={goalId} />
      {showPlan && (isEmptySection(g.plan) ? <EmptySection k="plan" /> : <Section goalId={goalId} k="plan" data={g.plan} />)}
    </>
  );
}
