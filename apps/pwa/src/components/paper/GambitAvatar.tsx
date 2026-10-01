import { hand, strokePath } from '../marks/stroke';

// Gambit's mark beside its turns in the conversation: the accent "!?"
// (brand/identity.md §02) inside a pencilled ring. Same seeded strokes as
// the page's own marks, so the ring never changes between renders.

const TAU = Math.PI * 2;

const RING = strokePath(hand((t) => {
  const a = -Math.PI / 2 + t * TAU * 1.05;
  return [16 + Math.cos(a) * 13.5, 16 + Math.sin(a) * 13.5];
}, { n: 48, wobble: 0.25, seed: 21, press: [0.45, 0.4] }), { size: 1.4, thinning: 0.4, taper: false });

export function GambitAvatar({ size = 32 }: { size?: number }) {
  return (
    <span aria-hidden="true" className="relative grid flex-none place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 32 32" className="absolute inset-0 text-graphite">
        <path d={RING} fill="currentColor" />
      </svg>
      <span className="font-hand text-[19px] leading-none font-semibold text-accent">!?</span>
    </span>
  );
}
