import type { Goal } from '../../lib/types';
import { SectionList } from './SectionRenderer';

export function RisksTab({ g, goalId }: { g: Goal; goalId: string }) {
  return <SectionList goalId={goalId} g={g} keys={['riskNotes', 'exposure']} />;
}
