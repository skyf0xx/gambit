import { useState } from 'react';
import type { Goal } from '../lib/types';
import { proposals, keep, toss } from '../lib/slips';
import { byDate, proseDates } from '../lib/dates';
import { TextAction, PencilWord } from './ui';
import type { SlipItem } from '../lib/slips';
import { FreshTag } from './paper/FreshTag';

// Sticky notes (brand/identity.md §03/§05): one `--note` slip per
// `proposed` next action, with a folded corner and a slight tilt. Reference:
// brand/mockups/notebook.css (.sticky) and notebook.html.

const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const PEEL_MS = () => (reducedMotion() ? 0 : 220);

function Note({ goalId, item }: { goalId: string; item: SlipItem }) {
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState<'keep' | 'toss' | null>(null);
  const [revealed, setRevealed] = useState(false);

  const onKeep = async () => {
    if (busy) return;
    setBusy(true);
    setLeaving('keep');
    try {
      // A quick lift-and-settle (anim-press-like beat) before the note
      // becomes an ordinary ink line; no separate exit timing needed since
      // it isn't leaving the page, just changing status.
      await new Promise((r) => setTimeout(r, reducedMotion() ? 0 : 160));
      await keep(goalId, item.path);
    } finally {
      setBusy(false);
      setLeaving(null);
    }
  };

  const onToss = async () => {
    if (busy) return;
    setBusy(true);
    setLeaving('toss');
    try {
      await new Promise((r) => setTimeout(r, PEEL_MS()));
      await toss(goalId, item.path);
    } finally {
      setBusy(false);
      setLeaving(null);
    }
  };

  const onNoteClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setRevealed((r) => !r);
  };

  return (
    <aside
      aria-label="Suggestion from Gambit"
      onClick={onNoteClick}
      className={`slip group/note motion-safe:transform-[rotate(1.6deg)] relative ml-auto mt-9 w-[82%] bg-note px-4 pb-3 pt-4 ${leaving === 'toss' ? 'anim-peel' : leaving === 'keep' ? 'anim-press' : ''}`}
      style={{
        filter: 'drop-shadow(0 1px 1px var(--lift)) drop-shadow(0 12px 18px -12px var(--lift)) drop-shadow(6px 18px 26px -18px var(--lift-far))',
        // Inline so the note's yellow wins over the `slip` utility's surface colour.
        backgroundColor: 'var(--note)',
        backgroundImage: 'linear-gradient(135deg, transparent 0 88%, var(--note-edge) 88% 100%), var(--grain)',
        backgroundPosition: '100% 100%, 0 0',
        backgroundSize: '26px 26px, auto',
        backgroundRepeat: 'no-repeat, repeat',
        clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 26px), calc(100% - 26px) 100%, 0 100%)',
      }}
    >
      <div className="mb-1 text-[13px] leading-4.5 text-graphite">Gambit suggests</div>
      <p data-line={item.path} className="text-[17px] leading-6.25 text-ink">
        {proseDates(item.action)}
        <FreshTag path={item.path} />
        <span className="sr-only"> (suggestion)</span>
      </p>
      {/* The why: what makes "keep or toss" an informed choice. */}
      {item.detail && <p className="mt-1 text-[14px] leading-5 text-graphite">{proseDates(item.detail)}</p>}
      {(item.when || item.who) && (
        <p className="leading-6.25">
          <PencilWord>{item.when ? byDate(item.when) : item.who}</PencilWord>
        </p>
      )}
      <div
        className={`mt-2.5 flex gap-4 transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/note:opacity-100 [@media(hover:hover)]:group-focus-within/note:opacity-100 ${revealed ? 'opacity-100' : 'opacity-0 [@media(hover:none)]:pointer-events-none'}`}
      >
        <TextAction disabled={busy} onClick={() => void onKeep()}>
          Keep it
        </TextAction>
        <TextAction disabled={busy} onClick={() => void onToss()}>
          Toss
        </TextAction>
      </div>
      {!revealed && (
        <p aria-hidden="true" className="hand mt-0.5 text-[13px] opacity-60 [@media(hover:hover)]:hidden">
          tap for options
        </p>
      )}
    </aside>
  );
}

export function StickyNotes({ goal, goalId }: { goal: Goal; goalId: string }) {
  const items = proposals(goal);
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 sm:flex-col">
      {items.map((item) => (
        <Note key={item.path} goalId={goalId} item={item} />
      ))}
    </div>
  );
}
