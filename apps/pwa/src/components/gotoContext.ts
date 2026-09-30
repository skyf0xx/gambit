import { createContext, useContext } from 'react';

// The latest `gambit:goto` target, handed down from Tabs.tsx so content
// that keeps part of itself tucked away (the plan's stacked lines of
// operation) can bring the target line's sheet to the front — including
// when it only mounts as a result of that same goto's tab switch, too late
// to have heard the event itself. `seq` makes a repeat goto to the same
// path a new value. Cleared when the user changes tab by hand.
export interface GotoTarget {
  path: string;
  seq: number;
}

export const GotoContext = createContext<GotoTarget | null>(null);

export function useGoto(): GotoTarget | null {
  return useContext(GotoContext);
}
