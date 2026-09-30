import { useEffect, useRef, useState } from 'react';

// A slim sticky title bar at the top of every tab page (owner correction):
// the wordmark plus the goal as a short one-line title, stays visible while
// the page scrolls, page colour + grain, no border, with a faint pencilled
// rule appearing under it only once the page has actually scrolled (so it
// reads as "settling onto" the content rather than a fixed-forever divider
// line). This replaces the old in-page header (PageHeader in MovesTab.tsx),
// which carried only the wordmark; the menu icon it used to carry moved to
// the Inside cover tab.
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

  return (
    <div
      ref={ref}
      className={`title-bar sticky top-0 z-10 -mx-8.5 mb-6 flex items-center justify-between gap-3 px-8.5 py-3 md:-mx-16 md:px-16 ${scrolled ? 'title-bar-rule' : ''}`}
    >
      <span className="font-serif text-[17px] font-semibold text-ink">gambit</span>
      {!hideTitle && (
        <span className="min-w-0 flex-1 truncate text-right font-serif text-[17px] text-ink">{goalTitle}</span>
      )}
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
