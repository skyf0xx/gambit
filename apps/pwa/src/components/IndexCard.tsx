import { useState, type MouseEvent } from 'react';
import type { Goal } from '../lib/types';
import { nextMove, markDone, isSelf } from '../lib/slips';
import { byDate, proseDates } from '../lib/dates';
import { TextAction, PencilWord } from './ui';
import { HandBox } from './paper/HandBox';
import { FreshTag } from './paper/FreshTag';

// The taped index card (brand/identity.md §03/§05): the single next move,
// shown as an index card taped to the top of the page — red header rule,
// blue ruled lines, a slight tilt. Reference: brand/mockups/notebook.css
// (.card, .card::before) and notebook.html / notebook-new.html.
//
// The card's one action is its checkbox: ticking it marks the move done,
// the same way a tick box does on every other line of the page. Anything
// else about the move ("not yet", "something changed") is said in the chat.

const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// 220ms peel / 180ms card-out, or 0 under reduced motion — the shared exit
// timing other builders' animation classes use (see AGENTS.md task notes).
const CARD_OUT_MS = () => (reducedMotion() ? 0 : 180);
// How long the tick gets to land in its box before the card lifts away.
const TICK_MS = () => (reducedMotion() ? 0 : 260);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function IndexCard({ goal, goalId }: { goal: Goal; goalId: string }) {
  const [busy, setBusy] = useState(false);
  const [ticked, setTicked] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const move = nextMove(goal);

  const onDone = async () => {
    if (!move || busy) return;
    setBusy(true);
    setTicked(true);
    try {
      await wait(TICK_MS());
      setLeaving(true);
      await wait(CARD_OUT_MS());
      await markDone(goalId, move.path);
    } finally {
      setBusy(false);
      setTicked(false);
      setLeaving(false);
    }
  };

  // The move's text ticks the box too, as a row does in the plan; it
  // stands aside for the box's own click and for a drag that selected text.
  const onRowClick = (e: MouseEvent) => {
    if ((e.target as Element).closest('button, a')) return;
    if (window.getSelection()?.toString()) return;
    void onDone();
  };

  return (
    <div
      className={`slip motion-safe:transform-[rotate(-0.7deg)] relative -mx-1.5 mb-14 -ml-3.5 rounded-[1px] px-4.5 pb-2.5 pt-4.5 ${leaving ? 'anim-card-out' : 'anim-card-in'}`}
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

      <div className="h-6.5 text-[14px] leading-5 text-graphite">Your top move</div>

      {move ? (
        <div className="flex cursor-pointer items-start" onClick={onRowClick}>
          <TextAction title="Mark done" aria-label="Mark done" className="-ml-3 w-11 shrink-0 justify-center" onClick={() => void onDone()}>
            {/* The 44px tap area centres the box 8px below the centre of the
             * 28px first text line beside it; lift it back onto that line. */}
            <HandBox seed={move.path} checked={ticked} className="-top-2" />
          </TextAction>
          <div className="min-w-0 flex-1">
            <p data-line={move.path} className="text-[20px] font-medium leading-7 text-ink">
              {proseDates(move.action)}
              <FreshTag path={move.path} />
            </p>
            {move.detail && <p className="mt-0.5 text-[14px] leading-5 text-graphite">{proseDates(move.detail)}</p>}
            {(move.when || !isSelf(move.who)) && (
              <p className="leading-7">
                <PencilWord>{move.when ? byDate(move.when) : move.who}</PencilWord>
              </p>
            )}
          </div>
        </div>
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
