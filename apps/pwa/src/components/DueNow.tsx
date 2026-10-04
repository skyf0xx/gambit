import { useEffect, useMemo, useState } from 'react';
import { dueNow } from '@gambit/core';
import type { Goal } from '../lib/types';
import { today } from '../lib/dates';
import { composeInChat } from '../lib/compose';
import { getSkillStore, skillFlows, type SkillStore } from '../lib/skills';
import { TextAction, PencilWord } from './ui';

/** "Check your own risk" → "Help me check my own risk": the todo speaks to the
 * user, the starter speaks as the user. */
const starter = (todo: string) => `Help me ${todo.charAt(0).toLowerCase()}${todo.slice(1)}`.replace(/\byour\b/g, 'my');

/** What the goal says is due now, as pencilled links under the sticky
 * notes. Tapping one puts a starter in the chat composer; it never sends.
 * Nothing due, nothing shown. */
export function DueNow({ goal }: { goal: Goal }) {
  const [store, setStore] = useState<SkillStore | null>(null);
  useEffect(() => { void getSkillStore().then(setStore); }, []);
  const due = useMemo(() => (store ? dueNow(goal, today(), skillFlows(store)) : []), [goal, store]);
  if (due.length === 0) return null;
  return (
    <section aria-label="Suggestions" className="anim-fade-in space-y-0.5">
      <h3><PencilWord className="text-[21px] text-graphite">suggestions</PencilWord></h3>
      <ul>
        {due.map((d) => (
          <li key={d.todo}>
            <TextAction className="text-left underline decoration-graphite/60 decoration-1" onClick={() => composeInChat(starter(d.todo))}>
              <PencilWord className="text-[19px] text-ink">{d.todo}</PencilWord>
            </TextAction>
          </li>
        ))}
      </ul>
    </section>
  );
}
