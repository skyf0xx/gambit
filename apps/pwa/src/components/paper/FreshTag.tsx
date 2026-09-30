import type { LinePath } from '../../lib/changes';
import { useSession, type FreshWrites } from '../../lib/session';
import { useMarksContext } from '../marks/context';

// The pencilled "new" beside what the last turn wrote, so a reader landing
// on a dotted divider tab can find what changed. Graphite, not the accent:
// the loop keeps the accent for the one line that matters most, and that
// line carries its own "new, from your chat" note instead of this tag.
// Clears with the rest of the turn's marks: next turn, undo, or reload.

function useFreshForPage(): FreshWrites | null {
  const { fresh } = useSession();
  const goalId = useMarksContext()?.goalId;
  return fresh && fresh.goalId === goalId ? fresh : null;
}

function Tag() {
  return (
    <>
      <span aria-hidden="true" className="hand anim-write ml-2 inline-block text-[16px] font-normal text-graphite">new</span>
      <span className="sr-only"> (new from your last chat)</span>
    </>
  );
}

/** "new" after a line the last turn added or edited. */
export function FreshTag({ path }: { path: LinePath }) {
  const fresh = useFreshForPage();
  if (!fresh || path === fresh.lead) return null;
  return fresh.lines.has(path) || fresh.keys.has(path) ? <Tag /> : null;
}

/** "new" after a section heading whose key changed with no single changed
 * line inside it to carry the tag (capacity, exposure, experiments, …). */
export function FreshSectionTag({ k }: { k: string }) {
  const fresh = useFreshForPage();
  if (!fresh || !fresh.keys.has(k)) return null;
  for (const p of fresh.lines) if (p.startsWith(`${k}.`)) return null;
  return <Tag />;
}
