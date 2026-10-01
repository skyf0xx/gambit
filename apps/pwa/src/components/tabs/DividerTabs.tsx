import { useRef } from 'react';
import { TAB_LABELS, type TabId } from './tabDefs';

// The tab strip itself: paper folder-dividers sticking out of the page's
// right edge, outside it, into the desk (brand/identity.md §03 "only slips
// cast shadows, and a slip means you can touch it"). Vertical and on the
// right at every width, per the owner's override — mobile no longer moves
// the strip to the top; Dashboard.tsx narrows the page itself on mobile
// (mr-9) to leave the same kind of desk sliver on the right that desktop
// already has in its 132px gap before the conversation leaf. The last tab,
// "Settings" (id `inside-cover`), is a real tab like the rest (in the tablist, reachable by
// keyboard nav) — it just carries its own icon and a small gap above it so
// it still reads as set apart, at the foot of the stack.
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
// One shape at every width (owner's override): a slim vertical tab with
// its label rotated 90° — no wide horizontal-label variant on roomy
// desktop.
//   - Labels are >=13px Inter.
//   - Each tap area is still >=44px tall.
//   - The strip stays reachable while the page scrolls (position: sticky
//     within the page wrapper) and, if the stack is taller than the
//     viewport, it scrolls vertically within itself rather than pushing
//     the tab strip off-screen or forcing horizontal page scroll.

const TAB_SIZE = 44; // px, matches the shared 44px minimum tap target

/** The folder-tab silhouette: straight and full height along the page (its
 * left edge, since every breakpoint stacks vertically off the page's right
 * edge), with the shoulders tapering in at the right (free) edge — drawn
 * as a clip-path polygon (percentages, so it scales with the button's own
 * box) rather than a hard rectangle. This is what makes it read as a tab
 * and not a bordered box. */
const TAB_CLIP = 'polygon(0% 0%, 78% 0%, 100% 22%, 100% 78%, 78% 100%, 0% 100%)';

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
            const isInsideCover = t === 'inside-cover';
            return (
              <button
                key={t}
                data-tab={t}
                data-depth={depth}
                role="tab"
                id={`tab-${t}`}
                aria-selected={isActive}
                aria-controls={`tabpanel-${t}`}
                aria-label={isInsideCover ? 'Settings and notebooks' : undefined}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onChange(t)}
                style={{ zIndex: tabs.length - depth, marginTop: isInsideCover ? '12px' : undefined }}
                className={`tab-leaf anim-press relative flex shrink-0 items-center justify-center font-sans text-[14px] font-medium text-ink ${
                  isActive ? 'tab-active' : 'tab-inactive'
                } ${isInsideCover ? 'tab-inside-cover' : ''} ${t === 'moves' ? 'tab-moves' : ''}`}
              >
                <span className="tab-leaf-fill" aria-hidden="true" />
                <span className="tab-leaf-label">
                  {t === 'moves' && (
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="shrink-0">
                      <path d="M10 2.5 17.5 10 10 17.5 2.5 10Z" stroke="currentColor" strokeWidth="2.25" strokeLinejoin="round" />
                    </svg>
                  )}
                  {isInsideCover && (
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="tab-menu-icon shrink-0">
                      <path d="M2.5 5.5h15M2.5 10h15M2.5 14.5h15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                  {TAB_LABELS[t]}
                </span>
                {changed && <span aria-hidden="true" className="tab-leaf-dot pencil bg-graphite" />}
                {changed && <span className="sr-only"> (changed)</span>}
              </button>
            );
          })}
        </div>
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
          /* The full stack at 102px a tab can exceed a short viewport's
             height once the top padding and safe areas are subtracted, so
             it scrolls vertically within itself instead of overflowing the
             screen or forcing page scroll. */
          overflow-y: auto;
          max-height: 100dvh;
          scrollbar-width: none;
          padding-top: 28px;
          /* Room below the last tab for its drop shadow, which this
             scroll container would otherwise clip. */
          padding-bottom: 16px;
          padding-left: 6px;
          margin-left: -6px;
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
          width: 40px;
          height: 102px;
          /* Only the tab's base tucks under the page edge; the rest sits
             out on the desk. */
          margin-left: -6px;
          margin-bottom: -18px;
          transition: transform 160ms ease-out, filter 160ms ease-out;
          filter: drop-shadow(0 2px 2px var(--lift-far));
        }
        /* The overlap margin is for tucking under the next tab down; on the
           last tab it would pull the scroll container's bottom edge up
           over the tab's own tapered bottom shoulder and clip it square. */
        .tab-leaf:last-child {
          margin-bottom: 0;
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
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 14px 0;
          white-space: nowrap;
          writing-mode: vertical-rl;
          text-orientation: mixed;
          transform: rotate(180deg);
        }
        .tab-leaf.tab-active .tab-leaf-fill {
          background: var(--grain), var(--bg);
        }
        /* Moves is the tab the notebook is for. Its importance is carried
           by shape, not fill: a bigger tab and the favicon's diamond — so
           its fill behaves like every other tab's and selection still
           reads as "same colour as the page". Width stays within mobile's 36px desk
           sliver (mr-9) and grows on roomier screens. */
        .tab-leaf.tab-moves {
          width: 42px;
          height: 124px;
          font-weight: 600;
        }
        @media (min-width: 768px) {
          .tab-leaf.tab-moves { width: 48px; }
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
          animation: tab-dot-in 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes tab-dot-in {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tab-leaf-dot { animation: none; }
        }
        /* Inactive tabs sit a step behind the page, darker the further back
           they are, so the active one reads as the page itself. */
        .tab-leaf.tab-inactive .tab-leaf-fill { filter: brightness(0.94); }
        .tab-leaf.tab-inactive[data-depth="2"] .tab-leaf-fill { filter: brightness(0.91); }
        .tab-leaf.tab-inactive[data-depth="3"] .tab-leaf-fill { filter: brightness(0.88); }
        .tab-leaf.tab-inactive[data-depth="4"] .tab-leaf-fill { filter: brightness(0.85); }
        /* Selection also reads in the label itself: inactive labels sit
           back in graphite, the open tab's label is full ink. */
        .tab-leaf.tab-inactive .tab-leaf-label { color: var(--graphite); }
        .tab-leaf.tab-inactive:hover .tab-leaf-label,
        .tab-leaf.tab-inactive:focus-visible .tab-leaf-label { color: var(--ink); }

        /* The Settings tab's icon reads oddly caught in a vertical writing
           mode alongside rotated text, so the tab keeps just its rotated
           label. */
        .tab-inside-cover .tab-menu-icon {
          display: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .tab-leaf { transition: none; }
        }
      `}</style>
    </div>
  );
}
