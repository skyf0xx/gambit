import { milestoneReached } from '@gambit/core';
import type { Goal } from './types';

type Plan = NonNullable<Goal['plan']>;
type Line = Plan['linesOfOperation'][number];
type Task = Line['nextActions'][number];

// A plan line in stretches, one per milestone, plus a last stretch after
// the last one. The Moves page draws each stretch above its milestone's
// rule; Doodles stacks them up toward the goal. Both read it from here so
// they never disagree about where a task sits.

export interface LineStretches {
  steps: { st: Line['criticalPath'][number]; path: string; reached: boolean }[];
  /** The first milestone not yet reached, or -1 when all are. */
  current: number;
  /** The stretch the line is heading through: `current`, else the last. */
  heading: number;
  /** A task's stretch: the first milestone listing it in `after`, else `heading`. */
  stretchOf: (a: Pick<Task, 'id'>) => number;
  /** Whether any milestone lists the task. */
  linked: (a: Pick<Task, 'id'>) => boolean;
}

export function lineStretches(line: Line, li: number, plan: Plan | undefined): LineStretches {
  const base = `plan.linesOfOperation.${li}`;
  const steps = line.criticalPath.map((st, i) => ({ st, path: `${base}.criticalPath.${i}`, reached: milestoneReached(st, plan) }));
  const current = steps.findIndex((m) => !m.reached);
  const heading = current >= 0 ? current : steps.length;
  const listing = (a: Pick<Task, 'id'>) => (a.id ? steps.findIndex(({ st }) => st.after?.includes(a.id!)) : -1);
  return {
    steps,
    current,
    heading,
    stretchOf: (a) => { const k = listing(a); return k >= 0 ? k : heading; },
    linked: (a) => listing(a) >= 0,
  };
}
