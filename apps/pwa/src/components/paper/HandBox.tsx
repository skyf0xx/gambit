import { boxPoints, hashSeed, strokePath, tickPoints, type Box } from '../marks/stroke';

// A hand-drawn checkbox drawn in place, for a box that sits on a slip. The
// marks layer draws the page's own boxes, but it sits beneath the page's
// content, so a slip's opaque surface would cover anything it drew there.
// Same geometry and stroke weights as the marks layer's box and tick
// (MarksLayer.tsx), so the two read as the same pencil and the same ink.

const SIZE = 18;
const BOX: Box = { l: 0, t: 0, r: SIZE, b: SIZE, w: SIZE, h: SIZE };
// The tick overshoots the box up and to the right, so the drawing area is
// a little larger than the box itself.
const PAD = { l: 4, t: 8, r: 8, b: 4 };
const W = SIZE + PAD.l + PAD.r;
const H = SIZE + PAD.t + PAD.b;
const svgProps = {
  width: W,
  height: H,
  viewBox: `${-PAD.l} ${-PAD.t} ${W} ${H}`,
  className: 'pointer-events-none absolute max-w-none',
  style: { left: -PAD.l, top: -PAD.t },
};

export function HandBox({ seed, checked, className = '' }: { seed: string; checked: boolean; className?: string }) {
  return (
    <span className={`box ${className}`} aria-hidden="true">
      <svg {...svgProps}>
        {boxPoints(BOX, hashSeed(seed)).map((side, i) => (
          <path key={i} d={strokePath(side, { size: 1.5, thinning: 0.45, taper: false })} fill="var(--graphite)" opacity={0.85} />
        ))}
      </svg>
      {checked && (
        <svg {...svgProps} className={`${svgProps.className} anim-write`} style={{ ...svgProps.style, animationDuration: '180ms' }}>
          <path d={strokePath(tickPoints(BOX), { size: 2.6, thinning: 0.6 })} fill="var(--ink)" />
        </svg>
      )}
    </span>
  );
}
