import { useState } from 'react';
import { writeSection } from '@gambit/core';
import { applyOp } from '../../lib/goals';
import type { Goal } from '../../lib/types';
import { RuledInput, PencilWord } from '../ui';
import { timeLeft } from '../../lib/dates';
import { Section, isEmptySection } from './SectionRenderer';

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

/** "Parts of this goal" — sub-goals, a condition on the aim itself (not a
 * success criterion). Reads from `goal.subGoals` (packages/core/src/schema.mjs,
 * merged from master: `z.array(subGoal).max(5).optional()`). Renders nothing
 * when absent/empty, same as any other empty-hideable section. */
function SubGoals({ subGoals }: { subGoals: string[] }) {
  if (subGoals.length === 0) return null;
  return (
    <section className="anim-fade-in space-y-2">
      <h2 className="font-sans text-[17px] font-semibold leading-6">Parts of this goal</h2>
      <ul className="list-disc space-y-1 pl-5 text-[17px] leading-[27px]">
        {subGoals.map((s, i) => (
          <li key={i} data-line={`subGoals.${i}`}>{s}</li>
        ))}
      </ul>
    </section>
  );
}

/** Goal: the goal's own identity page — title, deadline, what done looks
 * like (successCriteria), and the parts of the goal (subGoals). Split out
 * of Moves (owner correction) so Moves stays about doing, not defining. */
export function GoalTab({ g, goalId }: { g: Goal; goalId: string }) {
  return (
    <>
      <GoalHeader g={g} goalId={goalId} />
      {isEmptySection(g.successCriteria) ? null : <Section goalId={goalId} k="successCriteria" data={g.successCriteria} />}
      <SubGoals subGoals={g.subGoals ?? []} />
    </>
  );
}
