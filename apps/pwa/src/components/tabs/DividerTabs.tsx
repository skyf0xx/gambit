import { useRef } from 'react';
import { TAB_LABELS, type TabId } from './tabDefs';

// The tab strip itself: paper folder-dividers sticking out of the page's
// right edge, outside it, into the desk (brand/identity.md §03 "only slips
// cast shadows, and a slip means you can touch it"). Vertical and on the
// right at every width, per the owner's override — mobile no longer moves
// the strip to the top; Dashboard.tsx narrows the page itself on mobile
// (mr-9) to leave the same kind of desk sliver on the right that desktop
// already has in its 132px gap before the conversation leaf.
//
// Shape and stacking rules (owner correction, still in force):
//   - No outlines/borders anywhere — shape comes from fill, shadow and
//     overlap alone (a `slip` surface + grain, clipped to a tapered
//     folder-tab silhouette via clip-path).
//   - Tabs overlap top-to-bottom, each sitting progressively behind the
//     previous one in z-order (front to back around the active tab).
//   - Inactive tabs are progressively darker/cooler further back; the
//     active tab comes to the front, is the page's own colour + grain (no
//     seam with the page), and casts the strongest shadow.
//   - Hover/focus nudges an inactive tab out by 2-3px; switching brings a
//     tab to the front with a small lift-and-settle (instant under
//     reduced motion).
//   - The ink focus ring still draws on the tab's own clipped shape.
//
// Mobile-specific requirements from the owner's override:
//   - Labels rotate 90°, same reading direction as the narrow-desktop
//     rotation below, at >=13px Inter.
//   - Each tap area is still >=44px tall.
//   - The strip stays reachable while the page scrolls (position: sticky
//     within the page wrapper) and, if the stack is taller than the
//     viewport, it scrolls vertically within itself rather than pushing
//     the tab strip off-screen or forcing horizontal page scroll.

const TAB_SIZE = 44; // px, matches the shared 44px minimum tap target

/** The folder-tab silhouette: a rounded-shoulder shape that tapers toward
 * the page (its left edge, since every breakpoint now stacks vertically off
 * the page's right edge), full width at the right (free) edge — drawn as a
 * clip-path polygon (percentages, so it scales with the button's own box)
 * rather than a hard rectangle. This is what makes it read as a tab and not
 * a bordered box. */
const TAB_CLIP = 'polygon(0% 22%, 22% 0%, 100% 0%, 100% 100%, 22% 100%, 0% 78%)';

