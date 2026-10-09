import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Goal } from '../../lib/types';
import { byDate, timeLeft, today } from '../../lib/dates';
import { hand, hashSeed, strokePath, type Point } from '../marks/stroke';
import { buildDoodleMap, type DoodleColumn, type DoodleNode } from './tree';

// The Doodles tab: the goal at the top and each line of operation climbing
// toward it, read from the bottom up: where the line started, the moves
// and milestones on the way, the next milestone nearest the goal. The
// columns are plain HTML, so text wraps and every item is a button; one
// SVG behind them pencils in the spines, each turning at the top into the
// rule the line's name sits on, and any task that waits on another line's. Too many columns for the width
// scroll sideways, one column per snap. Tapping an item dispatches
// `gambit:goto` ({ detail: { path } }) so the page switches to the tab
// holding it.

function goTo(path: string) {
  window.dispatchEvent(new CustomEvent('gambit:goto', { detail: { path } }));
}

const STATUS_WORD: Record<string, string> = { at_risk: 'at risk', blocked: 'blocked', done: 'done' };

export function Doodles({ goal }: { goal: Goal; goalId: string }) {
  const map = useMemo(() => buildDoodleMap(goal, today()), [goal]);
  const contentRef = useRef<HTMLDivElement>(null);
  const strokes = useStrokes(map, contentRef);

  if (!map) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-8">
        <p className="hand text-[20px] text-graphite">Nothing to draw yet.</p>
      </div>
    );
  }

  const deadline = goal.deadline ? timeLeft(goal.deadline) : null;
  return (
    <div className="w-full" aria-label={`The plan for "${goal.goal}", each line climbing to the goal`} role="group">
      <div className="anim-rise mx-auto max-w-[32rem] px-4 text-center">
        <button type="button" onClick={() => goTo('goal')} className="font-serif text-[21px] font-semibold leading-[28px] text-ink">
          {map.goal}
        </button>
        {deadline && <div className="hand text-[19px] leading-6 text-graphite">{deadline}</div>}
      </div>
      <div
        className="doodle-scroll -mx-3 overflow-x-auto overflow-y-hidden"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
      >
        <div ref={contentRef} className="relative mx-auto flex w-max min-w-full justify-center gap-5 px-4 pt-6 pb-4">
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" style={{ filter: 'url(#graphite)' }}>
            {strokes.map((s, i) => (
              <path key={`${s.key}:${i}`} d={s.d} fill={s.strong ? 'var(--ink)' : 'var(--graphite)'} opacity={s.faint ? 0.5 : 0.85} className="anim-fade-in" />
            ))}
          </svg>
          {map.columns.map((col, i) => <Column key={col.path} col={col} index={i} />)}
        </div>
      </div>
      <style>{`
        .doodle-scroll::-webkit-scrollbar { display: none; }
        .doodle-col { flex: 1 0 auto; width: min(78vw, 250px); max-width: 340px; scroll-snap-align: center; }
        .doodle-label { box-decoration-break: clone; -webkit-box-decoration-break: clone; }
        .doodle-label.is-focus { background: var(--hi); }
        .doodle-label.is-proposed { background: var(--note); padding: 0 4px; }
        .doodle-item:hover .doodle-text { text-decoration: underline; text-underline-offset: 3px; }
      `}</style>
    </div>
  );
}

function Column({ col, index }: { col: DoodleColumn; index: number }) {
  const flag = col.status ? STATUS_WORD[col.status] : undefined;
  return (
    <section
      aria-label={col.label}
      data-col={col.path}
      className="doodle-col anim-rise flex min-w-0 flex-col"
      style={{ animationDelay: `${index * 70}ms`, animationFillMode: 'backwards' } as CSSProperties}
    >
      {/* The line's name sits centred on the rule its spine meets at the
       * top, like the bar of a T. */}
      <h3 data-head={col.path} className="px-2 pb-1 text-center">
        <button type="button" onClick={() => goTo(col.path)} className={`hand relative text-[23px] leading-7 ${col.status === 'done' ? 'text-graphite' : 'text-ink'}`}>
          {col.label}
        </button>
        {flag && <span className="hand ml-1.5 text-[19px] text-graphite">{flag}</span>}
      </h3>
      {/* Bottom to top: column-reverse puts the first node on the ground
       * and the forks, still to come, nearest the line's name. */}
      <ol className="flex flex-1 flex-col-reverse justify-start gap-6 pt-8">
        {col.nodes.map((n) => <Item key={n.path} node={n} />)}
        {col.forks.length > 0 && (
          <li className="space-y-1.5 pb-1 pl-7">
            <div className="hand text-[18px] leading-5 text-graphite">if things change</div>
            <ul className="space-y-3">{col.forks.map((n) => <Item key={n.path} node={n} spine={false} />)}</ul>
          </li>
        )}
      </ol>
    </section>
  );
}

