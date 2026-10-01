import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTornEdge } from '../marks/torn';

// A slim sticky title bar at the top of every tab page (owner correction):
// the goal as a short one-line title, and nothing else. It slides away
// while the page scrolls down and comes back on any scroll up — a slip of
// paper torn along its bottom edge, the mirror of the chat composer's torn
// top, so the page scrolls between two torn strips. Its shadow is cast
// from a wrapper, since the tear is a clip-path that would cut off a
// shadow on the slip itself. The Goal tab shows the goal as its own
// heading, so there `hideTitle` leaves only the bar's height: the page
// starts at the same place on every tab, with nothing stuck over it.

// The nearest ancestor that actually scrolls (the dashboard column), or
// the window when none does.
function scrollParent(el: HTMLElement | null): HTMLElement | Window {
  for (let n = el?.parentElement; n; n = n.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(n).overflowY)) return n;
  }
  return window;
}

// True while the page scrolls down past the bar; false on scroll up or
// near the top. A few px of slack keeps a resting thumb from flicking it.
function useHideOnScrollDown(ref: RefObject<HTMLElement | null>) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const scroller = scrollParent(ref.current);
    const top = () => (scroller instanceof Window ? scroller.scrollY : scroller.scrollTop);
    let last = top();
    const onScroll = () => {
      const y = top();
      const dy = y - last;
      if (Math.abs(dy) < 6) return;
      setHidden(dy > 0 && y > 60);
      last = y;
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [ref]);
  return hidden;
}

export function TitleBar({ goalTitle, hideTitle }: { goalTitle: string; hideTitle?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useTornEdge(ref, 'title-bar', 'bottom');
  const hidden = useHideOnScrollDown(wrap);

  if (hideTitle) return <div aria-hidden="true" className="mb-6 h-[53.5px]" />;

  return (
    // The strip spans the page sheet: out over the page's 2px margin rule
    // on the left, stopping at the sheet's right edge so the divider tabs
    // in the desk strip beside it (Dashboard.tsx's mr-9) stay clear.
    <div
      ref={wrap}
      className={`sticky top-0 z-10 mb-6 -mr-8.5 -ml-[calc(2.125rem+2px)] transition-transform duration-200 ease-out motion-reduce:transition-none md:-mx-16 ${hidden ? '-translate-y-[calc(100%+4px)]' : ''}`}
      style={{ filter: 'drop-shadow(0 1px 1px color-mix(in srgb, var(--lift-far) 55%, transparent))' }}
    >
      <div ref={ref} className="slip pt-3 pb-4 pr-8.5 pl-[calc(2.125rem+2px)] md:px-16" style={{ clipPath: 'var(--torn, none)' }}>
        <span className="block truncate font-hand text-[23px] font-medium leading-[25.5px] text-graphite filter-[url(#graphite)]">{goalTitle}</span>
      </div>
    </div>
  );
}