export function DividerTabs({
  tabs,
  active,
  onChange,
  changedTabs,
}: {
  tabs: TabId[];
  active: TabId;
  onChange: (t: TabId) => void;
  changedTabs: Set<TabId>;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  const move = (delta: number) => {
    const i = tabs.indexOf(active);
    const next = tabs[(i + delta + tabs.length) % tabs.length];
    onChange(next);
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus();
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Home') { e.preventDefault(); onChange(tabs[0]); requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-tab="${tabs[0]}"]`)?.focus()); }
    else if (e.key === 'End') { e.preventDefault(); const last = tabs[tabs.length - 1]; onChange(last); requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-tab="${last}"]`)?.focus()); }
  };

  return (
    <div className="tab-strip pointer-events-auto absolute">
      {/* The scroll container is a separate element from the positioning
       * anchor above: overflow set on either axis forces the browser to
       * compute the other axis as non-visible too (CSS overflow spec),
       * which would otherwise clip each tab's own negative margin-left
       * (how they tuck behind one another and behind the page edge). */}
      <div className="tab-strip-scroll flex flex-col">
        <div ref={listRef} role="tablist" aria-label="Notebook sections" aria-orientation="vertical" onKeyDown={onKeyDown} className="flex flex-col">
          {tabs.map((t, i) => {
            const isActive = t === active;
            const changed = changedTabs.has(t) && !isActive;
            // Depth rank: 0 = frontmost (active always ranks 0); otherwise
            // ranked by distance from the active tab so neighbours of the
            // active tab sit just behind it, not in strip order. Each rank
            // step gets a touch darker/cooler and a smaller shadow.
            const activeIdx = tabs.indexOf(active);
            const rank = isActive ? 0 : Math.abs(i - activeIdx);
            const depth = Math.min(rank, 4);
            return (
              <button
                key={t}
                data-tab={t}
                data-depth={depth}
                role="tab"
                id={`tab-${t}`}
                aria-selected={isActive}
                aria-controls={`tabpanel-${t}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onChange(t)}
                style={{ zIndex: tabs.length - depth }}
                className={`tab-leaf anim-press relative flex shrink-0 items-center justify-center font-sans text-[14px] font-medium text-ink ${
                  isActive ? 'tab-active' : 'tab-inactive'
                }`}
              >
                <span className="tab-leaf-fill" aria-hidden="true" />
                <span className="tab-leaf-label">{TAB_LABELS[t]}</span>
                {changed && <span aria-hidden="true" className="tab-leaf-dot pencil bg-graphite" />}
                {changed && <span className="sr-only"> (changed)</span>}
              </button>
            );
          })}
        </div>
        {/* The menu action, pinned to the bottom of the divider stack as
         * its own paper tab (owner correction) so the whole strip reads as
         * one notebook — a section divider for every content tab, plus a
         * last one for the app's own menu. It isn't a tabpanel tab: it's a
         * plain button outside role="tablist", after the tabs in focus
         * order, dispatching the same gambit:menu event the old in-page
         * icon used to (Settings.tsx already listens for it). The old
         * header icon is gone (MovesTab.tsx's PageHeader) so this is the
         * only menu control on the page. */}
        <button
          type="button"
          aria-label="Menu"
          data-tab="menu"
          data-depth={0}
          onClick={() => window.dispatchEvent(new CustomEvent('gambit:menu'))}
          style={{ zIndex: 0, marginTop: '12px' }}
          className="tab-leaf tab-menu anim-press relative flex shrink-0 items-center justify-center font-sans text-[14px] font-medium text-ink tab-inactive"
        >
          <span className="tab-leaf-fill" aria-hidden="true" />
          <span className="tab-leaf-label flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="shrink-0">
              <path d="M2.5 5.5h15M2.5 10h15M2.5 14.5h15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Menu
          </span>
        </button>
      </div>
      <style>{`
        /* The positioning anchor: fixed to the page sheet's real right
           edge (this component's absolutely-positioned parent is the page
           sheet, per Tabs.tsx/Dashboard.tsx), sticky down the viewport so
           the strip stays reachable while the page scrolls, and capped to
           the viewport height so a long stack scrolls within itself
           instead of pushing off-screen or forcing page scroll. */
        .tab-strip {
          top: 0;
          left: 100%;
          right: auto;
          bottom: 0;
        }
        /* Sticky lives on the scroll container, not the absolutely
           positioned anchor above -- position: sticky computes its own
           left/top as offsets in normal flow, which would conflict with
           the anchor's left: 100% (an absolute offset) if both landed on
           the same element. Anchoring the outer box with position:
           absolute and letting this inner box stick to the viewport's top
           as the page scrolls is what keeps the strip reachable without
           fighting that positioning mode clash. */
        .tab-strip-scroll {
          position: sticky;
          top: 0;
          overflow-y: visible;
          overflow-x: visible;
          padding-top: 28px;
          padding-left: 24px;
          margin-left: -24px;
        }
        .tab-strip-scroll::-webkit-scrollbar { display: none; }

        /* Each tab button is unstyled (no bg/border of its own) — the fill,
           grain and clip-path all live on .tab-leaf-fill, so the button's
           own drop-shadow filter (applied to the button, not the clipped
           child) isn't itself clipped away. */
        .tab-leaf {
          background: none;
          padding: 0;
          min-height: ${TAB_SIZE}px;
          min-width: ${TAB_SIZE}px;
          width: 100px;
          height: 44px;
          margin-left: -40px;
          margin-bottom: -10px;
          transition: transform 160ms ease-out, filter 160ms ease-out;
          filter: drop-shadow(0 2px 2px var(--lift-far));
        }
        .tab-leaf-fill {
          position: absolute;
          inset: 0;
          background: var(--grain), var(--surface);
          clip-path: ${TAB_CLIP};
        }
        .tab-leaf-label {
          position: relative;
          z-index: 1;
          padding: 0 10px 0 44px;
          white-space: nowrap;
        }
        .tab-leaf.tab-active .tab-leaf-fill {
          background: var(--grain), var(--bg);
        }
        .tab-leaf.tab-active {
          filter: drop-shadow(0 2px 2px var(--lift)) drop-shadow(0 6px 14px -6px var(--lift-far));
          transform: translateX(-4px);
        }
        .tab-leaf.tab-inactive:hover,
        .tab-leaf.tab-inactive:focus-visible {
          transform: translateX(-3px);
        }
        .tab-leaf:focus-visible {
          outline: 2px solid var(--ink);
          outline-offset: 2px;
        }
        .tab-leaf-dot {
          position: absolute;
          z-index: 2;
          top: 8px;
          right: 10px;
          height: 6px;
          width: 6px;
          border-radius: 9999px;
        }
        /* Progressive darkening for tabs further back in the stack. */
        .tab-leaf.tab-inactive[data-depth="1"] .tab-leaf-fill { filter: brightness(0.97); }
        .tab-leaf.tab-inactive[data-depth="2"] .tab-leaf-fill { filter: brightness(0.94); }
        .tab-leaf.tab-inactive[data-depth="3"] .tab-leaf-fill { filter: brightness(0.91); }
        .tab-leaf.tab-inactive[data-depth="4"] .tab-leaf-fill { filter: brightness(0.88); }

        /* Below 1100px (narrow desktop and every mobile width) the desk
           strip is narrower, so tabs shrink to a slim vertical column with
           a rotated label instead of the wide horizontal-label tab used at
           roomy desktop widths. This is also mobile's shape per the
           owner's override: vertical, right-hand, rotated 90°. */
        @media (max-width: 1099.98px) {
          .tab-strip-scroll {
            padding-left: 6px;
            margin-left: -6px;
            /* A 6-tab stack at 92px each (552px) can exceed a short mobile
               viewport's height once the top padding and safe areas are
               subtracted, so this width range scrolls vertically within
               itself instead of overflowing the screen or forcing page
               scroll (task: "the stack scrolls vertically within itself,
               or tabs compress their spacing"). Wider desktop never needs
               this — six 44px-tall tabs comfortably fit any viewport. */
            overflow-y: auto;
            max-height: 100dvh;
            scrollbar-width: none;
          }
          .tab-leaf {
            width: 40px;
            height: 92px;
            margin-left: -6px;
            margin-bottom: -18px;
          }
          .tab-leaf-label {
            writing-mode: vertical-rl;
            text-orientation: mixed;
            transform: rotate(180deg);
            padding: 14px 0;
          }
          /* The menu tab's icon reads oddly caught in a vertical writing
             mode alongside rotated text; the task explicitly allows
             dropping it ("optional, and only alongside the text"), so
             narrow layouts keep just the rotated "Menu" label. */
          .tab-menu .tab-leaf-label svg {
            display: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .tab-leaf { transition: none; }
        }
      `}</style>
    </div>
  );
}
