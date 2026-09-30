import { createContext, useContext, type ReactNode } from 'react';
import type { LinePath } from '../../lib/changes';
import type { Mark } from '../../lib/marks/types';
import type { Goal } from '../../lib/types';

// Stub for the goal-driven marks system (brand/identity.md §05 "Pencil
// marks"). A later stage fills this in to derive each line's mark from the
// goal record; for now every line reports no mark.

const MarksContext = createContext<Goal | undefined>(undefined);

export function MarksProvider({ goal, goalId: _goalId, children }: { goal: Goal; goalId: string; children: ReactNode }) {
  return <MarksContext.Provider value={goal}>{children}</MarksContext.Provider>;
}

export function useLineMark(_path: LinePath): Partial<Mark> {
  useContext(MarksContext);
  return {};
}
