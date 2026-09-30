import { useEffect, useRef, useState } from 'react';

// A slim sticky title bar at the top of every tab page (owner correction):
// the goal as a short one-line title, and nothing else. It stays visible
// while the page scrolls, page colour + grain, no border, with a faint
// pencilled rule appearing under it only once the page has actually
// scrolled (so it reads as "settling onto" the content rather than a
// fixed-forever divider line). The Goal tab shows the goal as its own
// heading, so there `hideTitle` leaves only the bar's height: the page
// starts at the same place on every tab, with nothing stuck over it.
export function TitleBar({ goalTitle, hideTitle }: { goalTitle: string; hideTitle?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current?.closest('section, [data-scroll-root]') ?? ref.current?.parentElement;
    if (!host) return;
    const onScroll = () => setScrolled(host.scrollTop > 2);
    onScroll();
    host.addEventListener('scroll', onScroll, { passive: true });
    return () => host.removeEventListener('scroll', onScroll);
  }, []);

  if (hideTitle) return <div aria-hidden="true" className="mb-6 h-[49.5px]" />;

  return (
    <div
      ref={ref}
      className={`title-bar sticky top-0 z-10 -mx-8.5 mb-6 px-8.5 py-3 md:-mx-16 md:px-16 ${scrolled ? 'title-bar-rule' : ''}`}
    >
      <span className="block truncate font-hand text-[23px] font-medium leading-[25.5px] text-graphite filter-[url(#graphite)]">{goalTitle}</span>
      <style>{`
        .title-bar {
          background: var(--grain), var(--bg);
        }
        .title-bar-rule {
          box-shadow: inset 0 -1px 0 var(--rule);
        }
      `}</style>
    </div>
  );
}
