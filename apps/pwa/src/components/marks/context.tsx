import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { LinePath } from '../../lib/changes';
import { deriveMarks, type DerivedMarks } from '../../lib/marks/derive';
import type { Mark } from '../../lib/marks/types';
import type { Goal } from '../../lib/types';
import { useSession } from '../../lib/session';

// Goal-driven marks system (brand/identity.md §05 "Pencil marks"). Derives
// every line's mark once per goal/session change and hands each line its own
// slice via `useLineMark`; MarksLayer reads the same derived map to draw the
// actual strokes against the live DOM layout.

interface MarksContextValue {
  goal: Goal;
  goalId: string;
  derived: DerivedMarks;
}

const MarksContext = createContext<MarksContextValue | undefined>(undefined);

export function MarksProvider({ goal, goalId, children }: { goal: Goal; goalId: string; children: ReactNode }) {
  const session = useSession();
  const derived = useMemo(
    () => deriveMarks(goal, goalId, session),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goal, goalId, session.turn, session.dropped],
  );
  const value = useMemo(() => ({ goal, goalId, derived }), [goal, goalId, derived]);
  return <MarksContext.Provider value={value}>{children}</MarksContext.Provider>;
}

/** Read-only access to the current derivation, for MarksLayer. */
export function useMarksContext(): MarksContextValue | undefined {
  return useContext(MarksContext);
}

export function useLineMark(path: LinePath): Partial<Mark> {
  const ctx = useContext(MarksContext);
  if (!ctx) return {};
  return ctx.derived.byPath.get(path) ?? {};
}
