// The two inline SVG filters every pencil/ink mark references by url(#id)
// (brand/identity.md §05 "Building it"). Mounted once in App.tsx. Graphite
// punches noise holes in pencil strokes and adds a slight wobble; bleed
// displaces ink edges by under 1px. Ported from brand/mockups/marks.js —
// never loaded from a CDN.
export function Filters() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id="graphite" x="-5%" y="-20%" width="110%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves={2} seed={3} result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.9 0 0 0 1.6" result="holes" />
        <feComposite in="SourceGraphic" in2="holes" operator="in" result="grainy" />
        <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves={1} seed={9} result="w" />
        <feDisplacementMap in="grainy" in2="w" scale={1.1} xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id="bleed" x="-2%" y="-10%" width="104%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={1} seed={2} result="w" />
        <feDisplacementMap in="SourceGraphic" in2="w" scale={0.9} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
