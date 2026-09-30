import type { Goal } from '../../lib/types';
import { SectionList } from './SectionRenderer';

export function ChoicesTab({ g, goalId }: { g: Goal; goalId: string }) {
  return <SectionList goalId={goalId} g={g} keys={['decisions', 'experiments', 'forecasts', 'systemsNotes']} />;
}
