import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { readRecord } from '../lib/goals';
import { PencilWord } from './ui';
import { MarksProvider } from './marks/context';
import { MarksLayer } from './marks/MarksLayer';
import { Tabs } from './tabs/Tabs';
import type { SettingsPageProps } from './Settings';
import type { TabId } from './tabs/tabDefs';

export function useGoalView(goalId: string) {
  return useLiveQuery(async () => {
    const rec = await db.goals.get(goalId);
    return rec ? await readRecord(rec) : null;
  }, [goalId]);
}

export function Dashboard({ goalId, settings, onTabChange }: { goalId: string; settings: SettingsPageProps; onTabChange?: (t: TabId) => void }) {
  const read = useGoalView(goalId);
  if (!read) return <div className="paper p-6"><PencilWord>Loading…</PencilWord></div>;
  if (read.status === 'needs_app_update') return <div className="paper m-4 p-4 text-[17px] leading-[27px] text-accent">This goal was saved by a newer version of Gambit (schema v{read.version}). Update the app to open it. It has not been changed.</div>;
  if (read.status === 'invalid') return <div className="paper m-4 p-4 text-[17px] leading-[27px] text-accent">This goal doesn't match the current schema: {read.error}. Restore it from a backup or fix the JSON.</div>;
  const g = read.data;

  return (
    <MarksProvider goal={g} goalId={goalId}>
      {/* The page sheet itself: position/shadow/border only, no padding —
       * padding lives one level in (below), so the tab strip can be a
       * sibling of the padded content and position itself off *this*
       * element's real outer edge (task: tabs sit outside the notebook, on
       * its far right edge, on mobile too, never inside the page's own
       * padding). `mr-9` on mobile narrows the page (its own width, margin
       * rule and reading width all untouched) to leave a ~36px strip of
       * desk on the right for the divider stack; `md:mr-0` (paired with
       * `mx-auto`) hands width back on desktop where the page is centred
       * and the tabs live in the wider desk gap before the chat leaf
       * instead. */}
      <div
        className="paper relative mx-auto mr-9 flex min-h-full flex-col max-w-xl rounded-t-[3px] md:mr-auto md:mt-8 md:min-h-[calc(100%-2rem)] md:shadow-[0_1px_1px_var(--lift),0_8px_30px_-8px_var(--lift-far)]"
        style={{ borderLeft: '2px solid var(--margin-rule)' }}
      >
        <MarksLayer />
        <Tabs g={g} goalId={goalId} settings={settings} onTabChange={onTabChange} />
      </div>
    </MarksProvider>
  );
}
