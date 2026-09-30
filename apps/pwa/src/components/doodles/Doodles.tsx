import type { Goal } from '../../lib/types';

// The Doodles tab: the whole plan sketched in pencil as a map. Tapping a node
// dispatches `gambit:goto` ({ detail: { path } }) so the page can switch to
// the tab holding that line and bring it into view.
export function Doodles(_props: { goal: Goal; goalId: string }) {
  return null;
}
