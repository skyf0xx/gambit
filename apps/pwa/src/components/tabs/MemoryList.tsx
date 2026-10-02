import { forget } from '@gambit/core';
import { applyOp } from '../../lib/goals';
import type { Goal } from '../../lib/types';
import { TextAction, PencilWord } from '../ui';
import { SectionHeading } from '../paper/SectionHeading';
import { sectionTitleFor } from '../sectionTitles';

const KIND_LABELS: Record<Goal['memory'][number]['kind'], string> = {
  fact: 'fact',
  preference: 'you prefer',
  constraint: 'limit',
  rejected: 'ruled out',
};

/** What the advisor keeps between conversations, with a way to strike any
 * entry: a wrong memory is worse than none, and the user is the one who
 * knows. */
export function MemoryList({ g, goalId }: { g: Goal; goalId: string }) {
  return (
    <section className="space-y-3">
      <SectionHeading k="memory">{sectionTitleFor('memory').title}</SectionHeading>
      <ul className="space-y-1 text-[17px] leading-[27px]">
        {g.memory.map((m, i) => (
          <li key={`${i}-${m.text}`} data-line={`memory.${i}`} className="flex items-baseline gap-2">
            <PencilWord className="w-24 shrink-0 text-[16px] text-graphite">{KIND_LABELS[m.kind]}</PencilWord>
            <span className="flex-1">{m.text}</span>
            <TextAction
              circle={false}
              title="Forget this"
              aria-label={`Forget: ${m.text}`}
              className="shrink-0 text-graphite"
              onClick={() => void applyOp(goalId, (x) => forget(x, i) as never)}
            >
              ×
            </TextAction>
          </li>
        ))}
      </ul>
    </section>
  );
}
