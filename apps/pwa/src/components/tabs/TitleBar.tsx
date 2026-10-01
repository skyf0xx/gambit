import { useEffect, useRef } from 'react';
import { useTornEdge } from '../marks/torn';

// A slim sticky title bar at the top of every tab page (owner correction):
// the goal as a short one-line title, and nothing else. It stays visible
// while the page scrolls — a slip of paper torn along its bottom edge, the
// mirror of the chat composer's torn top, so the page scrolls between two
// torn strips. Its shadow is cast from a wrapper, since the tear is a
// clip-path that would cut off a shadow on the slip itself. The Goal tab
// shows the goal as its own heading, so there `hideTitle` leaves only the
// bar's height: the page starts at the same place on every tab, with
// nothing stuck over it.
export function TitleBar({ goalTitle, hideTitle }: { goalTitle: string; hideTitle?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useTornEdge(ref, 'title-bar', 'bottom');

  if (hideTitle) return <div aria-hidden="true" className="mb-6 h-[53.5px]" />;

  return (
    <div
      className="sticky top-0 z-10 -mx-8.5 mb-6 md:-mx-16"
      style={{ filter: 'drop-shadow(0 2px 2px var(--lift-far)) drop-shadow(0 8px 14px var(--lift-far))' }}
    >
      <div ref={ref} className="slip px-8.5 pt-3 pb-4 md:px-16" style={{ clipPath: 'var(--torn, none)' }}>
        <span className="block truncate font-hand text-[23px] font-medium leading-[25.5px] text-graphite filter-[url(#graphite)]">{goalTitle}</span>
      </div>
    </div>
  );
}
