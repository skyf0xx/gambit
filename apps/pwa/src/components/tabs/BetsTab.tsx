import type { Goal } from '../../lib/types';
import { daysUntil } from '../../lib/dates';
import { SectionList } from './SectionRenderer';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What on this tab is waiting on the user: open questions, tests not yet
 * run, and predictions whose date has come. Empty when nothing is. */
function waitingOn(g: Goal): string[] {
  const questions = (g.decisions ?? []).filter((d) => d.status === 'open').length;
  const tests = (g.experiments ?? []).filter((e) => !e.done).length;
  const bets = (g.forecasts ?? []).filter((f) => { const n = f.resolved ? null : daysUntil(f.resolvesBy); return n !== null && n <= 0; }).length;
  return [
    questions && plural(questions, 'question to settle', 'questions to settle'),
    tests && plural(tests, 'test to run', 'tests to run'),
    bets && plural(bets, 'prediction to check', 'predictions to check'),
  ].filter((s): s is string => !!s);
}

/** Bets: calls made, and the guesses still being checked. Each item settles
 * when the user reports back in the chat — its own "Tell me how it went" /
 * "Work it through" link hands it over — so the tab opens only by naming
 * what's waiting. */
export function BetsTab({ g, goalId }: { g: Goal; goalId: string }) {
  const waiting = waitingOn(g);
  return (
    <>
      {waiting.length > 0 && <p className="text-[17px] font-medium leading-[27px] text-ink">Waiting on you: {waiting.join(', ')}.</p>}
      <SectionList goalId={goalId} g={g} keys={['decisions', 'experiments', 'forecasts', 'systemsNotes']} />
    </>
  );
}
