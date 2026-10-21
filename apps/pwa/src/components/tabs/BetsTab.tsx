import type { Goal } from '../../lib/types';
import { daysUntil } from '../../lib/dates';
import { SectionList } from './SectionRenderer';
import { t } from '../../lib/i18n';

/** What on this tab is waiting on the user: open questions, tests not yet
 * run, and predictions whose date has come. Empty when nothing is. */
function waitingOn(g: Goal): string[] {
  const questions = (g.decisions ?? []).filter((d) => d.status === 'open').length;
  const asks = (g.intel ?? []).filter((q) => q.status === 'open').length;
  const tests = (g.experiments ?? []).filter((e) => !e.done).length;
  const bets = (g.forecasts ?? []).filter((f) => { const n = f.resolved ? null : daysUntil(f.resolvesBy); return n !== null && n <= 0; }).length;
  return [
    questions && t('moves.waitQuestions', { count: questions }),
    asks && t('moves.waitIntel', { count: asks }),
    tests && t('moves.waitTests', { count: tests }),
    bets && t('moves.waitBets', { count: bets }),
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
      {waiting.length > 0 && <p className="text-[17px] font-medium leading-[27px] text-ink">{t('moves.waitingOnYou', { list: waiting.join(', ') })}</p>}
      <SectionList goalId={goalId} g={g} keys={['decisions', 'courses', 'intel', 'experiments', 'forecasts', 'systemsNotes']} />
    </>
  );
}
