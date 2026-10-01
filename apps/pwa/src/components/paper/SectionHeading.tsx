import type { ReactNode } from 'react';
import { hand, hashSeed, strokePath, type Point } from '../marks/stroke';
import { FreshSectionTag } from './FreshTag';

// The page's section heading: Inter 24/32, with a short pencil stroke
// underneath once the section has something in it. A few sections also
// carry a small pencil glyph ahead of the title (brand/identity.md §07:
// icons only where they help tell sections apart, drawn in pencil like
// every other mark rather than taken from an icon set). Glyphs are seeded
// per section key, so they don't reshuffle between renders.

type XY = [number, number];

/** Sample a polyline evenly by length, so hand() can wobble along it as one stroke. */
function along(pts: XY[]): (t: number) => XY {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  return (t) => {
    let d = t * total;
    for (let i = 0; i < lens.length; i++) {
      if (d <= lens[i] || i === lens.length - 1) {
        const k = lens[i] ? Math.min(1, d / lens[i]) : 0;
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
      }
      d -= lens[i];
    }
    return pts[pts.length - 1];
  };
}

/** Points on a quadratic curve, for the one glyph stroke that bends. */
const quad = (a: XY, c: XY, b: XY, n = 12): XY[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
  });

// Each glyph is a handful of pencil strokes on a 24×24 grid.
const GLYPHS: Record<string, XY[][]> = {
  // A fork in the road: one path splitting two ways.
  decisions: [
    [[3, 12], [11, 12]],
    [[11, 12], [20, 5]],
    [[11, 12], [20, 19]],
  ],
  // A flask, with a line of liquid in it.
  experiments: [
    [[9, 3], [9, 10], [3, 20.5], [21, 20.5], [15, 10], [15, 3]],
    [[7.5, 3], [16.5, 3]],
    [[6.2, 15.5], [17.8, 15.5]],
  ],
  // A throw arcing toward where it lands.
  forecasts: [
    quad([3, 20], [7, 5], [19, 7]),
    [[14.5, 4.5], [19, 7], [15, 10.5]],
  ],
  // A lever on its fulcrum: small push, big move.
  systemsNotes: [
    [[2, 17.5], [22, 8.5]],
    [[10, 14.5], [6.5, 20.5], [13.5, 20.5], [10, 14.5]],
  ],
};

export const hasGlyph = (k: string) => k in GLYPHS;

export function SectionGlyph({ k, className = '' }: { k: string; className?: string }) {
  const strokes = GLYPHS[k];
  if (!strokes) return null;
  const seed = hashSeed(`glyph:${k}`);
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`} style={{ filter: 'url(#graphite)' }}>
      {strokes.map((pts, i) => {
        const n = Math.max(8, Math.round(pts.length * 6));
        const line: Point[] = hand(along(pts), { n, wobble: 0.25, seed: seed + i, press: [0.45, 0.4] });
        return <path key={i} d={strokePath(line, { size: 1.9, thinning: 0.45, taper: false })} fill="var(--graphite)" />;
      })}
    </svg>
  );
}

/** A short pencil stroke under a filled section's heading. */
export function PencilRule({ seed }: { seed: string }) {
  const pts = hand((t) => [2 + t * 44, 3.6 - t * 1.2], { n: 14, wobble: 0.35, seed: hashSeed(`rule:${seed}`), press: [0.4, 0.45] });
  return (
    <svg width="48" height="7" viewBox="0 0 48 7" aria-hidden="true" className="block" style={{ filter: 'url(#graphite)' }}>
      <path d={strokePath(pts, { size: 1.8, thinning: 0.5 })} fill="var(--graphite)" opacity={0.8} />
    </svg>
  );
}

/** Sections whose own content heads them, so their title is only a small
 * label, like the index card's "Your top move": the plan, whose line names
 * already sit at the top of it in pencil. */
const QUIET = new Set(['plan']);

/** Heading for one section on the page. `empty` sections stay graphite and
 * regular weight, with no rule: a section with nothing in it shouldn't lead. */
export function SectionHeading({ k, children, after, empty }: { k: string; children: ReactNode; after?: ReactNode; empty?: boolean }) {
  if (QUIET.has(k)) {
    return (
      <div className="flex items-baseline gap-x-2">
        <h2 className="text-[14px] leading-5 text-graphite">{children}</h2>
        <FreshSectionTag k={k} />
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 className={`font-sans text-[24px] leading-8 ${empty ? 'text-graphite' : 'font-semibold'}`}>
          {hasGlyph(k) && <SectionGlyph k={k} className="mr-2 inline-block align-[-2px]" />}
          {children}
        </h2>
        {after}
        <FreshSectionTag k={k} />
      </div>
      {!empty && <PencilRule seed={k} />}
    </div>
  );
}