function Item({ node, spine = true }: { node: DoodleNode; spine?: boolean }) {
  const quiet = node.state === 'done' || node.kind === 'milestone' || node.kind === 'fork';
  const meta = [node.to && `to ${node.to}`, node.state === 'awaiting' && 'waiting for a reply', node.when && node.state !== 'done' && byDate(node.when)].filter(Boolean).join(' · ');
  const cls = ['doodle-label', node.focus && 'is-focus', node.state === 'proposed' && 'is-proposed'].filter(Boolean).join(' ');
  return (
    <li className="doodle-item flex min-h-11 items-start gap-2">
      <span data-mark={spine ? node.path : undefined} className={`flex h-[22px] w-5 shrink-0 items-center justify-center ${quiet ? 'text-graphite' : 'text-ink'}`}>
        <Marker node={node} />
      </span>
      <button
        type="button"
        data-label={node.path}
        onClick={() => goTo(node.path)}
        className={`min-w-0 text-left text-[15px] leading-[22px] ${quiet ? 'text-graphite' : 'text-ink'} ${node.kind === 'milestone' ? 'font-medium' : ''}`}
      >
        {node.condition && (
          <span className="block">
            <span className="text-graphite">if </span>{node.condition}
          </span>
        )}
        {node.condition && <span className="text-graphite">then </span>}
        <span className={`doodle-text ${cls}`}>{node.label}</span>
        {meta && <span className="hand ml-1.5 text-[17px] leading-[22px] text-graphite">{meta}</span>}
        {node.state === 'proposed' && <span className="sr-only"> (proposed)</span>}
        {node.state === 'done' && <span className="sr-only">{node.kind === 'milestone' ? ' (reached)' : ' (done)'}</span>}
        {node.chain?.map((c) => (
          <span key={c.path} className="block text-[14px] leading-5 text-graphite">
            no reply in {c.days} days → {c.action}
          </span>
        ))}
      </button>
    </li>
  );
}

/** The mark on the spine: a ring for a move to make, ticked once done, a
 * dashed ring while it waits on another, ✉ while a message waits for its
 * reply, a diamond for a milestone (filled once reached), ↳ for a move
 * made only if something happens. */
