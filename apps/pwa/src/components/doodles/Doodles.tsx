import { useEffect, useMemo, useRef, useState } from 'react';
import type { Goal } from '../../lib/types';
import { timeLeft } from '../../lib/dates';
import { buildDoodleLayout, nodeJitter, RADIAL_MIN_WIDTH, type DoodleNode, type DoodleEdge } from './layout';
import { hand, strokePath, tickPoints, starPoints, type Box, type Point } from '../marks/stroke';

// The Doodles tab: the whole plan sketched in pencil as a mind map. Tapping
// a node dispatches `gambit:goto` ({ detail: { path } }) so the page can
// switch to the tab holding that line and bring it into view.

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia(REDUCED_MOTION_QUERY).matches;
}

function goTo(path: string) {
  window.dispatchEvent(new CustomEvent('gambit:goto', { detail: { path } }));
}

/** A hand-drawn tapering branch/twig line between two points, seeded by the
 * target node's own path so it doesn't reshuffle between renders. */
function BranchPath({ x1, y1, x2, y2, seed, kind }: { x1: number; y1: number; x2: number; y2: number; seed: number; kind: 'branch' | 'twig' | 'risk-arrow' }) {
  const pts: Point[] = hand((t) => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t], {
    n: kind === 'branch' ? 30 : 14,
    wobble: kind === 'branch' ? 0.9 : 0.5,
    seed,
    press: kind === 'branch' ? [0.35, 0.6] : [0.3, 0.45],
  });
  const d = strokePath(pts, { size: kind === 'branch' ? 1.6 : 1.1, thinning: 0.6, taper: true });
  return <path d={d} fill="var(--graphite)" filter="url(#graphite)" opacity={kind === 'risk-arrow' ? 0.8 : 0.85} />;
}

function boxFor(node: DoodleNode): Box {
  const longest = Math.max(node.label.length, node.label2?.length ?? 0);
  const w = Math.max(24, longest * 6.5);
  const h = node.label2 ? 32 : 16;
  return { l: node.x - w / 2, r: node.x + w / 2, t: node.y - h / 2, b: node.y + h / 2, w, h };
}

function StatusMark({ node }: { node: DoodleNode }) {
  const box = boxFor(node);
  if (node.status === 'done') {
    const pts = tickPoints({ l: node.x - 6, r: node.x + 6, t: node.y - 12, b: node.y - 2, w: 12, h: 10 });
    const d = strokePath(pts, { size: 1.4, taper: false });
    return <path d={d} fill="var(--ink)" filter="url(#graphite)" aria-hidden="true" />;
  }
  if (node.status === 'proposed') {
    return <circle cx={node.x + boxFor(node).w / 2 + 8} cy={node.y - 10} r={3.5} fill="var(--note)" stroke="var(--note-edge)" aria-hidden="true" />;
  }
  if (node.isFirstPendingOnFocus) {
    const pts = starPoints(node.x - boxFor(node).w / 2 - 12, box, node.seed, 6);
    const d = strokePath(pts, { size: 1.2, taper: false });
    return <path d={d} fill="var(--ink)" filter="url(#graphite)" aria-hidden="true" />;
  }
  return null;
}

function fontForKind(kind: DoodleNode['kind']): string {
  if (kind === 'goal') return 'font-serif';
  return 'font-sans';
}

function sizeForKind(kind: DoodleNode['kind']): number {
  if (kind === 'goal') return 18;
  if (kind === 'line') return 14;
  return 13;
}

function weightForKind(kind: DoodleNode['kind']): number {
  return kind === 'line' ? 600 : 400;
}

function NodeLabel({ node, onActivate }: { node: DoodleNode; onActivate: (path: string) => void }) {
  const fontSize = sizeForKind(node.kind);
  const fontWeight = weightForKind(node.kind);
  const isDropped = node.status === 'dropped';
  if (isDropped) return null;

  const boxH = node.label2 ? 44 : 44; // tap target stays 44px tall either way
  const box = boxFor(node);

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      className={node.isFocusLine ? 'doodle-focus' : ''}
    >
      {node.isFocusLine && (
        <rect x={-box.w / 2 - 4} y={-box.h / 2 - 3} width={box.w + 8} height={box.h + 6} fill="var(--hi)" aria-hidden="true" />
      )}
      <foreignObject x={-100} y={-boxH / 2} width={200} height={boxH} style={{ overflow: 'visible', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: boxH }}>
          <button
            type="button"
            data-note={node.truncated ? node.fullLabel : undefined}
            onClick={() => onActivate(node.path)}
            style={{
              pointerEvents: 'auto',
              minHeight: 44,
              minWidth: 44,
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px 8px',
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              fontFamily: node.kind === 'goal' ? 'var(--font-serif)' : 'var(--font-sans, inherit)',
              fontSize,
              fontWeight,
              color: 'var(--ink)',
              whiteSpace: 'nowrap',
              lineHeight: '15px',
              textAlign: 'center',
            }}
            className="doodle-node"
          >
            <span>{node.label}</span>
            {node.label2 && <span>{node.label2}</span>}
          </button>
        </div>
      </foreignObject>
      <StatusMark node={node} />
    </g>
  );
}

