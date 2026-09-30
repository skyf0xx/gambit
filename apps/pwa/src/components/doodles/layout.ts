import type { Goal } from '../../lib/types';
import { hashSeed, rng } from '../marks/stroke';

// Pure layout functions for the Doodles mind map — no DOM, no React, so they
// can be unit tested directly. Two coordinate modes share the same node
// list: 'radial' (desktop, container >= 480px — the page column's real
// width, not a generic breakpoint) arranges branches as spokes around the
// centre, weighted by how many children each line of operation has, with
// twigs staggered across alternating radii and a seeded collision-nudge
// pass to keep tap targets from overlapping; 'tree' (narrower, i.e. mobile)
// stacks everything in a vertical column growing downward. Both are
// deterministic for the same goal: seeds come from each item's own
// LinePath (brand/identity.md — "randomness is seeded so the drawing
// doesn't reshuffle between renders").

export const RADIAL_MIN_WIDTH = 480;

export type NodeKind = 'goal' | 'criteria' | 'line' | 'step' | 'action' | 'person' | 'stakeholder' | 'risk';

// A tap target's half-extents used by the collision-nudge pass — matches
// the 44px minimum tap area from the renderer (Doodles.tsx's foreignObject
// button), so two nodes are only considered colliding when their targets
// would actually overlap on screen.
const HALF_W = 52;
const HALF_H = 24;

// A node's real half-width, from its actual label text rather than the
// fixed HALF_W constant — a long label (e.g. a two-line branch heading, or
// a long twig like "neighborhood association") is wider on screen than the
// generic tap-target minimum, and comparing every pair at the same fixed
// width let a long branch label and a long twig label pass as
// non-overlapping when their rendered text actually collided (bug: a twig
// label overlapping its own line's branch heading). Mirrors Doodles.tsx's
// boxFor (~6.5px/char), floored at HALF_W so short labels still get the
// full tap-target clearance.
//
// The goal node is deliberately excluded from this per-character estimate:
// it sits alone at the hub with the criteria column reserved directly
// above it and every branch/twig projected outward starting at
// `branchRadius`, so nothing is actually laid out beside it at label
// height — unlike every other node, whose neighbours are placed without
// that reservation. Using the same character-proportional width for a long
// goal sentence made it collide with the nearest branch on every dense
// goal at real desktop widths (576px) even though the two labels never
// visually overlap, and since the goal node never moves (it's the fixed
// anchor), that collision could never resolve — the nudge pass would just
// spin on it. It keeps the generic tap-target half-width instead.
function labelHalfWidth(node: Pick<DoodleNode, 'label' | 'label2' | 'kind'>): number {
  if (node.kind === 'goal') return HALF_W;
  const longest = Math.max(node.label.length, node.label2?.length ?? 0);
  return Math.max(HALF_W, (longest * 6.5) / 2 + 6);
}

export interface DoodleNode {
  id: string;
  kind: NodeKind;
  path: string; // LinePath used for gambit:goto and data-line
  label: string; // truncated label (display), possibly wrapped onto a second line
  label2?: string; // second wrapped line, when the label doesn't fit on one
  fullLabel: string; // untruncated, for data-note
  truncated: boolean;
  status?: 'pending' | 'done' | 'dropped' | 'proposed' | 'met';
  x: number;
  y: number;
  seed: number;
  parentId?: string;
  isFocusLine?: boolean; // this line-of-operation is the current focus
  isFirstPendingOnFocus?: boolean; // pencil-star: first pending step on the focus line
  dependsOnPersonId?: string; // for risk nodes with dependsOn resolved to a person/stakeholder node id
}

export interface DoodleEdge {
  fromId: string;
  toId: string;
  kind: 'branch' | 'twig' | 'risk-arrow';
}

export interface DoodleLayout {
  nodes: DoodleNode[];
  edges: DoodleEdge[];
  width: number;
  height: number;
  empty: boolean;
}

const MAX_LABEL_WORDS = 6;

