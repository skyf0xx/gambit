import { useEffect, useMemo, useRef, type MouseEvent } from 'react';
import { Markmap } from 'markmap-view';
import type { Goal } from '../../lib/types';
import { timeLeft } from '../../lib/dates';
import { buildDoodleTree, toMarkmap, type DoodleItem } from './tree';

// The Doodles tab: the whole plan as a mind map, drawn by markmap (layout,
// pan, zoom, collapsing branches) from the tree in tree.ts and styled to
// the paper palette below. Tapping a node dispatches `gambit:goto`
// ({ detail: { path } }) so the page can switch to the tab holding that
// line and bring it into view.

function goTo(path: string) {
  window.dispatchEvent(new CustomEvent('gambit:goto', { detail: { path } }));
}

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Doodles({ goal }: { goal: Goal; goalId: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const mapRef = useRef<Markmap | null>(null);
  const tree = useMemo(() => buildDoodleTree(goal), [goal]);
  const hasTree = tree != null;

  // One markmap instance for as long as there's a map to show; it refits
  // when its box changes size.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const map = Markmap.create(svg, {
      color: () => 'var(--graphite)',
      duration: reducedMotion() ? 0 : 300,
      maxWidth: 220,
      paddingX: 10,
      spacingHorizontal: 56,
      spacingVertical: 10,
    });
    mapRef.current = map;
    const ro = new ResizeObserver(() => void map.fit());
    ro.observe(svg);
    return () => {
      ro.disconnect();
      map.destroy();
      mapRef.current = null;
    };
  }, [hasTree]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tree) return;
    void map.setData(toMarkmap(tree)).then(() => map.fit());
  }, [tree]);

  if (!tree) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-8">
        <p className="hand text-[20px] text-graphite">Nothing to draw yet.</p>
      </div>
    );
  }

  const onMapClick = (e: MouseEvent) => {
    const path = (e.target as Element).closest<HTMLElement>('[data-goto]')?.dataset.goto;
    if (path) goTo(path);
  };
  const deadline = goal.deadline ? timeLeft(goal.deadline) : null;
  const lineCount = tree.children.filter((c) => c.kind === 'line').length;

  return (
    <div className="w-full">
      <svg
        ref={svgRef}
        role="img"
        aria-label={`Mind map of the plan for "${goal.goal}"${deadline ? `, ${deadline}` : ''}, with ${lineCount} lines of operation`}
        className="doodle-map"
        onClick={onMapClick}
      />
      <nav aria-label="Plan outline" className="sr-only">
        <Outline items={tree.children} />
      </nav>
      <style>{`
        .doodle-map {
          display: block;
          width: 100%;
          height: min(70dvh, 640px);
          touch-action: none;
        }
        .doodle-map.markmap {
          --markmap-font: 400 15px/21px var(--font-sans);
          --markmap-text-color: var(--ink);
          --markmap-circle-open-bg: var(--bg);
        }
        .doodle-map .markmap-link,
        .doodle-map .markmap-node > line,
        .doodle-map .markmap-node > circle {
          stroke: var(--graphite);
        }
        .doodle-node { cursor: pointer; }
        .doodle-node:hover { text-decoration: underline; text-underline-offset: 3px; }
        .doodle-goal { font-family: var(--font-serif); font-size: 18px; font-weight: 600; }
        .doodle-line { font-weight: 600; }
        .doodle-group { font-family: var(--font-hand); font-size: 21px; color: var(--graphite); }
        .doodle-risk { color: var(--graphite); }
        .doodle-focus { background: var(--hi); }
        .doodle-proposed { background: var(--note); padding: 0 4px; }
      `}</style>
    </div>
  );
}

/** The same tree as nested buttons, for keyboard and screen-reader use —
 * the drawn map itself is a single image to assistive tech. */
function Outline({ items }: { items: DoodleItem[] }) {
  return (
    <ul>
      {items.map((item, i) => (
        <li key={`${item.path}:${i}`}>
          <button type="button" onClick={() => goTo(item.path)}>
            {item.label}
            {item.done ? ' (done)' : item.proposed ? ' (proposed)' : ''}
          </button>
          {item.children.length > 0 && <Outline items={item.children} />}
        </li>
      ))}
    </ul>
  );
}
