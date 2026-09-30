import { useEffect, useRef, useState } from 'react';
import { useMarksContext } from './context';
import { session } from '../../lib/session';
import {
  arrowPoints,
  boxPoints,
  ellipsePoints,
  hashSeed,
  highlightPoints,
  zigzagPoints,
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

/** One box per visually rendered line inside `el`, merging fragments on the
 * same baseline. Measured text node by text node so screen-reader-only text
 * is left out: it's clipped to 1px on screen, but its text still reports its
 * full unclipped width and would stretch a highlight or strike past the
 * words it belongs to. An empty element (a checkbox slot) counts by its own
 * box, as it did when the whole element was measured at once. */
function lineRects(el: Element, origin: DOMRect): Box[] {
  const range = document.createRange();
  const rects: Box[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n: Node | null = walker.currentNode; n; n = walker.nextNode()) {
    const inSrOnly = (n instanceof Element ? n : n.parentElement)?.closest('.sr-only');
    if (inSrOnly) continue;
    let found: Iterable<DOMRect> = [];
    if (n.nodeType === Node.TEXT_NODE) {
      range.selectNodeContents(n);
      found = range.getClientRects();
    } else if (n !== el && n.childNodes.length === 0) {
      found = (n as Element).getClientRects();
    }
    for (const r of found) if (r.width > 1) rects.push(rel(r, origin));
  }
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
  const prevTicksRef = useRef<Set<LinePath> | null>(null);
  const prevCancelsRef = useRef<Set<LinePath> | null>(null);

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
    window.addEventListener('gambit:theme', schedule);
    window.addEventListener('resize', schedule);
    // A tab switch (or any other content swap under `host` that doesn't
    // touch the goal or session) replaces which [data-line] elements exist
    // in the DOM without changing `ctx.derived` — nothing else would tell
    // this layer to redraw against the new set of lines. Watching for
    // childList/subtree mutations on the host covers that case generically,
    // not just the tabs case, at the same debounce as resize/fonts. Ignore
    // mutations inside this layer's own SVG container — every redraw
    // rewrites `under`/`over`'s innerHTML, which would otherwise retrigger
    // itself forever.
    const ownContainer = containerRef.current;
    const mo = new MutationObserver((records) => {
      const external = records.some((r) => !ownContainer || !ownContainer.contains(r.target as Node));
      if (external) schedule();
    });
    mo.observe(host, { childList: true, subtree: true });
    // Content that animates in (a tab's page turn, a plan sheet coming to
    // the front) is still mid-transform when the mutation-triggered redraw
    // above measures it; redraw once more when it has settled, so marks
    // and checkboxes land on the lines' resting positions.
    const onSettled = (e: Event) => {
      const el = e.target as Element | null;
      if (el?.querySelector?.('[data-line], [data-box]')) schedule();
    };
    host.addEventListener('animationend', onSettled);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      mo.disconnect();
      host.removeEventListener('animationend', onSettled);
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
    const nextTicks = new Set<LinePath>();
    const nextCancels = new Set<LinePath>();

    function drawTick(path: LinePath, target: Box) {
      nextTicks.add(path);
      const pts = tickPoints(target);
      const p = drawStroke(pts, over!, { color: ink, size: 2.6, thinning: 0.6, grain: false });
      const isNew = prevTicksRef.current ? !prevTicksRef.current.has(path) : false;
      if (isNew && !reduced) drawIn(p, pts, 180, 0, 12);
    }

    // Checkboxes: every [data-box] on the page gets its hand-drawn outline
    // whether or not it's ticked, so an unticked box is visible at rest and
    // not only a blank tap area. The tick comes from the box's own
    // data-checked state rather than the line's mark, so a done line keeps
    // its tick even while an event mark (the loop) holds that line's one
    // mark slot. A `data-bare` box is a tick-only slot: it takes the tick
    // without the outline, for a line that can be done but isn't the
    // user's to tick (a success criterion).
    const boxed = new Set<LinePath>();
    host.querySelectorAll<HTMLElement>('[data-box]').forEach((boxEl) => {
      const r = boxEl.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const path = boxEl.dataset.box as LinePath;
      const target = rel(r, origin);
      boxed.add(path);
      if (boxEl.dataset.bare === undefined) {
        for (const side of boxPoints(target, hashSeed(path))) {
          drawStroke(side, over, { size: 1.5, thinning: 0.45, taper: false, grain: false, opacity: 0.85 });
        }
      }
      if (boxEl.dataset.checked !== undefined) drawTick(path, target);
    });

    for (const { path, mark, lines, el } of placed) {
      const seed = hashSeed(path);

      // Give each marked line the mark's meaning as a pencil-note (brand/
      // identity.md §05 pencil-note tooltips): the simplest hookup is
      // setting data-note directly on the [data-line] element MarksLayer
      // already owns, rather than a separate hit target.
      const note = noteForMark(mark);
      if (note) el.setAttribute('data-note', note);
      else el.removeAttribute('data-note');

      if (mark.kind === 'cancel') nextCancels.add(path);

      // A ticked line with its own checkbox is drawn by the box pass above.
      // This is the fallback for a ticked line the page renders no box for
      // (a met success criterion): tick at the line start instead of
      // drawing a checkbox that doesn't exist.
      if (mark.kind === 'tick' && !boxed.has(path)) {
        const line = lines[0];
        drawTick(path, { l: line.l, t: line.t, r: line.l + 18, b: line.t + 18, w: 18, h: 18 });
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

      if (mark.kind === 'cancel') {
        const isNew = prevCancelsRef.current ? !prevCancelsRef.current.has(path) : false;
        lines.forEach((L, j) => {
          const pts = zigzagPoints(L, seed + j);
          const p = drawStroke(pts, over, { size: 1.7 });
          if (isNew && !reduced) drawIn(p, pts, 300, 0, 12);
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

    prevTicksRef.current = nextTicks;
    prevCancelsRef.current = nextCancels;

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

/** The pencil-note text for a mark, per brand/identity.md §05's SR-text
 * table — same meaning, surfaced as a tooltip instead of only to a screen
 * reader. `arrow-text`'s fallback line already renders its own "→ Name"
 * text inline, so it needs no separate note. */
export function noteForMark(mark: Mark): string | null {
  switch (mark.kind) {
    case 'star':
      return 'everything else waits on this';
    case 'arrow':
      return mark.sr;
    case 'question':
      return 'open question';
    case 'loop':
      return 'new from your chat';
    case 'highlight':
      return 'the focus right now';
    default:
      return null;
  }
}

function cssEscape(s: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}