export function truncateLabel(text: string): { label: string; truncated: boolean } {
  const words = text.trim().split(/\s+/);
  if (words.length <= MAX_LABEL_WORDS) return { label: text, truncated: false };
  return { label: `${words.slice(0, MAX_LABEL_WORDS).join(' ')}…`, truncated: true };
}

/** Wrap a (possibly already truncated) label onto at most two short lines,
 * splitting near the midpoint on a word boundary — used in radial mode
 * where labels sit on their own spoke rather than a full-width row, so a
 * long label needs to wrap instead of running into its neighbours. */
export function wrapLabelTwoLines(label: string): { line1: string; line2?: string } {
  if (label.length <= 16) return { line1: label };
  const words = label.split(/\s+/);
  if (words.length < 2) return { line1: label };
  let best = 0;
  let bestDiff = Infinity;
  let acc = 0;
  for (let i = 0; i < words.length - 1; i++) {
    acc += words[i].length + 1;
    const diff = Math.abs(acc - label.length / 2);
    if (diff < bestDiff) { bestDiff = diff; best = i + 1; }
  }
  return { line1: words.slice(0, best).join(' '), line2: words.slice(best).join(' ') };
}

function seedFor(path: string): number {
  return hashSeed(path);
}

/** Goal is "sparse" (empty state) when there's no plan with any lines. */
export function isSparseGoal(goal: Goal): boolean {
  return !goal.plan || goal.plan.linesOfOperation.length === 0;
}

interface BuildOptions {
  width: number;
  height: number;
  mode: 'radial' | 'tree';
}

/** Find the latest log entry carrying a focusLine, and return its text. */
function currentFocusLine(goal: Goal): string | undefined {
  for (let i = goal.log.length - 1; i >= 0; i--) {
    const entry = goal.log[i];
    if (entry.focusLine) return entry.focusLine;
  }
  return undefined;
}

/** Build the full node/edge graph for a goal, positioned for the given mode. */
export function buildDoodleLayout(goal: Goal, opts: BuildOptions): DoodleLayout {
  const { width, height, mode } = opts;

  if (isSparseGoal(goal)) {
    return { nodes: [], edges: [], width, height, empty: true };
  }

  const nodes: DoodleNode[] = [];
  const edges: DoodleEdge[] = [];
  const cx = width / 2;
  const focusLineText = currentFocusLine(goal);
  const lines = goal.plan?.linesOfOperation ?? [];
  const peopleList = [
    ...goal.people.map((p, i) => ({ p, path: `people.${i}`, kind: 'person' as const })),
    ...goal.stakeholders.map((s, i) => ({ p: s, path: `stakeholders.${i}`, kind: 'stakeholder' as const })),
  ];

  const result = mode === 'radial'
    ? buildRadial(goal, { width, height, cx, lines, peopleList, focusLineText })
    : buildTree(goal, { width, cx, lines, peopleList, focusLineText });

  nodes.push(...result.nodes);
  edges.push(...result.edges);

  if (mode === 'radial') nudgeCollisions(nodes, width);

  return { nodes, edges, width, height: result.height, empty: false };
}

interface BuildCtx {
  width: number;
  cx: number;
  lines: NonNullable<Goal['plan']>['linesOfOperation'];
  peopleList: { p: { name: string }; path: string; kind: 'person' | 'stakeholder' }[];
  focusLineText: string | undefined;
}

function lineIsFocus(line: NonNullable<Goal['plan']>['linesOfOperation'][number], focusLineText: string | undefined): boolean {
  if (focusLineText == null) return false;
  return line.criticalPath.some((s) => s.label === focusLineText) || line.nextActions.some((a) => a.action === focusLineText);
}

// ---------------------------------------------------------------------------
// Tree mode (narrow / mobile, container < RADIAL_MIN_WIDTH): a single
// running vertical cursor, so nothing above ever overlaps what comes after.
// ---------------------------------------------------------------------------

