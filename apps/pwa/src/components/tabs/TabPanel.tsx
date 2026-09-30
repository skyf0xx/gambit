import type { ReactNode } from 'react';
import type { TabId } from './tabDefs';

// A single tabpanel with the page-turn transition (task spec: "switching
// plays a short page-turn: the outgoing content slides or fades away and
// the incoming page settles in, 200-260ms. Under prefers-reduced-motion
// it's instant."). Keyed by `tab` from the caller so React remounts (and
// therefore replays the animation) on every switch; reduced motion is
// handled by styles.css's global catch-all the same way every other
// anim-* class already gets it, so no separate reduced-motion class here.
export function TabPanel({ tab, active, children }: { tab: TabId; active: boolean; children: ReactNode }) {
  if (!active) return null;
  return (
    <div
      key={tab}
      role="tabpanel"
      id={`tabpanel-${tab}`}
      aria-labelledby={`tab-${tab}`}
      tabIndex={0}
      className="page-turn-in space-y-6"
    >
      {children}
      <style>{`
        @keyframes page-turn-in {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .page-turn-in { animation: page-turn-in 220ms ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .page-turn-in { animation: none; }
        }
      `}</style>
    </div>
  );
}
