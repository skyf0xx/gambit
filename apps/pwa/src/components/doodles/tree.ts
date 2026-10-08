import { currentFocusEntry, taskState } from '@gambit/core';
import type { Goal } from '../../lib/types';
import { lineStretches } from '../../lib/stretches';

// The plan as Doodles draws it: the goal at the top and each line of
// operation climbing toward it, earliest at the bottom. No DOM, no layout;
// this only decides what goes in each column and in what order. Doodles.tsx
// stacks the columns and pencils in the links.
//
// People appear only where the plan reaches them: a message carries the
// name it goes to. Risks aren't drawn; the Risks page holds them.

export type NodeState = 'done' | 'live' | 'blocked' | 'waiting' | 'proposed' | 'awaiting';

export interface DoodleNode {
  path: string; // LinePath, for gambit:goto
  label: string;
  kind: 'task' | 'milestone' | 'fork';
  state: NodeState;
  /** A message's recipient, from `people` or `stakeholders`. */
  to?: string;
  when?: string;
  /** A fork's or escalation's condition, said as "if …". */
  condition?: string;
  /** Waiting escalations of this message: "no reply in N days → move". */
  chain?: { path: string; days: number; action: string }[];
  focus?: boolean;
}

export interface DoodleColumn {
  path: string;
  label: string;
  status?: string;
  focus: boolean;
  /** Bottom to top: the first is where the line started. */
  nodes: DoodleNode[];
  /** Forks no milestone lists: "if things change", drawn at the top. */
  forks: DoodleNode[];
}

/** A dependency between lines: `from` must happen before `to`. */
export interface DoodleLink {
  from: string;
  to: string;
}

export interface DoodleMap {
  goal: string;
  columns: DoodleColumn[];
  links: DoodleLink[];
}

const norm = (s: string) => s.trim().toLowerCase();

/** Null when there's no plan to draw yet. */
export function buildDoodleMap(goal: Goal, day: string): DoodleMap | null {
  const plan = goal.plan;
  const lines = plan?.linesOfOperation ?? [];
  if (!plan || lines.length === 0) return null;

  const focusText = currentFocusEntry(goal.log)?.focusLine;
  const isFocus = (text: string) => focusText != null && norm(text) === norm(focusText);

  // Every id in the plan, with its path and line, for links across lines.
  const where = new Map<string, { path: string; li: number }>();
  lines.forEach((l, li) => {
    l.criticalPath.forEach((s, si) => s.id && where.set(s.id, { path: `plan.linesOfOperation.${li}.criticalPath.${si}`, li }));
    l.nextActions.forEach((a, ai) => a.id && where.set(a.id, { path: `plan.linesOfOperation.${li}.nextActions.${ai}`, li }));
  });
  const links: DoodleLink[] = [];
  const linkFrom = (after: string[] | undefined, li: number, path: string) => {
    for (const id of after ?? []) {
      const w = where.get(id);
      if (w && w.li !== li) links.push({ from: w.path, to: path });
    }
  };

  const columns = lines.map((l, li): DoodleColumn => {
    const base = `plan.linesOfOperation.${li}`;
    const { steps, stretchOf, linked } = lineStretches(l, li, plan);
    const tasks = l.nextActions.map((a, ai) => ({ a, path: `${base}.nextActions.${ai}`, state: taskState(a, plan, day) }));
    const live = tasks.filter((t) => t.state !== 'dropped');
    const isFork = (t: (typeof tasks)[number]) => t.state === 'waiting' && t.a.if != null && 'event' in t.a.if;
    const isChained = (t: (typeof tasks)[number]) => t.state === 'waiting' && t.a.if != null && 'noReply' in t.a.if;
    const messageOf = (t: (typeof tasks)[number]) => {
      const id = t.a.if && 'noReply' in t.a.if ? t.a.if.noReply : undefined;
      return live.find((m) => m.a.id === id);
    };
    // A waiting escalation beside its message hangs off that message; one
    // whose message sits in another stretch keeps its own place.
    const besideMessage = (t: (typeof tasks)[number]) => { const m = messageOf(t); return m != null && stretchOf(m.a) === stretchOf(t.a); };

    const node = (t: (typeof tasks)[number]): DoodleNode => {
      const { a, path } = t;
      const awaiting = a.status === 'done' && a.to && !a.replied;
      const cond = a.if;
      let condition: string | undefined;
      if (t.state === 'waiting' && cond) {
        if ('event' in cond) condition = cond.event;
        else { const m = messageOf(t); condition = `${m?.a.to ?? 'they'} ${m?.a.to ? "doesn't" : "don't"} reply in ${cond.days} days`; }
      }
      const chain = live
        .filter((e) => isChained(e) && messageOf(e)?.path === path && besideMessage(e))
        .map((e) => ({ path: e.path, days: (e.a.if as { days: number }).days, action: e.a.action }));
      linkFrom(a.after, li, path);
      return {
        path,
        label: a.action,
        kind: condition ? 'fork' : 'task',
        state: awaiting ? 'awaiting' : (t.state as NodeState),
        to: a.to,
        when: a.when,
        condition,
        chain: chain.length > 0 ? chain : undefined,
        focus: isFocus(a.action),
      };
    };

    const inStretch = (t: (typeof tasks)[number]) => (isFork(t) ? linked(t.a) : isChained(t) ? !besideMessage(t) : true);
    const nodes: DoodleNode[] = [];
    for (let k = 0; k <= steps.length; k++) {
      for (const t of live) if (inStretch(t) && stretchOf(t.a) === k) nodes.push(node(t));
      const m = steps[k];
      if (!m) continue;
      linkFrom(m.st.after, li, m.path);
      nodes.push({ path: m.path, label: m.st.label, kind: 'milestone', state: m.reached ? 'done' : 'live', focus: isFocus(m.st.label) });
    }
    const forks = live.filter((t) => isFork(t) && !linked(t.a)).map(node);
    return { path: base, label: l.label, status: l.status, focus: Boolean(l.focus), nodes, forks };
  });

  return { goal: goal.goal, columns, links };
}
