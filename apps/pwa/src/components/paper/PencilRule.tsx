import { useLayoutEffect, useRef, useState } from 'react';
import { hand, hashSeed, strokePath } from '../marks/stroke';

/** How a ruled line is drawn: `ink` for one passed (gone over in ink),
 * `pencil` for the one the line is heading to, `faint` for one further on
 * (a light broken pencil line, not drawn in yet). */
export type RuleTone = 'ink' | 'pencil' | 'faint';

const DASH = 7;
const GAP = 6;

/** A hand-ruled line across its box, the way a notebook draws a line under
 * a column of figures. Fills its parent's width once laid out. Decorative
 * only. */
export function PencilRule({ seed, tone }: { seed: string; tone: RuleTone }) {
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
  const s = hashSeed(seed);
  const stroke = (x0: number, x1: number, k: number) =>
    strokePath(hand((t) => [x0 + t * (x1 - x0), 4 + Math.sin(t * 3 + k) * 0.4], { n: Math.max(4, Math.round((x1 - x0) / 12)), wobble: 0.3, seed: s + k, press: [0.5, 0.5] }), {
      size: tone === 'ink' ? 1.8 : 1.6,
      thinning: 0.3,
      taper: tone === 'faint',
    });
  const paths: string[] = [];
  if (w) {
    if (tone === 'faint') {
      for (let x = 0, k = 0; x < w - 2; x += DASH + GAP, k++) paths.push(stroke(x, Math.min(x + DASH, w), k));
    } else {
      paths.push(stroke(0, w, 0));
    }
  }
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none block h-2 w-full overflow-visible"
      style={tone === 'ink' ? undefined : { filter: 'url(#graphite)' }}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} fill={tone === 'ink' ? 'var(--ink)' : 'var(--graphite)'} opacity={tone === 'faint' ? 0.75 : 0.95} />
      ))}
    </svg>
  );
}