function buildTree(goal: Goal, ctx: BuildCtx & { width: number }): { nodes: DoodleNode[]; edges: DoodleEdge[]; height: number } {
  const { cx, lines, peopleList, focusLineText } = ctx;
  const nodes: DoodleNode[] = [];
  const edges: DoodleEdge[] = [];
  const cy = 40;

  const goalNode: DoodleNode = {
    id: 'goal', kind: 'goal', path: 'goal',
    label: truncateLabel(goal.goal).label, fullLabel: goal.goal, truncated: truncateLabel(goal.goal).truncated,
    x: cx, y: cy, seed: seedFor('goal'),
  };
  nodes.push(goalNode);

  let cursorY = cy + 34;

  const criteriaCount = goal.successCriteria.length;
  goal.successCriteria.forEach((c, i) => {
    const path = `successCriteria.${i}`;
    const { label, truncated } = truncateLabel(c.text);
    const criteriaStatusEntry = goal.criteriaStatus.find((cs) => cs.text === c.text);
    const node: DoodleNode = {
      id: path, kind: 'criteria', path, label, fullLabel: c.text, truncated,
      status: criteriaStatusEntry?.status === 'met' ? 'met' : undefined,
      x: cx, y: cursorY, seed: seedFor(path), parentId: 'goal',
    };
    cursorY += 40;
    nodes.push(node);
    edges.push({ fromId: 'goal', toId: path, kind: 'twig' });
  });
  if (criteriaCount > 0) cursorY += 16;

  cursorY += 24;
  const peopleNodes: DoodleNode[] = [];

  lines.forEach((line, li) => {
    const linePath = `plan.linesOfOperation.${li}`;
    const isFocus = lineIsFocus(line, focusLineText);
    const { label, truncated } = truncateLabel(line.label);
    const lineId = `line-${li}`;
    nodes.push({
      id: lineId, kind: 'line', path: linePath, label, fullLabel: line.label, truncated,
      status: line.status === 'done' ? 'done' : undefined,
      x: cx, y: cursorY, seed: seedFor(linePath), parentId: 'goal', isFocusLine: isFocus,
    });
    edges.push({ fromId: 'goal', toId: lineId, kind: 'branch' });
    cursorY += 44;

    let firstPendingFound = false;
    const visibleSteps = line.criticalPath.filter((s) => s.status !== 'dropped');
    visibleSteps.forEach((step) => {
      const si = line.criticalPath.indexOf(step);
      const stepPath = `${linePath}.criticalPath.${si}`;
      const { label: sLabel, truncated: sTrunc } = truncateLabel(step.label);
      const isFirstPendingOnFocus = isFocus && !firstPendingFound && step.status === 'pending';
      if (isFirstPendingOnFocus) firstPendingFound = true;
      const stepId = `${lineId}-step-${si}`;
      nodes.push({
        id: stepId, kind: 'step', path: stepPath, label: sLabel, fullLabel: step.label, truncated: sTrunc,
        status: step.status, x: cx + 40, y: cursorY, seed: seedFor(stepPath), parentId: lineId, isFirstPendingOnFocus,
      });
      edges.push({ fromId: lineId, toId: stepId, kind: 'twig' });
      cursorY += 44;
    });

    const visibleActions = line.nextActions.filter((a) => a.status !== 'dropped');
    visibleActions.forEach((action) => {
      const ai = line.nextActions.indexOf(action);
      const actionPath = `${linePath}.nextActions.${ai}`;
      const { label: aLabel, truncated: aTrunc } = truncateLabel(action.action);
      const actionId = `${lineId}-action-${ai}`;
      nodes.push({
        id: actionId, kind: 'action', path: actionPath, label: aLabel, fullLabel: action.action, truncated: aTrunc,
        status: action.status, x: cx + 40, y: cursorY, seed: seedFor(actionPath), parentId: lineId,
      });
      edges.push({ fromId: lineId, toId: actionId, kind: 'twig' });
      cursorY += 44;
    });

    cursorY += 16;
  });

  peopleList.forEach(({ p, path, kind }, i) => {
    const { label, truncated } = truncateLabel(p.name);
    const id = `${kind}-${i}`;
    const node: DoodleNode = { id, kind, path, label, fullLabel: p.name, truncated, x: cx, y: cursorY, seed: seedFor(path) };
    cursorY += 44;
    nodes.push(node);
    peopleNodes.push(node);
  });

  goal.riskNotes.forEach((r, ri) => {
    if (!r.dependsOn) return;
    const target = peopleNodes.find((n) => n.fullLabel === r.dependsOn);
    if (!target) return;
    const riskPath = `riskNotes.${ri}`;
    const { label, truncated } = truncateLabel(r.item);
    const rx = (cx + target.x) / 2;
    const ry = (cy + target.y) / 2 - 20;
    const riskId = `risk-${ri}`;
    nodes.push({ id: riskId, kind: 'risk', path: riskPath, label, fullLabel: r.item, truncated, x: rx, y: ry, seed: seedFor(riskPath), dependsOnPersonId: target.id });
    edges.push({ fromId: riskId, toId: target.id, kind: 'risk-arrow' });
  });

  return { nodes, edges, height: Math.max(420, cursorY + 40) };
}

