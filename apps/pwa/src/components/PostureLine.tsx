import { REVIEW_DAYS } from '@gambit/core';
import type { Goal } from '../lib/types';
import { daysUntil } from '../lib/dates';
import { t } from '../lib/i18n';

/** How hard the effort is pushing right now (strategy's `posture`), read as
 * the end of the "All moves" label — "All moves - quiet posture" — since it
 * frames how to take the moves under it. The pencil note says what the
 * current level means, what would change it, and how long since it was last
 * checked once that's past strategy's review window. Nothing shows while no
 * posture is set. */
export function PostureLine({ goal }: { goal: Goal }) {
  const p = goal.posture;
  if (!p) return null;
  const meaning = p.levels.find((l) => l.level === p.current.level)?.meaning;
  const age = -(daysUntil(p.lastReviewed) ?? 0);
  const note = [
    meaning ?? t('moves.postureLevel', { level: p.current.level, total: p.levels.length }),
    p.triggers.length > 0 && [t('moves.postureChangesIf'), ...p.triggers.map((trigger) => `– ${trigger}`)].join('\n'),
    age >= REVIEW_DAYS.strategy && t('moves.postureLastChecked', { days: age }),
  ]
    .filter(Boolean)
    .join('\n\n');
  return (
    <span data-line="posture" className="text-[14px] leading-5 text-graphite">
      {' - '}
      <span tabIndex={0} data-note={note} className="italic">
        {t('moves.postureName', { label: p.current.label.toLowerCase() })}
      </span>
    </span>
  );
}
