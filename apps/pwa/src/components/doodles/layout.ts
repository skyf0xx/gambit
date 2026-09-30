import type { Goal } from '../../lib/types';
import { hashSeed, rng } from '../marks/stroke';

// Pure layout functions for the Doodles mind map — no DOM, no React, so they
// can be unit tested directly. Two coordinate modes share the same node
// list: 'radial' (desktop, container >= 640px) arranges branches as spokes
// around the centre; 'tree' (narrow) stacks them in a vertical column
// growing downward. Both are deterministic for the same goal: seeds come
// from each item's own LinePath (brand/identity.md — "randomness is seeded
// so the drawing doesn't reshuffle between renders").

export type NodeKind = 'goal' | 'criteria' | 'line' | 'step' | 'action' | 'person' | 'stakeholder' | 'risk';

export interface DoodleNode {
  id: string;
  kind: NodeKind;
  path: string; // LinePath used for gambit:goto and data-line
  label: string; // truncated label (display)
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
  const cy = mode === 'radial' ? height / 2 : 40;

  const focusLineText = currentFocusLine(goal);

  // Centre: goal title
  const goalNode: DoodleNode = {
    id: 'goal',
    kind: 'goal',
    path: 'goal',
    label: truncateLabel(goal.goal).label,
    fullLabel: goal.goal,
    truncated: truncateLabel(goal.goal).truncated,
    x: cx,
    y: cy,
    seed: seedFor('goal'),
  };
  nodes.push(goalNode);

  // Tree mode lays everything out on a single running vertical cursor, so
  // nothing above ever overlaps with what comes after it. Radial mode uses
  // polar coordinates instead.
  let treeCursorY = cy + 34;

  // Success criteria cluster near centre
  const criteriaCount = goal.successCriteria.length;
  goal.successCriteria.forEach((c, i) => {
    const path = `successCriteria.${i}`;
    const { label, truncated } = truncateLabel(c.text);
    const criteriaStatusEntry = goal.criteriaStatus.find((cs) => cs.text === c.text);
    const angle = (-Math.PI / 2) + (i - (criteriaCount - 1) / 2) * 0.35;
    const r = mode === 'radial' ? 70 : 0;
    let x: number, y: number;
    if (mode === 'radial') {
      x = cx + Math.cos(angle) * r;
      y = cy + Math.sin(angle) * r - 40;
    } else {
      x = cx;
      y = treeCursorY;
      treeCursorY += 40;
    }
    const node: DoodleNode = {
      id: path,
      kind: 'criteria',
      path,
      label,
      fullLabel: c.text,
      truncated,
      status: criteriaStatusEntry?.status === 'met' ? 'met' : undefined,
      x,
      y,
      seed: seedFor(path),
      parentId: 'goal',
    };
    nodes.push(node);
    edges.push({ fromId: 'goal', toId: path, kind: 'twig' });
  });

  if (mode === 'tree' && criteriaCount > 0) treeCursorY += 16;

  // Lines of operation as branches
  const lines = goal.plan?.linesOfOperation ?? [];
  const lineCount = lines.length;
  const branchRadius = mode === 'radial' ? Math.min(width, height) * 0.32 : 0;

  // Track people/stakeholder nodes for outer ring + risk arrows
  const peopleNodes: DoodleNode[] = [];

  if (mode === 'tree') treeCursorY += 24;

