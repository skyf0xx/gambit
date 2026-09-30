import { useEffect, useRef, useState } from 'react';
import type { Goal } from '../../lib/types';
import { useSession } from '../../lib/session';
import { Doodles } from '../doodles/Doodles';
import type { SettingsPageProps } from '../Settings';
import { DividerTabs } from './DividerTabs';
import { TabPanel } from './TabPanel';
import { TitleBar } from './TitleBar';
import { GoalTab } from './GoalTab';
import { MovesTab } from './MovesTab';
import { PeopleTab } from './PeopleTab';
import { RisksTab } from './RisksTab';
import { ChoicesTab } from './ChoicesTab';
import { CapacityTab } from './CapacityTab';
import { InsideCoverTab } from './InsideCoverTab';
import { TAB_ORDER, tabForPath, tabHasContent, type TabId } from './tabDefs';

const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** `gambit:goto`'s brief flash on the landed-on line: a pencil underline
 * that fades after ~600ms (task spec), or just a focus under reduced
 * motion. Implemented as a transient class + inline style rather than a
 * styles.css addition, since Tabs.tsx doesn't own styles.css. */
function flashLine(el: HTMLElement) {
  if (reducedMotion()) {
    el.setAttribute('tabindex', '-1');
    el.focus();
    return;
  }
  const prevOutline = el.style.outline;
  const prevOffset = el.style.outlineOffset;
  const prevTransition = el.style.transition;
  el.style.transition = 'outline-color 600ms ease-out';
  el.style.outline = '2px solid var(--graphite)';
  el.style.outlineOffset = '2px';
  window.setTimeout(() => {
    el.style.outline = '2px solid transparent';
    window.setTimeout(() => {
      el.style.outline = prevOutline;
      el.style.outlineOffset = prevOffset;
      el.style.transition = prevTransition;
    }, 300);
  }, 300);
}

/** The notebook page, split into divider tabs (task: "the page is too
 * long; there's too much scrolling"). Owns which tab is selected — never
 * persisted, every visit opens on Moves (task spec) — the `gambit:goto`
 * jump target, and the changed-elsewhere pencil dot fed by the session's
 * open change loop. `settings` carries the goal-switcher/provider-form
 * props the Inside cover tab needs; App.tsx passes through what it used to
 * hand the old Settings Leaf. */
export function Tabs({ g, goalId, settings }: { g: Goal; goalId: string; settings: SettingsPageProps }) {
  const [active, setActive] = useState<TabId>('moves');
  const session = useSession();
  const pageRef = useRef<HTMLDivElement>(null);

  // Every visit opens on Moves — reset when the goal itself changes (a goal
  // switch, not a re-render of the same goal), so switching goals doesn't
  // strand the user on a tab the new goal doesn't have.
  useEffect(() => { setActive('moves'); }, [goalId]);

  // `gambit:goto`: switch to the tab holding the path, then scroll+flash
  // the line once that tab's content is in the DOM. `gambit:menu` (the
  // in-page header used to open a Leaf for this; Inside cover is now a
  // page instead) is just a goto to the special 'inside-cover' path.
  useEffect(() => {
    const onGoto = (e: Event) => {
      const path = (e as CustomEvent<{ path?: string }>).detail?.path;
      if (!path) return;
      const target = tabForPath(path);
      setActive(target);
      // Wait a tick for the tab switch to render before querying the DOM;
      // two rAFs cover the TabPanel remount plus MarksLayer's own redraw.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = pageRef.current?.querySelector<HTMLElement>(`[data-line="${cssEscape(path)}"]`);
        if (!el) return;
        el.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
        flashLine(el);
      }));
    };
    const onMenu = () => setActive('inside-cover');
    window.addEventListener('gambit:goto', onGoto);
    window.addEventListener('gambit:menu', onMenu);
    return () => {
      window.removeEventListener('gambit:goto', onGoto);
      window.removeEventListener('gambit:menu', onMenu);
    };
  }, []);

  const tabs = TAB_ORDER.filter((t) => tabHasContent(t, g));
  const changeTab = session.turn?.goalId === goalId ? tabForPath(session.turn.lines[0]?.path ?? '') : null;
  const changedTabs = new Set<TabId>(changeTab && changeTab !== active ? [changeTab] : []);

  return (
    <div ref={pageRef} className="relative">
      {/* The tab strip is a sibling of the page's own padded content, not a
       * child of it, and positions itself off *this* element — the page
       * sheet passed up from Dashboard.tsx (position/shadow/border only,
       * no padding of its own) — rather than the inner padding box below.
       * That's what lets it stick out past the page's real edge into the
       * desk, never inside the page's own margin/padding, and never affect
       * the page's width (task: tabs sit outside the notebook). */}
      <DividerTabs tabs={tabs} active={active} onChange={setActive} changedTabs={changedTabs} />
      <div className="px-8.5 pb-6 md:px-16 md:pb-11">
        <TabPanel tab="goal" active={active === 'goal'}>
          <TitleBar goalTitle={g.goal} hideTitle />
          <GoalTab g={g} goalId={goalId} />
        </TabPanel>
        <TabPanel tab="moves" active={active === 'moves'}>
          <TitleBar goalTitle={g.goal} />
          <MovesTab g={g} goalId={goalId} />
        </TabPanel>
        <TabPanel tab="people" active={active === 'people'}>
          <TitleBar goalTitle={g.goal} />
          <PeopleTab g={g} goalId={goalId} />
        </TabPanel>
        <TabPanel tab="risks" active={active === 'risks'}>
          <TitleBar goalTitle={g.goal} />
          <RisksTab g={g} goalId={goalId} />
        </TabPanel>
        <TabPanel tab="choices" active={active === 'choices'}>
          <TitleBar goalTitle={g.goal} />
          <ChoicesTab g={g} goalId={goalId} />
        </TabPanel>
        <TabPanel tab="capacity" active={active === 'capacity'}>
          <TitleBar goalTitle={g.goal} />
          <CapacityTab g={g} goalId={goalId} />
        </TabPanel>
        <TabPanel tab="doodles" active={active === 'doodles'}>
          <TitleBar goalTitle={g.goal} />
          <Doodles goal={g} goalId={goalId} />
        </TabPanel>
        <TabPanel tab="inside-cover" active={active === 'inside-cover'}>
          <TitleBar goalTitle={g.goal} />
          <InsideCoverTab {...settings} />
        </TabPanel>
      </div>
    </div>
  );
}

function cssEscape(s: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}
