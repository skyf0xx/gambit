import { useLayoutEffect, useRef, useState } from 'react';
import { hand, hashSeed, strokePath } from '../marks/stroke';

/** A short pencil stroke under its parent's text (the parent must be
 * positioned): about two thirds of the way across, rising a hair, the way
 * a word gets underlined in a hurry. Sized to the parent once laid out.
 * Decorative only. */
export function PencilUnderline({ seed }: { seed: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [w, setW] = useState<number | null>(null);
  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const read = () => setW(parent.offsetWidth);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);
  const len = w ? Math.max(24, w * 0.68) : 0;
  const d = w
    ? strokePath(hand((t) => [1 + t * len, 4.2 - t * 1.6], { n: 16, wobble: 0.35, seed: hashSeed(seed), press: [0.45, 0.45] }), { size: 2, thinning: 0.5 })
    : '';
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-1 left-0 h-[7px] w-full overflow-visible"
      style={{ filter: 'url(#graphite)' }}
    >
      {d && <path d={d} fill="var(--ink)" opacity={0.75} />}
    </svg>
  );
}
