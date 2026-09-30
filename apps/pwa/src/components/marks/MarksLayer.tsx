import { useEffect, useRef, useState } from 'react';
import { useMarksContext } from './context';
import { session } from '../../lib/session';
import {
  arrowPoints,
  boxPoints,
  ellipsePoints,
  hashSeed,
  highlightPoints,
  squigglePoints,
  strikePoints,
  starPoints,
  strokePath,
  tickPoints,
  unionBox,
  type Box,
  type Point,
} from './stroke';
import type { LinePath } from '../../lib/changes';
import type { Mark } from '../../lib/marks/types';

// The two SVG mark layers drawn over/under a page's rendered lines (brand/
// identity.md §05 "Pencil marks" + "Building it"). Positions come from the
// real DOM layout — one rect per `[data-line]` element — never from
// synthetic coordinates. Ported from brand/mockups/marks.js.

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const MARGIN_X = 17; // fallback margin strip width, mirroring the mockup's default

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia(REDUCED_MOTION_QUERY).matches;
}

function rel(r: DOMRect, origin: DOMRect): Box {
  return { l: r.left - origin.left, t: r.top - origin.top, r: r.right - origin.left, b: r.bottom - origin.top, w: r.width, h: r.height };
}

/** One box per visually rendered line inside `el`, merging fragments on the same baseline. */
function lineRects(el: Element, origin: DOMRect): Box[] {
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = [...range.getClientRects()].filter((r) => r.width > 1).map((r) => rel(r, origin));
  const lines: Box[] = [];
  for (const r of rects) {
    const same = lines.find((x) => Math.abs(x.b - r.b) < 4);
    if (same) {
      same.l = Math.min(same.l, r.l);
      same.r = Math.max(same.r, r.r);
      same.t = Math.min(same.t, r.t);
      same.w = same.r - same.l;
    } else {
      lines.push({ ...r });
    }
  }
  return lines;
}