function Marker({ node }: { node: DoodleNode }) {
  if (node.kind === 'milestone') {
    return (
      <svg viewBox="0 0 12 12" className="h-[11px] w-[11px]" aria-hidden="true">
        <path d="M6 0.9 L11.1 6 L6 11.1 L0.9 6 Z" fill={node.state === 'done' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    );
  }
  if (node.kind === 'fork') return <span aria-hidden="true" className="text-[15px]">↳</span>;
  if (node.state === 'awaiting') return <span aria-hidden="true" className="text-[14px]">✉</span>;
  if (node.state === 'done') {
    return (
      <svg viewBox="0 0 12 12" className="h-[12px] w-[12px]" aria-hidden="true">
        <path d="M2 6.5 L5 9.5 L10.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 12 12" className="h-[10px] w-[10px]" aria-hidden="true">
      <circle cx="6" cy="6" r="4.6" fill={node.state === 'proposed' ? 'var(--note)' : 'var(--bg)'} stroke="currentColor" strokeWidth="1.4" strokeDasharray={node.state === 'blocked' ? '2 2' : undefined} />
    </svg>
  );
}

interface Stroke { key: string; d: string; faint?: boolean; strong?: boolean }

/** A hand-drawn stroke through the points of `f`, seeded by its key so it
 * holds still between renders. */
const pencil = (key: string, f: (t: number) => [number, number], n = 18, size = 1.5): string =>
  strokePath(hand(f, { n, wobble: 0.5, seed: hashSeed(key), press: [0.5, 0.35] }), { size, thinning: 0.4, taper: false });

/** Two short strokes making an arrowhead at the end of `pts`, pointing the
 * way the stroke was heading. */
function arrowhead(key: string, pts: Point[]): string[] {
  const [x, y] = pts[pts.length - 1];
  const [px, py] = pts[Math.max(0, pts.length - 4)];
  const a = Math.atan2(y - py, x - px);
  return [-0.5, 0.5].map((spread, i) => {
    const b = a + Math.PI + spread;
    return pencil(`${key}:head${i}`, (t) => [x + Math.cos(b) * 7 * t, y + Math.sin(b) * 7 * t], 6, 1.4);
  });
}

const bezier = (s: [number, number], c1: [number, number], c2: [number, number], e: [number, number]) => (t: number): [number, number] => {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * s[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * e[k]) as [number, number];
};

/** Measures the laid-out columns and pencils in what joins them: each
 * column's spine through its marks, turning at the top into the rule under
 * the line's name, and a fainter arrow for each task that waits on another
 * line's. Redrawn whenever the content changes size. */
function useStrokes(
  map: ReturnType<typeof buildDoodleMap>,
  contentRef: React.RefObject<HTMLDivElement | null>,
): Stroke[] {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!map || !content) return;
    const draw = () => {
      const origin = content.getBoundingClientRect();
      const rel = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { l: r.left - origin.left, r: r.right - origin.left, t: r.top - origin.top, b: r.bottom - origin.top, w: r.width, cx: (r.left + r.right) / 2 - origin.left, cy: (r.top + r.bottom) / 2 - origin.top };
      };
      const find = (attr: string, path: string) => content.querySelector(`[${attr}="${CSS.escape(path)}"]`);
      const out: Stroke[] = [];

      map.columns.forEach((col) => {
        const head = find('data-head', col.path);
        const colEl = find('data-col', col.path);
        if (!head || !colEl) return;
        const h = rel(head);
        const c = rel(colEl);
        // The spine: up from the ground, mark to mark, then bending in from
        // the marks to meet the rule under the line's name at its middle.
        const marks = col.nodes.map((nd) => find('data-mark', nd.path)).filter(Boolean).map((el) => rel(el!));
        const x = marks[0]?.cx ?? c.l + 10;
        const ruleY = h.b;
        const stops = [...marks.map((m) => ({ lo: m.b + 3, hi: m.t - 3 })), { lo: ruleY, hi: ruleY }];
        let from = marks.length > 0 ? stops[0].hi : c.b - 4;
        stops.slice(marks.length > 0 ? 1 : 0).forEach((s, si) => {
          if (s.lo < from - 4) {
            const y0 = from, y1 = s.lo;
            const key = `${col.path}:spine${si}`;
            // The bend stays in the gap under the rule, clear of any text.
            const bendY = s.lo === ruleY ? Math.min(y0, y1 + 26) : y1;
            if (bendY < y0 - 2) out.push({ key, d: pencil(key, (t) => [x, y0 + (bendY - y0) * t], 12) });
            if (bendY > y1) {
              const f = bezier([x, bendY], [x, y1 + 6], [c.cx, bendY - 4], [c.cx, y1]);
              out.push({ key: `${key}:bend`, d: pencil(`${key}:bend`, f, 16) });
            }
          }
          from = s.hi;
        });
        // The rule the name sits on, across the column; darker on the
        // focus line.
        const key = `${col.path}:rule`;
        out.push({ key, d: pencil(key, (t) => [c.l + 4 + (c.w - 8) * t, ruleY + 0.75 - t * 1.5], 24, col.focus ? 1.9 : 1.5), strong: col.focus });
      });

      // Across lines: from what must happen first to what waits on it.
      map.links.forEach(({ from, to }) => {
        const fm = find('data-mark', from) ?? find('data-label', from);
        const tm = find('data-mark', to) ?? find('data-label', to);
        const fl = find('data-label', from);
        const tl = find('data-label', to);
        if (!fm || !tm || !fl || !tl) return;
        const a = rel(fm), b = rel(tm), al = rel(fl), bl = rel(tl);
        const rightward = b.cx > a.cx;
        const s: [number, number] = rightward ? [Math.min(al.r + 6, a.l + (b.l - a.l) - 24), al.t + 11] : [a.l - 4, a.cy];
        const e: [number, number] = rightward ? [b.l - 4, b.cy] : [Math.min(bl.r + 6, a.l - 24), bl.t + 11];
        const mid = (s[0] + e[0]) / 2;
        const f = bezier(s, [mid, s[1]], [mid, e[1]], e);
        const key = `link:${from}>${to}`;
        const pts = hand(f, { n: 24, wobble: 0.5, seed: hashSeed(key) });
        out.push({ key, d: pencil(key, f, 24, 1.2), faint: true }, ...arrowhead(key, pts).map((d) => ({ key: `${key}:h`, d, faint: true })));
      });
      setStrokes(out);
    };
    draw();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(draw);
    ro.observe(content);
    void document.fonts?.ready.then(draw);
    return () => ro.disconnect();
  }, [map, contentRef]);
  return strokes;
}
