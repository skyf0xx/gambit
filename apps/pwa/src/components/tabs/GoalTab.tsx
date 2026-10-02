import { useState } from 'react';
import { isStub, writeSection } from '@gambit/core';
import { applyOp } from '../../lib/goals';
import type { Goal } from '../../lib/types';
import { RuledInput, PencilWord } from '../ui';
import { timeLeft, proseDates } from '../../lib/dates';
import { Section, isEmptySection } from './SectionRenderer';
import { FreshTag } from '../paper/FreshTag';
import { KeepNotebook } from '../paper/KeepNotebook';

const norm = (s: string) => s.trim().toLowerCase();

function GoalHeader({ g, goalId }: { g: Goal; goalId: string }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(g.goal);
  const stub = isStub(g);
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
          <FreshTag path="goal" />
        </h1>
      )}
      {stub ? (
        <PencilWord>Not set yet.</PencilWord>
      ) : g.deadline ? (
        <PencilWord>{timeLeft(g.deadline)}<FreshTag path="deadline" /></PencilWord>
      ) : null}
    </header>
  );
}

/** Sub-goals — a condition on the aim itself (not a success criterion),
 * listed straight under the title with no heading of their own, since they
 * read as the rest of the goal sentence. Reads from `goal.subGoals` (packages/core/src/schema.mjs,
 * merged from master: `z.array(subGoal).max(5).optional()`). Renders nothing
 * when absent/empty, same as any other empty-hideable section. */
function SubGoals({ subGoals }: { subGoals: string[] }) {
  if (subGoals.length === 0) return null;
  return (
    <section className="anim-fade-in space-y-3">
      <ul className="list-disc space-y-1 pl-5 text-[17px] leading-[27px]">
        {subGoals.map((s, i) => (
          <li key={i} data-line={`subGoals.${i}`}>{proseDates(s)}</li>
        ))}
      </ul>
    </section>
  );
}

/** Goal: the goal's own identity page — title, deadline, the parts of the
 * goal (subGoals), and what done looks like (successCriteria). It reads
 * top down from the aim to its measure: the parts are the rest of the goal
 * sentence, so they sit straight under the title, ahead of the criteria.
 * Split out of Moves (owner correction) so Moves stays about doing, not
 * defining. How each criterion is going (criteriaStatus, scored by `eval`)
 * is read onto the criterion itself rather than listed a second time: a
 * ring, a tick once met, or the alarm word when it's slipping. Only a
 * scored line that matches no criterion falls through to its own
 * Progress section. */
export function GoalTab({ g, goalId }: { g: Goal; goalId: string }) {
  const stub = isStub(g);
  const scored = new Map(g.criteriaStatus.map((c) => [norm(c.text), c]));
  const criteria = g.successCriteria.map((c) => {
    const s = scored.get(norm(c.text));
    return s ? { ...c, progress: s.status, progressDetail: s.detail } : c;
  });
  const known = new Set(g.successCriteria.map((c) => norm(c.text)));
  const unmatched = g.criteriaStatus.filter((c) => !known.has(norm(c.text)));
  return (
    <div className="space-y-8">
      <GoalHeader g={g} goalId={goalId} />
      {!stub && <KeepNotebook />}
      <SubGoals subGoals={g.subGoals ?? []} />
      {isEmptySection(g.successCriteria) ? null : <Section goalId={goalId} k="successCriteria" data={criteria} />}
      {unmatched.length === 0 ? null : <Section goalId={goalId} k="criteriaStatus" data={unmatched} />}
    </div>
  );
}
