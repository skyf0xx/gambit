import { useEffect, useMemo, useState } from 'react';
import { dueNow } from '@gambit/core';
import type { Goal } from '../lib/types';
import { today } from '../lib/dates';
import { composeInChat } from '../lib/compose';
import { getSkillStore, skillFlows, type SkillStore } from '../lib/skills';
import { TextAction, PencilWord } from './ui';

const sentence = (s: string) => s.trim().charAt(0).toUpperCase() + s.trim().slice(1);

/** What the goal says is due now, as a quiet pencilled list under the
 * sticky notes. Tapping a line puts a starter in the chat composer; it
 * never sends. Nothing due, nothing shown. */
export function DueNow({ goal }: { goal: Goal }) {
  const [store, setStore] = useState<SkillStore | null>(null);
  useEffect(() => { void getSkillStore().then(setStore); }, []);
  const due = useMemo(() => (store ? dueNow(goal, today(), skillFlows(store)) : []), [goal, store]);
  if (due.length === 0) return null;
  return (
    <section aria-label="Due now" className="anim-fade-in space-y-0.5">
      <h3><PencilWord className="text-[21px] text-graphite">due now</PencilWord></h3>
      <ul className="text-[15px] leading-[22px]">
        {due.map((d) => (
          <li key={d.why}>
            <TextAction className="text-left text-[15px]! leading-[22px]! text-graphite!" onClick={() => composeInChat(`Let's deal with this: ${sentence(d.why)}`)}>
              {sentence(d.why)}
            </TextAction>
          </li>
        ))}
      </ul>
    </section>
  );
}
