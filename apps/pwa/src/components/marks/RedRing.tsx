import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ellipsePoints, hashSeed, strokePath } from './stroke';

/** A resting red pen ring around its children, for the one suggestion
 * that must not be missed (defining a new goal). Drawn by itself, so it
 * works off the page's marks layer too (the empty chat). */
export function RedRing({ children, seed = 'ring' }: { children: ReactNode; seed?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const d = size && size.w > 0
    ? strokePath(ellipsePoints({ l: 0, t: 0, r: size.w, b: size.h, w: size.w, h: size.h }, hashSeed(seed), 1.05, [9, 5]), { size: 2, thinning: 0.5 })
    : '';
  return (
    <span ref={ref} className="relative inline-block">
      {children}
      {d && (
        <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 overflow-visible" width={size!.w} height={size!.h}>
          <path d={d} fill="var(--accent)" />
        </svg>
      )}
    </span>
  );
}
