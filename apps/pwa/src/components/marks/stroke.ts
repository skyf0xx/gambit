import { getStroke } from 'perfect-freehand';

// Seeded stroke geometry for the pencil-marks layer (brand/identity.md §05
// "Building it": "Randomness is seeded per line, so marks don't reshuffle
// between renders."). Ported from brand/mockups/marks.js — perfect-freehand
// is imported from npm here, never a CDN.

export type Point = [number, number, number?];

/** Hash a string (a line path) into a stable 32-bit seed. */
export function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return h;
}

/** Deterministic PRNG (mulberry32-style, matching the mockup's rng). */
export function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const avg = (a: number, b: number) => (a + b) / 2;

/** Build a smoothed closed SVG path `d` from perfect-freehand's outline points. */
export function outline(points: number[][]): string {
  if (points.length < 4) return '';
  let [a, b, c] = points;
  let d = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${avg(b[0], c[0]).toFixed(2)},${avg(b[1], c[1]).toFixed(2)} T`;
  for (let i = 2; i < points.length - 1; i++) {
    a = points[i];
    b = points[i + 1];
    d += `${avg(a[0], b[0]).toFixed(2)},${avg(a[1], b[1]).toFixed(2)} `;
  }
  return d + 'Z';
}

export interface HandOptions {
  n?: number;
  wobble?: number;
  seed?: number;
  press?: [number, number];
}

/** Sample a curve f(t) -> [x, y] with a hand's slow wobble and a pressure arc. */
export function hand(f: (t: number) => [number, number], opts: HandOptions = {}): Point[] {
  const { n = 40, wobble = 0.6, seed = 1, press = [0.3, 0.55] } = opts;
  const r = rng(seed);
  const ph = r() * 6;
  const ph2 = r() * 6;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const [x, y] = f(t);
    return [
      x + Math.sin(t * 5 + ph) * wobble,
      y + Math.sin(t * 7 + ph2) * wobble,
      press[0] + press[1] * Math.sin(Math.PI * t),
    ] as Point;
  });
}

export interface StrokePathOptions {
  size?: number;
  thinning?: number;
  taper?: boolean;
}

/** perfect-freehand outline `d` attribute for a hand-drawn set of points. */
export function strokePath(pts: Point[], opts: StrokePathOptions = {}): string {
  const { size = 1.8, thinning = 0.6, taper = true } = opts;
  return outline(
    getStroke(pts as number[][], {
      size,
      thinning,
      smoothing: 0.6,
      streamline: 0.35,
      simulatePressure: false,
      start: { taper: taper ? size * 6 : 0, cap: true },
      end: { taper: taper ? size * 9 : 0, cap: true },
    }),
  );
}

export interface Box {
  l: number;
  r: number;
  t: number;
  b: number;
  w: number;
  h: number;
}

/** Union bounding box of a set of line rects. */
export function unionBox(lines: Box[]): Box {
  const l = Math.min(...lines.map((x) => x.l));
  const r = Math.max(...lines.map((x) => x.r));
  const t = Math.min(...lines.map((x) => x.t));
  const b = Math.max(...lines.map((x) => x.b));
  return { l, r, t, b, w: r - l, h: b - t };
}

/** A hand-drawn ellipse ring around a box (the loop, and hover circles). */
export function ellipsePoints(box: Box, seed: number, turns = 1.12, pad: [number, number] = [10, 7]): Point[] {
  const cx = (box.l + box.r) / 2;
  const cy = (box.t + box.b) / 2;
  const rx = box.w / 2 + pad[0];
  const ry = box.h / 2 + pad[1];
  const squash = 0.92 + rng(seed)() * 0.1;
  return hand(
    (t) => {
      const a = -2.5 + t * Math.PI * 2 * turns;
      const shrink = 1 - t * 0.07;
      return [cx + Math.cos(a) * rx * shrink, cy + Math.sin(a) * ry * shrink * squash - t * 3];
    },
    { n: 70, wobble: 0.9, seed, press: [0.35, 0.6] },
  );
}

/** A highlighter swipe behind one line of text. */
export function highlightPoints(line: Box, seed: number): Point[] {
  const y = line.t + line.h * 0.6;
  return hand((t) => [line.l - 5 + t * (line.w + 10), y + 1.5 - t * 2.5], {
    n: 16,
    wobble: 0.8,
    seed,
    press: [0.9, 0.1],
  });
}

/** A squiggly underline beneath one line of text. */
export function squigglePoints(line: Box, seed: number): Point[] {
  return hand((t) => [line.l + t * line.w, line.b + 1 + Math.sin((t * line.w) / 3.2) * 1.8], {
    n: Math.max(4, Math.round(line.w / 1.5)),
    wobble: 0.3,
    seed,
  });
}

/** A loose pencil zigzag through one line of text (cancelled/dropped). */
export function zigzagPoints(line: Box, seed: number): Point[] {
  const y = line.t + line.h * 0.56;
  const amp = Math.max(3, line.h * 0.22);
  const teeth = Math.max(3, Math.round(line.w / 22));
  return hand(
    (t) => [line.l - 4 + t * (line.w + 8), y + Math.sin(t * teeth * Math.PI) * amp],
    { n: teeth * 6, wobble: 0.6, seed, press: [0.4, 0.5] },
  );
}

/** A five-point star in the margin, next to one line of text. */
export function starPoints(cx: number, line: Box, seed: number, r = 8): Point[] {
  const cy = line.t + line.h / 2;
  const tips: [number, number][] = [0, 2, 4, 1, 3, 0].map((k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  const rnd = rng(seed);
  const pts: Point[] = [];
  for (let k = 0; k < tips.length - 1; k++) {
    for (let s = 0; s < 6; s++) {
      pts.push([
        tips[k][0] + (tips[k + 1][0] - tips[k][0]) * (s / 6) + (rnd() - 0.5) * 0.8,
        tips[k][1] + (tips[k + 1][1] - tips[k][1]) * (s / 6) + (rnd() - 0.5) * 0.8,
      ]);
    }
  }
  pts.push([...tips.at(-1)!]);
  return pts.map((p, k) => [p[0], p[1], 0.4 + 0.4 * Math.sin((Math.PI * k) / pts.length)]);
}

/** A hand-drawn checkbox outline (four sides, slightly overshot corners). */
export function boxPoints(box: Box, seed: number): Point[][] {
  const r = rng(seed);
  const j = () => (r() - 0.5) * 1.6;
  const c: [number, number][] = [
    [box.l + j(), box.t + j()],
    [box.r + j(), box.t + j()],
    [box.r + j(), box.b + j()],
    [box.l + j(), box.b + j()],
  ];
  const sides: Point[][] = [];
  for (let s = 0; s < 4; s++) {
    const a = c[s];
    const z = c[(s + 1) % 4];
    const over = s === 3 ? 0.18 : 0.08;
    sides.push(
      hand(
        (t) => [
          a[0] + (z[0] - a[0]) * (t * (1 + over) - over / 2),
          a[1] + (z[1] - a[1]) * (t * (1 + over) - over / 2),
        ],
        { n: 10, wobble: 0.35, seed: seed + s },
      ),
    );
  }
  return sides;
}

/** The ink tick drawn over a hand-drawn checkbox once it's done. */
export function tickPoints(box: Box): Point[] {
  const tick: [number, number][] = [
    [box.l + 3, box.t + box.h * 0.5],
    [box.l + box.w * 0.42, box.b - 2],
    [box.r + 5, box.t - 6],
  ];
  const pts: Point[] = [];
  for (let s = 0; s < 2; s++) {
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      const a = tick[s];
      const z = tick[s + 1];
      pts.push([a[0] + (z[0] - a[0]) * t, a[1] + (z[1] - a[1]) * t, s ? 0.8 - t * 0.5 : 0.4 + t * 0.4]);
    }
  }
  return pts;
}

/** Out through the margin and back — the two curve segments plus arrowhead. */
export function arrowPoints(marginX: number, from: Box, to: Box, seed: number) {
  const s: [number, number] = [from.l - 12, from.t + from.h / 2];
  const e: [number, number] = [to.l - 8, to.t + to.h / 2];
  const c1: [number, number] = [marginX - 4, s[1]];
  const c2: [number, number] = [marginX - 4, e[1]];
  const bez = (t: number): [number, number] => {
    const u = 1 - t;
    return [0, 1].map(
      (k) => u * u * u * s[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * e[k],
    ) as [number, number];
  };
  const shaft = hand(bez, { n: 60, wobble: 0.8, seed });
  const up = e[1] < s[1] ? 1 : -1;
  const head1 = hand((t) => [e[0] - 9 + t * 9, e[1] + 6 * up - t * 6 * up], { n: 8, wobble: 0.2, seed: seed + 1 });
  const head2 = hand((t) => [e[0] - 10 + t * 10, e[1] - 5 * up + t * 5 * up], { n: 8, wobble: 0.2, seed: seed + 2 });
  return { shaft, head1, head2 };
}