// ---------------------------------------------------------------------------
// Radial mode (container >= RADIAL_MIN_WIDTH): each line of operation gets
// an angular slot around the goal, weighted by how many children it has
// (steps + actions) so a busier line claims more of the circle. A line's
// own twigs don't fan out angularly at all — fanning is what caused
// crowding at realistic desktop widths (many labels at nearly the same
// angle and radius). Instead each twig marches straight outward along its
// line's angle, alternating a small perpendicular (tangential) offset left/
// right for a hand-drawn zigzag stagger, so every twig has its own ring
// step (radius) and no two siblings ever share a radius exactly. Height
// grows to fit as many items as the goal has — a taller-than-wide map is
// fine here; only the diagram width is bounded by the container.
// ---------------------------------------------------------------------------

const TWIG_RADIUS_STEP = 62; // outward distance between consecutive twigs on the same line
const TWIG_STAGGER = 46; // perpendicular offset alternated left/right for stagger

function buildRadial(goal: Goal, ctx: BuildCtx & { height: number }): { nodes: DoodleNode[]; edges: DoodleEdge[]; height: number } {
  const { width, cx, lines, peopleList, focusLineText } = ctx;
  const nodes: DoodleNode[] = [];
  const edges: DoodleEdge[] = [];

  // Weight each line by its (visible) child count, minimum 1, so an empty
  // line still gets a sliver of angle instead of a zero-width slot.
  const lineWeights = lines.map((line) => {
    const steps = line.criticalPath.filter((s) => s.status !== 'dropped').length;
    const actions = line.nextActions.filter((a) => a.status !== 'dropped').length;
    return Math.max(1, steps + actions);
  });
  const totalWeight = lineWeights.reduce((a, b) => a + b, 0) || 1;
  const maxChildren = Math.max(1, ...lineWeights);

  // The container's width is fixed by the page column; only height is free
  // to grow ("a taller-than-wide map is fine"). Rather than shrinking every
  // radius to force the whole circle inside the container (which crowds
  // deep twigs together when there are many), each node's horizontal
  // extent alone is clamped to the container — the map is effectively an
  // ellipse that widens normally but is squashed on the x-axis only, so a
  // twig near the top or bottom of its line's column can sit much further
  // from the centre than one near the left/right without ever leaving the
  // container. `project` below implements this: same angle and a generous
  // radius, but x is capped independently of y.
  // A label's text can extend up to ~90px either side of its node's centre
  // (Doodles.tsx's foreignObject is 200px wide, centred on the node), so
  // the safe horizontal margin has to clear that overhang, not just the
  // 44px tap target — otherwise a node sitting near the container edge
  // still spills its label past the page's real edge.
  const marginX = 50;
  const maxRadiusX = Math.max(90, width / 2 - marginX);
  const branchRadius = Math.min(maxRadiusX * 0.75, 150);
  const twigDepthRadius = branchRadius + (maxChildren + 1) * TWIG_RADIUS_STEP;
  const outerRadius = twigDepthRadius + 90;
  const cy = outerRadius + 90; // top margin so the goal + criteria cluster above centre fit

  /** Place a point at `angle`/`r` from (cx, cy), but never let it cross the
   * container's horizontal edges — the radius is only ever reduced along x,
   * never along y, so the map grows taller instead of wider when it needs
   * more room. */
  function project(angle: number, r: number): { x: number; y: number } {
    const rawX = Math.cos(angle) * r;
    const clampedX = Math.max(-maxRadiusX, Math.min(maxRadiusX, rawX));
    return { x: cx + clampedX, y: cy + Math.sin(angle) * r };
  }

  const goalNode: DoodleNode = {
    id: 'goal', kind: 'goal', path: 'goal',
    label: truncateLabel(goal.goal).label, fullLabel: goal.goal, truncated: truncateLabel(goal.goal).truncated,
    x: cx, y: cy, seed: seedFor('goal'),
  };
  nodes.push(goalNode);

  // Success criteria stack directly above the goal, clear of the lines'
  // sweep (which starts below a reserved top gap) — a vertical mini-column
  // rather than a fan, so they never land at the same angle/radius as a
  // line or twig.
  const criteriaCount = goal.successCriteria.length;
  goal.successCriteria.forEach((c, i) => {
    const path = `successCriteria.${i}`;
    const { label, truncated } = truncateLabel(c.text);
    const criteriaStatusEntry = goal.criteriaStatus.find((cs) => cs.text === c.text);
    const x = cx;
    const y = cy - 80 - i * 60;
    nodes.push({
      id: path, kind: 'criteria', path, label, fullLabel: c.text, truncated,
      status: criteriaStatusEntry?.status === 'met' ? 'met' : undefined,
      x, y, seed: seedFor(path), parentId: 'goal',
    });
    edges.push({ fromId: 'goal', toId: path, kind: 'twig' });
  });

  // Each line gets an angular slot sized by weight, swept clockwise within
  // a reserved gap on both sides of the top (where the criteria column
  // sits), so neither the first nor the last line ever lands under the
  // criteria stack (angles wrap, so both ends of the sweep are adjacent to
  // the top). A minimum slot width keeps two adjacent lines' straight-out
  // columns from converging back into each other at depth.
  const peopleNodes: DoodleNode[] = [];
  const topGap = 0.55; // radians reserved on each side of the top for the criteria column
  const sweepSpan = Math.PI * 2 - topGap * 2;
  const minSlot = Math.min(sweepSpan / (lines.length * 1.6 || 1), sweepSpan * 0.3);
  let angleCursor = -Math.PI / 2 + topGap;

  lines.forEach((line, li) => {
    const weight = lineWeights[li];
    const weightedSpan = (weight / totalWeight) * sweepSpan;
    const lineAngle = angleCursor + Math.max(weightedSpan, minSlot) / 2;
    angleCursor += Math.max(weightedSpan, minSlot);

    const linePath = `plan.linesOfOperation.${li}`;
    const isFocus = lineIsFocus(line, focusLineText);
    const { label, truncated } = truncateLabel(line.label);
    const wrapped = wrapLabelTwoLines(label);
    const { x: lx, y: ly } = project(lineAngle, branchRadius);
    const lineId = `line-${li}`;
    nodes.push({
      id: lineId, kind: 'line', path: linePath, label: wrapped.line1, label2: wrapped.line2,
      fullLabel: line.label, truncated, status: line.status === 'done' ? 'done' : undefined,
      x: lx, y: ly, seed: seedFor(linePath), parentId: 'goal', isFocusLine: isFocus,
    });
    edges.push({ fromId: 'goal', toId: lineId, kind: 'branch' });

    // Perpendicular unit vector to this line's angle, for the zigzag stagger.
    const perpX = -Math.sin(lineAngle);
    const perpY = Math.cos(lineAngle);

    let firstPendingFound = false;
    const visibleSteps = line.criticalPath.filter((s) => s.status !== 'dropped');
    const visibleActions = line.nextActions.filter((a) => a.status !== 'dropped');
    const children = [
      ...visibleSteps.map((s) => ({ kind: 'step' as const, item: s })),
      ...visibleActions.map((a) => ({ kind: 'action' as const, item: a })),
    ];

    children.forEach((child, ci) => {
      const r = branchRadius + (ci + 1) * TWIG_RADIUS_STEP;
      const stagger = ci % 2 === 0 ? TWIG_STAGGER : -TWIG_STAGGER;
      const { x: px, y: py } = project(lineAngle, r);
      const x = Math.max(marginX, Math.min(width - marginX, px + perpX * stagger));
      const y = py + perpY * stagger;

      if (child.kind === 'step') {
        const step = child.item;
        const si = line.criticalPath.indexOf(step);
        const stepPath = `${linePath}.criticalPath.${si}`;
        const { label: sLabel, truncated: sTrunc } = truncateLabel(step.label);
        const sWrapped = wrapLabelTwoLines(sLabel);
        const isFirstPendingOnFocus = isFocus && !firstPendingFound && step.status === 'pending';
        if (isFirstPendingOnFocus) firstPendingFound = true;
        const stepId = `${lineId}-step-${si}`;
        nodes.push({
          id: stepId, kind: 'step', path: stepPath, label: sWrapped.line1, label2: sWrapped.line2,
          fullLabel: step.label, truncated: sTrunc, status: step.status,
          x, y, seed: seedFor(stepPath), parentId: lineId, isFirstPendingOnFocus,
        });
        edges.push({ fromId: lineId, toId: stepId, kind: 'twig' });
      } else {
        const action = child.item;
        const ai = line.nextActions.indexOf(action);
        const actionPath = `${linePath}.nextActions.${ai}`;
        const { label: aLabel, truncated: aTrunc } = truncateLabel(action.action);
        const aWrapped = wrapLabelTwoLines(aLabel);
        const actionId = `${lineId}-action-${ai}`;
        nodes.push({
          id: actionId, kind: 'action', path: actionPath, label: aWrapped.line1, label2: aWrapped.line2,
          fullLabel: action.action, truncated: aTrunc, status: action.status,
          x, y, seed: seedFor(actionPath), parentId: lineId,
        });
        edges.push({ fromId: lineId, toId: actionId, kind: 'twig' });
      }
    });
  });

  // Outer ring: people + stakeholders, on their own independent ring beyond
  // the twigs so they never collide with plan content.
  const peopleCount = peopleList.length;
  peopleList.forEach(({ p, path, kind }, i) => {
    const { label, truncated } = truncateLabel(p.name);
    const angle = (i / Math.max(peopleCount, 1)) * Math.PI * 2 - Math.PI / 2;
    const { x, y } = project(angle, outerRadius);
    const id = `${kind}-${i}`;
    const node: DoodleNode = { id, kind, path, label, fullLabel: p.name, truncated, x, y, seed: seedFor(path) };
    nodes.push(node);
    peopleNodes.push(node);
  });

  // Risk nodes sit most of the way out to their target person/stakeholder
  // (not at the midpoint) so they land near the outer ring, clear of the
  // twig zone entirely rather than potentially landing on top of an
  // unrelated line's twigs.
  goal.riskNotes.forEach((r, ri) => {
    if (!r.dependsOn) return;
    const target = peopleNodes.find((n) => n.fullLabel === r.dependsOn);
    if (!target) return;
    const riskPath = `riskNotes.${ri}`;
    const { label, truncated } = truncateLabel(r.item);
    const t = 0.72;
    const rx = cx + (target.x - cx) * t;
    const ry = cy + (target.y - cy) * t;
    const riskId = `risk-${ri}`;
    nodes.push({ id: riskId, kind: 'risk', path: riskPath, label, fullLabel: r.item, truncated, x: rx, y: ry, seed: seedFor(riskPath), dependsOnPersonId: target.id });
    edges.push({ fromId: riskId, toId: target.id, kind: 'risk-arrow' });
  });

  const height = cy + outerRadius + 60;
  return { nodes, edges, height };
}

