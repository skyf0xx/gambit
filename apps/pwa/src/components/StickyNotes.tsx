import { useState } from 'react';
import type { Goal } from '../lib/types';
import { proposals, keep, toss } from '../lib/slips';
import { TextAction, PencilWord } from './ui';
import type { SlipItem } from '../lib/slips';

// Sticky notes (brand/identity.md §03/§05): one `--note` slip per
// `proposed` next action, with a folded corner and a slight tilt. Reference:
// brand/mockups/notebook.css (.sticky) and notebook.html.

function Note({ goalId, item }: { goalId: string; item: SlipItem }) {
  const [busy, setBusy] = useState(false);

  const onKeep = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await keep(goalId, item.path);
    } finally {
      setBusy(false);
    }
  };

  const onToss = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await toss(goalId, item.path);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside
      aria-label="Suggestion from Gambit"
      className="slip motion-safe:transform-[rotate(1.6deg)] relative ml-auto mt-9 w-[82%] bg-note px-4 pb-3 pt-4"
      style={{
        filter: 'drop-shadow(0 1px 1px var(--lift)) drop-shadow(0 12px 18px -12px var(--lift)) drop-shadow(6px 18px 26px -18px var(--lift-far))',
        backgroundImage: 'linear-gradient(135deg, transparent 0 88%, var(--note-edge) 88% 100%)',
        backgroundPosition: '100% 100%',
        backgroundSize: '26px 26px',
        backgroundRepeat: 'no-repeat',
        clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 26px), calc(100% - 26px) 100%, 0 100%)',
      }}
    >
      <div className="mb-1 text-[13px] leading-4.5 text-graphite">Gambit suggests</div>
      <p data-line={item.path} className="text-[17px] leading-6.25 text-ink">
        {item.action}
        <span className="sr-only"> (suggestion)</span>
      </p>
      {(item.when || item.who) && (
        <p className="leading-6.25">
          <PencilWord>{item.when ?? item.who}</PencilWord>
        </p>
      )}
      <div className="mt-2.5 flex gap-4">
        <TextAction disabled={busy} onClick={() => void onKeep()}>
          Keep it
        </TextAction>
        <TextAction disabled={busy} onClick={() => void onToss()}>
          Toss
        </TextAction>
      </div>
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
