import { REVIEW_DAYS } from '@gambit/core';
import type { Goal } from '../lib/types';
import { daysUntil } from '../lib/dates';
import { PencilWord } from './ui';

/** How hard the effort is pushing right now (strategy's `posture`), read in
 * one line at the top of Moves: it frames how to take the moves below it.
 * The pencil note says what the current level means, what would change it,
 * and how long since it was last checked once that's past strategy's
 * review window. Nothing shows while no posture is set. */
export function PostureLine({ goal }: { goal: Goal }) {
  const p = goal.posture;
  if (!p) return null;
  const meaning = p.levels.find((l) => l.level === p.current.level)?.meaning;
  const age = -(daysUntil(p.lastReviewed) ?? 0);
  const note = [
    meaning ?? `Level ${p.current.level} of ${p.levels.length}`,
    p.triggers.length > 0 && `Changes if: ${p.triggers.join('; ')}`,
    age >= REVIEW_DAYS.strategy && `last checked ${age} days ago`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <p data-line="posture" className="mb-8 text-[14px] leading-5 text-graphite">
      Posture:{' '}
      <span tabIndex={0} data-note={note} className="cursor-help">
        <PencilWord className="text-[18px] text-ink">{p.current.label}</PencilWord>
      </span>
    </p>
  );
}
