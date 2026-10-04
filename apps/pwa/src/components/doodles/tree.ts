import { currentFocusEntry, milestoneReached } from '@gambit/core';
import type { Goal } from '../../lib/types';

// The goal record as a plain tree for the Doodles mind map — no DOM, no
// layout. Positioning, drawing, pan and zoom are all markmap's job
// (Doodles.tsx); this only decides what goes on the map and in what order.

export interface DoodleItem {
  path: string; // LinePath, for gambit:goto
  label: string;
  kind: 'goal' | 'group' | 'line' | 'item' | 'person' | 'risk';
  done?: boolean;
  proposed?: boolean;
  focus?: boolean; // the current focus line
  children: DoodleItem[];
}

const norm = (s: string) => s.trim().toLowerCase();

/** The goal as a tree: lines of operation (with their steps and next
 * actions), what done looks like, and the people involved (each with the
 * risks that depend on them). Null when there's no plan to draw yet. */
export function buildDoodleTree(goal: Goal): DoodleItem | null {
  const lines = goal.plan?.linesOfOperation ?? [];
  if (lines.length === 0) return null;

  const focusText = currentFocusEntry(goal.log)?.focusLine;
  const isFocus = (text: string) => focusText != null && norm(text) === norm(focusText);
  const children: DoodleItem[] = [];

  lines.forEach((line, li) => {
    const base = `plan.linesOfOperation.${li}`;
    const items: DoodleItem[] = [];
    line.criticalPath.forEach((s, si) => {
      items.push({ path: `${base}.criticalPath.${si}`, label: s.label, kind: 'item', done: milestoneReached(s, goal.plan), focus: isFocus(s.label), children: [] });
    });
    line.nextActions.forEach((a, ai) => {
      if (a.status === 'dropped') return;
      items.push({ path: `${base}.nextActions.${ai}`, label: a.action, kind: 'item', done: a.status === 'done', proposed: a.status === 'proposed', focus: isFocus(a.action), children: [] });
    });
    children.push({ path: base, label: line.label, kind: 'line', done: line.status === 'done', children: items });
  });

  if (goal.successCriteria.length > 0) {
    const met = new Set(goal.criteriaStatus.filter((c) => c.status === 'met').map((c) => norm(c.text)));
    children.push({
      path: 'successCriteria.0',
      label: 'Done looks like',
      kind: 'group',
      children: goal.successCriteria.map((c, i) => ({ path: `successCriteria.${i}`, label: c.text, kind: 'item' as const, done: met.has(norm(c.text)), focus: isFocus(c.text), children: [] })),
    });
  }

  const risksOn = (name: string): DoodleItem[] =>
    goal.riskNotes.flatMap((r, ri) => (r.dependsOn && norm(r.dependsOn) === norm(name) ? [{ path: `riskNotes.${ri}`, label: r.item, kind: 'risk' as const, children: [] }] : []));
  const people: DoodleItem[] = [
    ...goal.people.map((p, i) => ({ path: `people.${i}`, label: p.name, kind: 'person' as const, children: risksOn(p.name) })),
    ...goal.stakeholders.map((s, i) => ({ path: `stakeholders.${i}`, label: s.name, kind: 'person' as const, children: risksOn(s.name) })),
  ];
  if (people.length > 0) children.push({ path: people[0].path, label: 'People', kind: 'group', children: people });

  return { path: 'goal', label: goal.goal, kind: 'goal', children };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** markmap's node shape. Its `content` is inserted as HTML, so every label
 * (user- and model-written text) is escaped here. */
export interface MarkmapNode {
  content: string;
  children: MarkmapNode[];
}

export function toMarkmap(item: DoodleItem): MarkmapNode {
  const cls = ['doodle-node', `doodle-${item.kind}`, item.focus && 'doodle-focus', item.proposed && 'doodle-proposed'].filter(Boolean).join(' ');
  const text = `${item.done ? '✓ ' : ''}${item.kind === 'risk' ? 'Risk: ' : ''}${item.label}`;
  return {
    content: `<span class="${cls}" data-goto="${escapeHtml(item.path)}">${escapeHtml(text)}</span>`,
    children: item.children.map(toMarkmap),
  };
}
