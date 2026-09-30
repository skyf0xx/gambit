import { useState } from 'react';
import type { Goal } from '../lib/types';
import { nextMove, markDone } from '../lib/slips';
import { TextAction, PencilWord } from './ui';

// The taped index card (brand/identity.md §03/§05): the single next move,
// shown as an index card taped to the top of the page — red header rule,
// blue ruled lines, a slight tilt. Reference: brand/mockups/notebook.css
// (.card, .card::before) and notebook.html / notebook-new.html.
//
// "Not yet" and "Something changed" don't write to the goal themselves —
// they hand off to the composer via a `gambit:compose` CustomEvent, so the
// user's own words (and the `plan` skill acting on them) do the write. The
// composer is expected to listen for `window.addEventListener('gambit:compose', ...)`
// and prefill its input from `event.detail.text`.
export const COMPOSE_EVENT = 'gambit:compose';

function dispatchCompose(text: string) {
  window.dispatchEvent(new CustomEvent(COMPOSE_EVENT, { detail: { text } }));
}

export function IndexCard({ goal, goalId }: { goal: Goal; goalId: string }) {
  const [busy, setBusy] = useState(false);
  const move = nextMove(goal);

  const onDone = async () => {
    if (!move || busy) return;
    setBusy(true);
    try {
      await markDone(goalId, move.path);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="slip motion-safe:transform-[rotate(-0.7deg)] relative -mx-1.5 mb-14 -ml-3.5 rounded-[1px] px-4.5 pb-2.5 pt-4.5"
      style={{
        filter: 'drop-shadow(0 1px 1px var(--lift)) drop-shadow(0 10px 22px -10px var(--lift)) drop-shadow(0 22px 40px -24px var(--lift-far))',
        // Layered on top of (not replacing) the `slip` utility's grain +
        // --surface, so the card reads as paper on the page in both themes
        // instead of falling through to the page's own --bg.
        backgroundImage:
          'linear-gradient(var(--card-head), var(--card-head)), repeating-linear-gradient(transparent 0 27px, var(--card-rule) 27px 28px), var(--grain)',
        backgroundColor: 'var(--surface)',
        backgroundPosition: '0 44px, 0 44px, 0 0',
        backgroundSize: '100% 1px, 100% calc(100% - 54px), auto',
        backgroundRepeat: 'no-repeat, no-repeat, repeat',
      }}
    >
      <span
        aria-hidden="true"
        className="absolute -top-2.75 left-1/2 h-6 w-23 -ml-11.5 motion-safe:transform-[rotate(2.5deg)] bg-tape"
        style={{ clipPath: 'polygon(3% 8%, 0 25%, 4% 50%, 1% 78%, 4% 100%, 97% 94%, 100% 70%, 96% 45%, 100% 20%, 97% 0)' }}
      />

      <div className="h-6.5 text-[14px] leading-5 text-graphite">Your next move</div>

      {move ? (
        <>
          <p data-line={move.path} className="text-[20px] font-medium leading-7 text-ink">
            {move.action}
          </p>
          {(move.when || move.who) && (
            <p className="leading-7">
              <PencilWord>{move.when ?? move.who}</PencilWord>
            </p>
          )}
          <div className="mt-1 flex gap-4">
            <TextAction disabled={busy} onClick={() => void onDone()}>
              Done
            </TextAction>
            <TextAction
              disabled={busy}
              onClick={() => dispatchCompose(`Not yet: ${move.action} — `)}
            >
              Not yet
            </TextAction>
            <TextAction
              disabled={busy}
              onClick={() => dispatchCompose('Something changed: ')}
            >
              Something changed
            </TextAction>
          </div>
        </>
      ) : (
        <>
          <p className="text-[20px] font-medium leading-7 text-ink">What&rsquo;s your next move?</p>
          <p className="leading-7">
            <PencilWord>nothing due yet</PencilWord>
          </p>
        </>
      )}
    </div>
  );
}
