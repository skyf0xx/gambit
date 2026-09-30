import type { LinePath } from './changes';
import type { Goal } from './types';

// Stub for the index card / sticky note data derived from a goal (brand/
// identity.md §03 "Slips", §05 "Pencil marks"). A later stage implements
// these against `plan.linesOfOperation[].nextActions`.

export interface SlipItem {
  path: LinePath;
  action: string;
  who?: string;
  when?: string;
}

/** The taped index card: the first `pending` next action, if any. */
export function nextMove(_goal: Goal): SlipItem | null {
  throw new Error('not implemented');
}

/** Sticky notes: next actions with status `proposed`. */
export function proposals(_goal: Goal): SlipItem[] {
  throw new Error('not implemented');
}

/** Keeping a sticky note flips its status to `pending`. */
export async function keep(_goalId: string, _path: LinePath): Promise<void> {
  throw new Error('not implemented');
}

/** Tossing a sticky note flips its status to `dropped`. */
export async function toss(_goalId: string, _path: LinePath): Promise<void> {
  throw new Error('not implemented');
}
