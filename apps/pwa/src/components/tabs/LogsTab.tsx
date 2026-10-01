import type { Goal } from '../../lib/types';
import { PencilWord } from '../ui';
import { formatDate } from '../Sections';
import { SectionHeading } from '../paper/SectionHeading';
import { sectionTitleFor } from '../sectionTitles';

/** The goal's log, newest first, shown under Settings' "History". The whole log shows here — it's
 * already capped on the write path (`append_log`, packages/core). */
export function LogsTab({ g }: { g: Goal }) {
  return (
    <section className="space-y-3">
      <SectionHeading k="log">{sectionTitleFor('log').title}</SectionHeading>
      <ul className="space-y-3 text-[17px] leading-[27px]">
        {[...g.log].reverse().map((e, i) => (
          <li key={i}>
            <PencilWord className="text-[16px]">{formatDate(e.date)}{e.source ? ` · ${e.source}` : ''}</PencilWord>
            <ul className="list-disc pl-5">{e.notes.map((n, j) => <li key={j}>{n}</li>)}</ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
