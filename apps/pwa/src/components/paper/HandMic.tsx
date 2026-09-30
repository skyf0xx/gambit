import { hand, strokePath } from '../marks/stroke';

// A microphone drawn in pencil, for the composer's dictation button. Same
// seeded strokes as the page's own marks (marks/stroke.ts), so it reads as
// drawn on the slip rather than as an interface icon. Fixed seeds: the
// drawing never changes between renders.

const TAU = Math.PI * 2;

const PATHS = [
  // The head: a tall oval, overshooting a little where the pencil closes it.
  strokePath(hand((t) => {
    const a = -Math.PI / 2 + t * TAU * 1.06;
    return [12 + Math.cos(a) * 3.3, 8.2 + Math.sin(a) * 5.4];
  }, { n: 36, wobble: 0.18, seed: 11, press: [0.45, 0.4] }), { size: 1.7, thinning: 0.4, taper: false }),
  // The cradle: a U under the head.
  strokePath(hand((t) => {
    const a = Math.PI - t * Math.PI;
    return [12 + Math.cos(a) * 6, 10.6 + Math.sin(a) * 6];
  }, { n: 24, wobble: 0.2, seed: 12 }), { size: 1.7, thinning: 0.4 }),
  // The stem.
  strokePath(hand((t) => [12 + t * 0.2, 16.8 + t * 3.8], { n: 6, wobble: 0.1, seed: 13 }), { size: 1.7, thinning: 0.4, taper: false }),
  // The foot.
  strokePath(hand((t) => [8.4 + t * 7.4, 20.9 - t * 0.3], { n: 8, wobble: 0.15, seed: 14 }), { size: 1.7, thinning: 0.4 }),
];

export function HandMic({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {PATHS.map((d, i) => <path key={i} d={d} fill="currentColor" />)}
    </svg>
  );
}