function css(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function svgNS<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

interface Placed {
  path: LinePath;
  mark: Mark;
  el: Element;
  lines: Box[];
}

export function MarksLayer() {
  const ctx = useMarksContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const underRef = useRef<SVGSVGElement>(null);
  const overRef = useRef<SVGSVGElement>(null);
  const [tick, forceTick] = useState(0);

  // Schedule a redraw (debounced) on resize, font load, and colour-scheme
  // change — bumping `tick` is the only thing this effect does; the actual
  // drawing lives in the effect below, keyed on `tick` plus the derived
  // marks so it never draws against a stale layout or a stale mark set.
  useEffect(() => {
    const host = containerRef.current?.parentElement;
    if (!host) return;
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(t);
      t = setTimeout(() => forceTick((n) => n + 1), 30);
    };
    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(host);
    document.fonts?.ready?.then(schedule).catch(() => {});
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      mq.removeEventListener('change', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [ctx?.derived]);

  useEffect(() => {
    const host = containerRef.current?.parentElement;
    const under = underRef.current;
    const over = overRef.current;
    if (!host || !under || !over || !ctx) return;

    under.innerHTML = '';
    over.innerHTML = '';
    const defs = svgNS('defs');
    over.appendChild(defs);

    const origin = host.getBoundingClientRect();
    under.setAttribute('width', String(origin.width));
    under.setAttribute('height', String(origin.height));
    over.setAttribute('width', String(origin.width));
    over.setAttribute('height', String(origin.height));

    const ink = css('--ink') || '#1F2733';
    const pencil = css('--graphite') || '#6B665D';
    const accent = css('--accent') || '#B83A26';
    const hi = css('--hi') || 'rgba(250, 214, 80, .55)';
    const reduced = prefersReducedMotion();

    function drawStroke(
      pts: Point[],
      into: SVGSVGElement,
      opts: { color?: string; size?: number; thinning?: number; grain?: boolean; taper?: boolean; opacity?: number } = {},
    ): SVGPathElement {
      const { color = pencil, size = 1.8, thinning = 0.6, grain = true, taper = true, opacity = 1 } = opts;
      const g = svgNS('g', grain ? { filter: 'url(#graphite)' } : {});
      const p = svgNS('path', { d: strokePath(pts, { size, thinning, taper }), fill: color, opacity });
      g.appendChild(p);
      into.appendChild(g);
      return p;
    }

    let maskId = 0;
    function drawIn(path: SVGPathElement, pts: Point[], durMs = 900, delayMs = 0, width = 16) {
      const id = `reveal-${maskId++}`;
      const mask = svgNS('mask', {
        id,
        maskUnits: 'userSpaceOnUse',
        x: -50,
        y: -50,
        width: origin.width + 100,
        height: origin.height + 100,
      });
      const line = svgNS('path', {
        d: 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L'),
        fill: 'none',
        stroke: '#fff',
        'stroke-width': width,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        pathLength: 1,
        'stroke-dasharray': 1,
        'stroke-dashoffset': 1,
      });
      mask.appendChild(line);
      defs.appendChild(mask);
      path.setAttribute('mask', `url(#${id})`);
      line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
        duration: durMs,
        delay: delayMs,
        easing: 'cubic-bezier(.55,.1,.35,1)',
        fill: 'forwards',
      });
    }

    // Gather placements: one DOM element per known path, with its live rects.
    const placed: Placed[] = [];
    ctx.derived.byPath.forEach((mark, path) => {
      const el = host.querySelector(`[data-line="${cssEscape(path)}"]`);
      if (!el) return;
      const lines = lineRects(el, origin);
      if (!lines.length) return;
      placed.push({ path, mark, el, lines });
    });

    const marginX = MARGIN_X;

    for (const { path, mark, lines } of placed) {
      const seed = hashSeed(path);

      if (mark.kind === 'tick') {
        const box = lines[0];
        const lineEl = placed.find((p) => p.path === path)?.el;
        const boxEl = lineEl?.querySelector('[data-box], .box') ?? null;
        const target = boxEl ? rel(boxEl.getBoundingClientRect(), origin) : box;
        for (const side of boxPoints(target, seed)) {
          drawStroke(side, over, { size: 1.5, thinning: 0.45, taper: false, grain: false, opacity: 0.85 });
        }
        drawStroke(tickPoints(target), over, { color: ink, size: 2.6, thinning: 0.6, grain: false });
      }

      if (mark.kind === 'highlight') {
        lines.forEach((L, j) => {
          drawStroke(highlightPoints(L, seed + j), under, {
            color: hi,
            size: L.h * 0.72,
            thinning: 0.05,
            grain: false,
            taper: false,
          });
        });
      }

      if (mark.kind === 'squiggle') {
        lines.forEach((L, j) => {
          drawStroke(squigglePoints(L, seed + j), over, { size: 1.5, thinning: 0.5 });
        });
      }

      if (mark.kind === 'eraser') {
        lines.forEach((L, j) => {
          drawStroke(strikePoints(L, seed + j), over, { size: 1.7 });
        });
      }

      if (mark.kind === 'star') {
        const L = lines[0];
        drawStroke(starPoints(marginX, L, seed), over, { size: 1.6, thinning: 0.4 });
      }

      if (mark.kind === 'question') {
        const L = lines[0];
        const t = svgNS('text', {
          x: marginX,
          y: L.b - 3,
          'text-anchor': 'middle',
          fill: pencil,
          filter: 'url(#graphite)',
          'font-family': 'Caveat, cursive',
          'font-size': 30,
          'font-weight': 600,
          transform: `rotate(-6 ${marginX} ${L.b})`,
        });
        t.textContent = '?';
        over.appendChild(t);
      }

      if (mark.kind === 'loop') {
        const pts = ellipsePoints(unionBox(lines), seed);
        const p = drawStroke(pts, over, { color: accent, size: 2.3, thinning: 0.55 });
        const turn = session.getSnapshot().turn;
        const first = turn?.lines[0];
        // Only draw/animate if the line still exists and its text still
        // matches turn.lines[0].text (indices can shift between renders).
        const el = placed.find((pl) => pl.path === path)?.el;
        const textMatches = first ? (el?.textContent ?? '').trim() === first.text.trim() : false;
        if (textMatches && !turn?.animated && !reduced) {
          drawIn(p, pts, 1100, 450, 14);
          session.markAnimated();
        }
        el?.addEventListener(
          'pointerdown',
          () => session.clearLoop(),
          { once: true },
        );
      }

      if (mark.kind === 'arrow' && mark.to) {
        // deriveMarks already picked the single dependsOn risk that gets a
        // drawn arrow; every other one is `arrow-text` and never reaches
        // here. If this one can't actually be drawn (no in-DOM target, or
        // its ends are more than a screen apart), it silently draws nothing
        // — an edge case the single-arrow selection in derive.ts doesn't
        // anticipate — rather than falling back to text, since Sections only
        // renders "→ Name" for `arrow-text`.
        const targetPlacement = placed.find((pl) => pl.path === mark.to);
        if (!targetPlacement) continue;
        const from = lines[0];
        const to = targetPlacement.lines[0];
        const apart = Math.abs(to.t - from.t) > window.innerHeight;
        if (apart) continue;
        const { shaft, head1, head2 } = arrowPoints(marginX, from, to, seed);
        drawStroke(shaft, over, { size: 1.5, thinning: 0.5 });
        drawStroke(head1, over, { size: 1.5 });
        drawStroke(head2, over, { size: 1.5 });
        break; // only one arrow visible at a time
      }
    }

    // Hover circles: delegated pointerenter/focusin on [data-circle].
    const circles = new Map<Element, { g: SVGGElement; fadeTimer?: ReturnType<typeof setTimeout> }>();
    const onEnter = (e: Event) => {
      const target = (e.target as Element)?.closest('[data-circle]');
      if (!target || !host.contains(target)) return;
      const lines = lineRects(target, origin);
      if (!lines.length) return;
      const existing = circles.get(target);
      existing?.g.remove();
      const seed = hashSeed(`circle:${Array.from(host.querySelectorAll('[data-circle]')).indexOf(target)}`);
      const pts = ellipsePoints(unionBox(lines), seed, 1.05, [9, 5]);
      const p = drawStroke(pts, over, { size: 1.5, thinning: 0.5 });
      const g = p.parentNode as SVGGElement;
      circles.set(target, { g });
      if (!reduced) drawIn(p, pts, 380, 0, 10);
    };
    const onLeave = (e: Event) => {
      const target = (e.target as Element)?.closest('[data-circle]');
      if (!target) return;
      const entry = circles.get(target);
      if (!entry) return;
      circles.delete(target);
      entry.g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }).onfinish = () => entry.g.remove();
    };
    host.addEventListener('pointerenter', onEnter, true);
    host.addEventListener('focusin', onEnter, true);
    host.addEventListener('pointerleave', onLeave, true);
    host.addEventListener('focusout', onLeave, true);

    return () => {
      host.removeEventListener('pointerenter', onEnter, true);
      host.removeEventListener('focusin', onEnter, true);
      host.removeEventListener('pointerleave', onLeave, true);
      host.removeEventListener('focusout', onLeave, true);
    };
    // `tick` drives redraws for resize/fonts.ready/colour-scheme (bumped by
    // the effect above); `ctx?.derived` drives redraws when the marks
    // themselves change (goal edits, turn state, dropped lines).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ctx?.derived]);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0" aria-hidden="true">
      <svg ref={underRef} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true" />
      <svg ref={overRef} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true" />
    </div>
  );
}

function cssEscape(s: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}
