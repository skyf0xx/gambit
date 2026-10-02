import { hand, strokePath } from '../marks/stroke';

// Gambit's portrait beside its turns in the conversation, inside a
// pencilled ring. Same seeded strokes as the page's own marks, so the ring
// never changes between renders.

const TAU = Math.PI * 2;

const RING = strokePath(hand((t) => {
  const a = -Math.PI / 2 + t * TAU * 1.05;
  return [16 + Math.cos(a) * 14.6, 16 + Math.sin(a) * 14.6];
}, { n: 48, wobble: 0.25, seed: 21, press: [0.45, 0.4] }), { size: 1.2, thinning: 0.4, taper: false });

export function GambitAvatar({ size = 32 }: { size?: number }) {
  return (
    <span aria-hidden="true" className="relative block flex-none" style={{ width: size, height: size }}>
      <img src="/avatar.webp" alt="" width={size} height={size} draggable={false} className="absolute inset-[1px] h-[calc(100%-2px)] w-[calc(100%-2px)] rounded-full object-cover" />
      <svg width={size} height={size} viewBox="0 0 32 32" className="absolute inset-0 text-graphite">
        <path d={RING} fill="currentColor" />
      </svg>
    </span>
  );
}
