import type { ReactNode } from 'react';
import type { Goal } from '../../lib/types';
import { TextAction, PencilWord } from '../ui';
import { SectionBody, EMPTY_PROMPTS, EMPTY_STARTERS } from '../Sections';
import { composeInChat } from '../../lib/compose';
import { sectionTitleFor } from '../sectionTitles';
import { proseDates } from '../../lib/dates';
import { SectionHeading } from '../paper/SectionHeading';

// A single goal-key section: heading (+ method gloss) and body. Split out
// of Dashboard.tsx (which owned this inline before the tab split) so every
// tab's content component can render its own section list without
// duplicating the heading chrome.

const SECTION_KEYS = ['plan', 'criteriaStatus', 'successCriteria', 'people', 'stakeholders', 'systemsNotes', 'riskNotes', 'decisions', 'exposure', 'capacity', 'forecasts', 'experiments', 'intel', 'courses', 'prep'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export const isEmptySection = (v: unknown) => v == null || (Array.isArray(v) ? v.length === 0 : typeof v === 'object' && Object.keys(v as object).length === 0);

export function Section({ goalId, k, data, aside }: { goalId: string; k: SectionKey; data: unknown; aside?: ReactNode }) {
  const { title, method, methodNote } = sectionTitleFor(k);
  // Capacity's tab already names its method, so the pencilled word beside
  // its heading is the date the numbers were last checked instead.
  const reviewed = k === 'capacity' ? (data as { lastReviewed?: string }).lastReviewed : undefined;
  return (
    <section className="anim-fade-in space-y-3">
      <SectionHeading
        k={k}
        after={aside ?? (reviewed && <PencilWord className="text-[22px]">{proseDates(`reviewed ${reviewed}`)}</PencilWord>)}
      >
        {/* The method behind a section is a hover note on its title, not a
         * second word beside it. */}
        <span data-note={method ? methodNote : undefined}>{title}</span>
      </SectionHeading>
      <SectionBody k={k} data={data} goalId={goalId} editable />
    </section>
  );
}

export function EmptySection({ k, onTap }: { k: string; onTap?: () => void }) {
  const { title } = sectionTitleFor(k);
  const prompt = EMPTY_PROMPTS[k] ?? 'Nothing here yet.';
  const starter = EMPTY_STARTERS[k];
  onTap ??= starter ? () => composeInChat(starter) : undefined;
  return (
    <section className="anim-fade-in space-y-3">
      <SectionHeading k={k} empty>{title}</SectionHeading>
      <TextAction className="text-left" onClick={onTap}>
        <PencilWord>{prompt}</PencilWord>
      </TextAction>
    </section>
  );
}

/** Renders a list of section keys — the shared body every non-Moves tab
 * uses. An empty section isn't shown: a tab only appears once one of its
 * sections has something in it (tabDefs.ts), and an empty one beside it
 * would only be a prompt for something nobody asked about. */
export function SectionList({ goalId, g, keys }: { goalId: string; g: Goal; keys: SectionKey[] }) {
  return (
    <>
      {keys.map((k) => (isEmptySection(g[k]) ? null : <Section key={k} goalId={goalId} k={k} data={g[k]} />))}
    </>
  );
}