// ---------------------------------------------------------------------------
// Collision-nudge: a small, deterministic, seeded relaxation pass so no two
// tap targets end up overlapping in radial mode. Runs a fixed number of
// iterations rather than to convergence, on purpose — a mind map only needs
// to look uncluttered, not physically simulated, and a fixed pass count
// keeps the result reproducible across renders/tests.
// ---------------------------------------------------------------------------

function nudgeCollisions(nodes: DoodleNode[], width: number): void {
  // Matches buildRadial's own label-overhang margin so the nudge pass never
  // pushes a node into a position whose label would spill past the
  // container edge, even after collision resolution moves it.
  const marginX = 50;
  const ITERATIONS = 60;
  for (let iter = 0; iter < ITERATIONS; iter++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        // The goal node is the one fixed anchor everything else is drawn
        // relative to — it's compared against (so nothing may land on it)
        // but never itself moved.
        const aFixed = a.kind === 'goal';
        const bFixed = b.kind === 'goal';
        if (aFixed && bFixed) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        // Two full tap-target half-widths (one per node) is the general
        // safe distance between centres — but a branch (line) label is
        // wider on screen than the generic tap-target minimum (it can wrap
        // to two lines, or run long even on one), so a twig-vs-line pair
        // uses the line's own real label width instead of the fixed
        // constant. That's what catches a twig label overlapping its own
        // line's branch heading (the reported bug). Scoped to twig/action
        // pairs against a line (not line-vs-goal, which is a separate,
        // structural radius concern) so this doesn't reopen crowding this
        // constant already handles correctly elsewhere.
        const aIsLineVsTwig = a.kind === 'line' && (b.kind === 'step' || b.kind === 'action');
        const bIsLineVsTwig = b.kind === 'line' && (a.kind === 'step' || a.kind === 'action');
        const minDx = aIsLineVsTwig ? labelHalfWidth(a) + HALF_W : bIsLineVsTwig ? labelHalfWidth(b) + HALF_W : HALF_W * 2;
        const minDy = (a.label2 || b.label2 ? 32 : HALF_H) * 2;
        if (Math.abs(dx) < minDx && Math.abs(dy) < minDy) {
          moved = true;
          // Deterministic push direction seeded from both node paths, so
          // the resolution is stable across renders rather than depending
          // on iteration order alone.
          const r = rng(hashSeed(a.path + '|' + b.path + '|' + iter))();
          const overlapX = minDx - Math.abs(dx);
          const overlapY = minDy - Math.abs(dy);
          // Push apart on whichever axis is actually the tighter fit — the
          // one with more overlap to close — rather than always preferring
          // vertical whenever the two nodes aren't dead-aligned on x. A
          // pair can be closer than minDx on x while already clearing minDy
          // on y (e.g. a long node like the goal label against an
          // off-angle twig at real desktop widths); pushing vertically in
          // that case does nothing; the loop must close the x gap instead.
          // Height is still free to grow and width is not, so vertical
          // remains the tie-breaker when both axes are equally tight. A
          // fixed node (the goal) never moves — its whole share of the
          // separation falls on the other node.
          if (overlapY <= overlapX) {
            const push = overlapY / 2 + 0.5;
            const dir = dy === 0 ? (r < 0.5 ? -1 : 1) : Math.sign(dy);
            if (!aFixed) a.y -= dir * (bFixed ? push * 2 : push);
            if (!bFixed) b.y += dir * (aFixed ? push * 2 : push);
          } else {
            const push = overlapX / 2 + 0.5;
            const dir = dx === 0 ? (r < 0.5 ? -1 : 1) : Math.sign(dx);
            if (!aFixed) a.x = Math.max(marginX, Math.min(width - marginX, a.x - dir * (bFixed ? push * 2 : push)));
            if (!bFixed) b.x = Math.max(marginX, Math.min(width - marginX, b.x + dir * (aFixed ? push * 2 : push)));
          }
        }
      }
    }
    if (!moved) break;
  }
}

/** A stable per-node deterministic jitter helper, exposed for the renderer
 * to add hand-wobble without reshuffling between renders. */
export function nodeJitter(node: DoodleNode): number {
  return rng(node.seed)();
}
