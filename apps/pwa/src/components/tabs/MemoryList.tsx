import { forget } from '@gambit/core';
import { applyOp } from '../../lib/goals';
import type { Goal } from '../../lib/types';
import { TextAction, PencilWord } from '../ui';
import { SectionHeading } from '../paper/SectionHeading';
import { sectionTitleFor } from '../sectionTitles';
import { t } from '../../lib/i18n';

const kindLabel = (kind: Goal['memory'][number]['kind']): string => (({
  fact: t('settings.memoryKind.fact'),
  preference: t('settings.memoryKind.preference'),
  constraint: t('settings.memoryKind.constraint'),
  rejected: t('settings.memoryKind.rejected'),
}) as Record<typeof kind, string>)[kind];

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
            <PencilWord className="w-24 shrink-0 text-[16px] text-graphite">{kindLabel(m.kind)}</PencilWord>
            <span className="flex-1">{m.text}</span>
            <TextAction
              circle={false}
              title={t('settings.forgetThis')}
              aria-label={t('settings.forgetLabel', { text: m.text })}
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
