import { useLayoutEffect, useRef, useState } from 'react';
import { ellipsePoints, hashSeed, strokePath } from '../marks/stroke';

/** A hand-drawn pencil loop around its parent (which must be positioned):
 * the same loop the marks layer draws round a line, sized to the parent
 * once it's laid out. Decorative only. */
export function PencilLoop({ seed }: { seed: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const read = () => setSize({ w: parent.offsetWidth, h: parent.offsetHeight });
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);
  // The loop hugs the text, not the full 44px tap area.
  const inset = size ? Math.max(0, (size.h - 26) / 2) : 0;
  const d = size
    ? strokePath(ellipsePoints({ l: 4, t: inset, r: size.w - 4, b: size.h - inset, w: size.w - 8, h: size.h - inset * 2 }, hashSeed(seed), 1.08, [6, 5]), { size: 1.4, thinning: 0.5 })
    : '';
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      style={{ filter: 'url(#graphite)' }}
    >
      {d && <path d={d} fill="var(--ink)" opacity={0.7} />}
    </svg>
  );
}
