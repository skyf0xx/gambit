import type { Goal } from '../../lib/types';
import { PeopleBody } from '../Sections';
import { sectionTitleFor } from '../sectionTitles';
import { SectionList } from './SectionRenderer';
import { SectionHeading } from '../paper/SectionHeading';

/** People and stakeholders read as one list under one heading — someone in
 * both is one row, not two (Sections.tsx `PeopleBody`). The heading is
 * "Who else has a say" only when nobody is in `people` yet. */
export function PeopleTab({ g, goalId }: { g: Goal; goalId: string }) {
  if (g.people.length === 0 && g.stakeholders.length === 0) return <SectionList goalId={goalId} g={g} keys={['prep']} />;
  const k = g.people.length > 0 ? 'people' : 'stakeholders';
  const { title, method, methodNote } = sectionTitleFor(k);
  return (
    <>
    <section className="anim-fade-in space-y-3">
      <SectionHeading k={k}>
        <span data-note={method ? methodNote : undefined}>{title}</span>
      </SectionHeading>
      <PeopleBody goalId={goalId} people={g.people} stakeholders={g.stakeholders} />
    </section>
    <SectionList goalId={goalId} g={g} keys={['prep']} />
    </>
  );
}