  lines.forEach((line, li) => {
    const linePath = `plan.linesOfOperation.${li}`;
    const isFocus = focusLineText != null && line.criticalPath.some((s) => s.label === focusLineText) || (focusLineText != null && line.nextActions.some((a) => a.action === focusLineText));
    const { label, truncated } = truncateLabel(line.label);

    let lx: number, ly: number;
    if (mode === 'radial') {
      const angle = (li / lineCount) * Math.PI * 2 - Math.PI / 2;
      lx = cx + Math.cos(angle) * branchRadius;
      ly = cy + Math.sin(angle) * branchRadius;
    } else {
      lx = cx;
      ly = treeCursorY;
      treeCursorY += 44;
    }

    const lineId = `line-${li}`;
    const lineNode: DoodleNode = {
      id: lineId,
      kind: 'line',
      path: linePath,
      label,
      fullLabel: line.label,
      truncated,
      status: line.status === 'done' ? 'done' : undefined,
      x: lx,
      y: ly,
      seed: seedFor(linePath),
      parentId: 'goal',
      isFocusLine: isFocus,
    };
    nodes.push(lineNode);
    edges.push({ fromId: 'goal', toId: lineId, kind: 'branch' });

    // Determine first pending step on the focus line
    let firstPendingFound = false;

    // Twigs: steps
    const visibleSteps = line.criticalPath.filter((s) => s.status !== 'dropped');
    visibleSteps.forEach((step, siOrig) => {
      const si = line.criticalPath.indexOf(step);
      const stepPath = `${linePath}.criticalPath.${si}`;
      const { label: sLabel, truncated: sTrunc } = truncateLabel(step.label);
      const isFirstPendingOnFocus = isFocus && !firstPendingFound && step.status === 'pending';
      if (isFirstPendingOnFocus) firstPendingFound = true;

      let sx: number, sy: number;
      if (mode === 'radial') {
        const angle = (li / lineCount) * Math.PI * 2 - Math.PI / 2;
        const stepR = branchRadius + 46 + siOrig * 44;
        sx = cx + Math.cos(angle) * stepR;
        sy = cy + Math.sin(angle) * stepR;
      } else {
        sx = cx + 40;
        sy = treeCursorY;
        treeCursorY += 44;
      }

      const stepId = `${lineId}-step-${si}`;
      nodes.push({
        id: stepId,
        kind: 'step',
        path: stepPath,
        label: sLabel,
        fullLabel: step.label,
        truncated: sTrunc,
        status: step.status,
        x: sx,
        y: sy,
        seed: seedFor(stepPath),
        parentId: lineId,
        isFirstPendingOnFocus,
      });
      edges.push({ fromId: lineId, toId: stepId, kind: 'twig' });
    });

    // Twigs: next actions (excluding dropped and proposed still shown as sticky dot per spec)
    const visibleActions = line.nextActions.filter((a) => a.status !== 'dropped');
    visibleActions.forEach((action, aiOrig) => {
      const ai = line.nextActions.indexOf(action);
      const actionPath = `${linePath}.nextActions.${ai}`;
      const { label: aLabel, truncated: aTrunc } = truncateLabel(action.action);

      let ax: number, ay: number;
      if (mode === 'radial') {
        const angle = (li / lineCount) * Math.PI * 2 - Math.PI / 2;
        const actionR = branchRadius + 46 + (visibleSteps.length + aiOrig) * 44;
        ax = cx + Math.cos(angle) * actionR;
        ay = cy + Math.sin(angle) * actionR;
      } else {
        ax = cx + 40;
        ay = treeCursorY;
        treeCursorY += 44;
      }

      const actionId = `${lineId}-action-${ai}`;
      nodes.push({
        id: actionId,
        kind: 'action',
        path: actionPath,
        label: aLabel,
        fullLabel: action.action,
        truncated: aTrunc,
        status: action.status,
        x: ax,
        y: ay,
        seed: seedFor(actionPath),
        parentId: lineId,
      });
      edges.push({ fromId: lineId, toId: actionId, kind: 'twig' });
    });

    if (mode === 'tree') treeCursorY += 16;
  });

  // Outer ring: people + stakeholders
  const peopleList = [...goal.people.map((p, i) => ({ p, path: `people.${i}`, kind: 'person' as const })), ...goal.stakeholders.map((s, i) => ({ p: s, path: `stakeholders.${i}`, kind: 'stakeholder' as const }))];
  const peopleCount = peopleList.length;
  const outerRadius = mode === 'radial' ? Math.min(width, height) * 0.46 : 0;
  let treePeopleY = treeCursorY + 20;

  peopleList.forEach(({ p, path, kind }, i) => {
    const { label, truncated } = truncateLabel(p.name);
    let x: number, y: number;
    if (mode === 'radial') {
      const angle = (i / Math.max(peopleCount, 1)) * Math.PI * 2 - Math.PI / 2;
      x = cx + Math.cos(angle) * outerRadius;
      y = cy + Math.sin(angle) * outerRadius;
    } else {
      x = cx;
      y = treePeopleY;
      treePeopleY += 44;
    }
    const id = `${kind}-${i}`;
    const node: DoodleNode = {
      id,
      kind,
      path,
      label,
      fullLabel: p.name,
      truncated,
      x,
      y,
      seed: seedFor(path),
    };
    nodes.push(node);
    peopleNodes.push(node);
  });

  // Risk arrows: each riskNote with dependsOn matching a person/stakeholder name
  goal.riskNotes.forEach((r, ri) => {
    if (!r.dependsOn) return;
    const target = peopleNodes.find((n) => n.fullLabel === r.dependsOn);
    if (!target) return;
    const riskPath = `riskNotes.${ri}`;
    const { label, truncated } = truncateLabel(r.item);
    // Place the risk node near the middle between centre and target, offset
    const rx = (cx + target.x) / 2;
    const ry = (cy + target.y) / 2 - 20;
    const riskId = `risk-${ri}`;
    nodes.push({
      id: riskId,
      kind: 'risk',
      path: riskPath,
      label,
      fullLabel: r.item,
      truncated,
      x: rx,
      y: ry,
      seed: seedFor(riskPath),
      dependsOnPersonId: target.id,
    });
    edges.push({ fromId: riskId, toId: target.id, kind: 'risk-arrow' });
  });

  // Compute bounds and pad width/height if tree mode grew past initial guess
  let finalWidth = width;
  let finalHeight = height;
  if (mode === 'tree') {
    finalHeight = Math.max(height, treePeopleY + 40);
  }

  return { nodes, edges, width: finalWidth, height: finalHeight, empty: false };
}

/** A stable per-node deterministic jitter helper, exposed for the renderer
 * to add hand-wobble without reshuffling between renders. */
export function nodeJitter(node: DoodleNode): number {
  return rng(node.seed)();
}