interface Dims { width: number; height: number; mode: 'radial' | 'tree' }

export function Doodles({ goal, goalId: _goalId }: { goal: Goal; goalId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<Dims>({ width: 640, height: 480, mode: 'radial' });
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth || 640;
      const mode: 'radial' | 'tree' = w >= RADIAL_MIN_WIDTH ? 'radial' : 'tree';
      // Height is a starting guess only — buildDoodleLayout computes the
      // real height it needs (radial can grow taller than wide) and the
      // viewBox below uses that instead.
      const h = mode === 'radial' ? Math.max(420, w) : 480;
      setDims({ width: w, height: h, mode });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => buildDoodleLayout(goal, dims), [goal, dims]);

  useEffect(() => {
    if (layout.empty) return;
    if (prefersReducedMotion()) {
      setDrawn(true);
      return;
    }
    setDrawn(false);
    const t = setTimeout(() => setDrawn(true), 30);
    return () => clearTimeout(t);
  }, [layout.empty, goal]);

  if (layout.empty) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-8">
        <p className="hand text-[20px] text-graphite">Not much to draw yet. Ask for a plan.</p>
      </div>
    );
  }

  const nodesById = new Map(layout.nodes.map((n) => [n.id, n]));
  const visibleNodes = layout.nodes.filter((n) => n.status !== 'dropped');
  const reduced = prefersReducedMotion();
  const deadline = goal.deadline ? timeLeft(goal.deadline) : null;

  return (
    <div ref={containerRef} className="w-full">
      <svg
        role="img"
        aria-label={`Mind map of the plan for "${goal.goal}"${deadline ? `, ${deadline}` : ''}, with ${layout.nodes.filter((n) => n.kind === 'line').length} lines of operation`}
        width="100%"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="block"
      >
        <g
          style={
            reduced
              ? undefined
              : {
                  transition: 'opacity 300ms ease',
                  opacity: drawn ? 1 : 0.001,
                }
          }
        >
          {layout.edges.map((e: DoodleEdge, i: number) => {
            const from = nodesById.get(e.fromId);
            const to = nodesById.get(e.toId);
            if (!from || !to) return null;
            if (to.status === 'dropped') return null;
            return (
              <g
                key={`${e.fromId}-${e.toId}-${i}`}
                style={
                  reduced
                    ? undefined
                    : {
                        transition: `stroke-dashoffset 500ms ease ${Math.min(i * 25, 400)}ms`,
                      }
                }
              >
                <BranchPath x1={from.x} y1={from.y} x2={to.x} y2={to.y} seed={to.seed} kind={e.kind} />
              </g>
            );
          })}
          {visibleNodes.map((n) => (
            <NodeLabel key={n.id} node={n} onActivate={goTo} />
          ))}
        </g>
      </svg>
      <nav aria-label="Plan outline" className="sr-only">
        <ul>
          {buildOutline(layout.nodes, layout.edges).map((item) => (
            <li key={item.node.id}>
              <button type="button" onClick={() => goTo(item.node.path)}>
                {item.node.fullLabel}
                {item.node.status ? ` (${item.node.status})` : ''}
              </button>
              {item.children.length > 0 && (
                <ul>
                  {item.children.map((c) => (
                    <li key={c.node.id}>
                      <button type="button" onClick={() => goTo(c.node.path)}>
                        {c.node.fullLabel}
                        {c.node.status ? ` (${c.node.status})` : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

interface OutlineItem { node: DoodleNode; children: OutlineItem[] }

function buildOutline(nodes: DoodleNode[], edges: DoodleEdge[]): OutlineItem[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string, DoodleNode[]>();
  for (const e of edges) {
    if (e.kind === 'risk-arrow') continue;
    const to = byId.get(e.toId);
    if (!to || to.status === 'dropped') continue;
    const list = childrenOf.get(e.fromId) ?? [];
    list.push(to);
    childrenOf.set(e.fromId, list);
  }
  const topLevel = childrenOf.get('goal') ?? [];
  return topLevel
    .filter((n) => n.status !== 'dropped')
    .map((n) => ({
      node: n,
      children: (childrenOf.get(n.id) ?? []).filter((c) => c.status !== 'dropped').map((c) => ({ node: c, children: [] })),
    }));
}
