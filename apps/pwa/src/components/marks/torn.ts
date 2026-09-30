import { useEffect, useRef, type RefObject } from 'react';
import { hashSeed, rng } from './stroke';

// The torn-edge effect (brand/identity.md §05 "Building it": "a clip-path
// polygon generated from the element's width"). Ported from brand/mockups/
// marks.js's `tear()`. Seeded per element so it doesn't reshuffle on every
// resize; recomputed when the element's width actually changes.

function tornPolygon(width: number, seed: number, edge: 'top' | 'bottom'): string {
  const r = rng(seed);
  const pts: string[] = [];
  for (let x = 0; x <= width; x += 3 + r() * 5) {
    const depth = 1 + r() * 4 + (r() < 0.15 ? 2 : 0);
    pts.push(`${x.toFixed(1)}px ${depth.toFixed(1)}px`);
  }
  pts.push(`${width}px 3px`, '100% 100%', '0 100%');
  const top = `polygon(${pts.join(',')})`;
  if (edge === 'top') return top;
  // Mirror vertically for a torn bottom edge.
  const bottomPts: string[] = [];
  for (let x = 0; x <= width; x += 3 + r() * 5) {
    const depth = 1 + r() * 4 + (r() < 0.15 ? 2 : 0);
    bottomPts.push(`${x.toFixed(1)}px calc(100% - ${depth.toFixed(1)}px)`);
  }
  bottomPts.push(`${width}px calc(100% - 3px)`, '100% 0', '0 0');
  return `polygon(${bottomPts.join(',')})`;
}

/**
 * Apply a seeded torn-edge clip-path to `ref`'s element, recomputed on
 * resize. `seed` is a stable string (e.g. a slip's id or kind) so the tear
 * shape stays put across renders.
 */
export function useTornEdge(ref: RefObject<HTMLElement | null>, seed: string, edge: 'top' | 'bottom'): void {
  const seedNum = useRef(hashSeed(seed));
  seedNum.current = hashSeed(seed);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const apply = () => {
      const width = el.offsetWidth;
      if (width <= 0) return;
      el.style.setProperty('--torn', tornPolygon(width, seedNum.current, edge));
    };

    apply();

    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref.current, edge]);
}
