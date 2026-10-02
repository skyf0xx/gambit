import type { GoalRecord } from '../../lib/db';
import { GambitAvatar } from '../paper/GambitAvatar';
import { TextAction } from '../ui';

export interface CoverProps {
  goals?: GoalRecord[];
  activeId?: string;
  onOpenGoal: (id: string) => void;
  onNewGoal?: () => void;
}

/** The front cover: first in the tab stack, dark brown, Gambit's portrait
 * and every goal on this device. Picking a goal opens it on Moves. Fills the
 * whole page sheet (it grows to the sheet's height and over its margin
 * rule), so it reads as the outside of the notebook, not a page in it. */
export function CoverTab({ goals = [], activeId, onOpenGoal, onNewGoal }: CoverProps) {
  return (
    <div
      role="tabpanel"
      id="tabpanel-cover"
      aria-labelledby="tab-cover"
      tabIndex={0}
      className="cover-sheet relative z-20 flex-1 rounded-t-[3px] px-8.5 pt-16 pb-28 md:px-16 md:pt-20 md:pb-16"
    >
      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
        <GambitAvatar size={112} />
        <p className="mt-5 font-serif text-[28px] font-semibold leading-[34px] tracking-tight">gambit</p>
        <ul className="mt-12 w-full space-y-1" aria-label="Goals">
          {goals.map((g) => {
            const on = g.id === activeId;
            return (
              <li key={g.id}>
                <TextAction
                  circle={false}
                  aria-current={on || undefined}
                  onClick={() => onOpenGoal(g.id)}
                  className={`cover-goal w-full justify-center py-2 text-center font-serif text-[19px] leading-[27px] ${on ? 'font-semibold' : 'cover-goal-off'}`}
                >
                  {g.title}
                </TextAction>
              </li>
            );
          })}
        </ul>
        {onNewGoal && (
          <TextAction circle={false} onClick={onNewGoal} className="cover-goal cover-goal-off mt-8 underline">
            New goal
          </TextAction>
        )}
      </div>
      <style>{`
        .cover-sheet {
          background: var(--cover);
          color: var(--cover-ink);
          /* Covers the page's margin rule too. */
          margin-left: -2px;
        }
        .cover-sheet .cover-goal { color: var(--cover-ink); }
        .cover-sheet .cover-goal-off { color: var(--cover-graphite); }
        .cover-sheet .cover-goal-off:hover,
        .cover-sheet .cover-goal-off:focus-visible { color: var(--cover-ink); }
      `}</style>
    </div>
  );
}
