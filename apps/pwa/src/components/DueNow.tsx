import { useEffect, useMemo, useState } from 'react';
import { dueNow } from '@gambit/core';
import type { Goal } from '../lib/types';
import { today } from '../lib/dates';
import { composeInChat, defineStarter, dueStarter } from '../lib/compose';
import { locale, t } from '../lib/i18n';
import { sectionTitleFor } from './sectionTitles';
import { RedRing } from './marks/RedRing';
import { getSkillStore, skillFlows, type SkillStore } from '../lib/skills';
import { TextAction, PencilWord } from './ui';

type Due = ReturnType<typeof dueNow>[number];

/** A due item in the page's language. Core says it as a message id and the
 * values it fills in; a section is named by its heading on the page.
 * English reads core's own todo. */
const todoText = ({ say, todo }: Due) => {
  if (locale() === 'en') return todo;
  const { id, ...params } = say;
  if (id === 'updateSection') params.section = sectionTitleFor(String(params.key)).title;
  return t(`due.${id}`, params);
};

/** What the goal says is due now, as pencilled links under the sticky
 * notes. Tapping one puts a starter in the chat composer; it never sends.
 * Nothing due, nothing shown. */
export function DueNow({ goal }: { goal: Goal }) {
  const [store, setStore] = useState<SkillStore | null>(null);
  useEffect(() => { void getSkillStore().then(setStore); }, []);
  const due = useMemo(() => (store ? dueNow(goal, today(), skillFlows(store)) : []), [goal, store]);
  if (due.length === 0) return null;
  return (
    <section aria-label={t('due.label')} className="anim-fade-in space-y-0.5">
      <h3><PencilWord className="text-[21px] text-graphite">{t('due.heading')}</PencilWord></h3>
      <ul>
        {due.map((d) => {
          // Defining a new goal is the one move that must not be missed: it
          // stays circled in red, and its starter names the goal itself.
          const define = d.skill === 'intake';
          const todo = todoText(d);
          return (
            <li key={d.todo}>
              <TextAction
                className="text-left underline decoration-graphite/60 decoration-1"
                circle={!define}
                onClick={() => composeInChat(define ? defineStarter(goal.goal) : dueStarter(todo))}
              >
                {define ? (
                  <RedRing seed="define"><PencilWord className="text-[19px] text-ink">{todo}</PencilWord></RedRing>
                ) : (
                  <PencilWord className="text-[19px] text-ink">{todo}</PencilWord>
                )}
              </TextAction>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
