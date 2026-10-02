import type { LinePath } from '../changes';
import type { Goal } from '../types';
import type { Mark } from './types';

// Pure derivation of every line's mark from the goal record plus in-tab
// session state (brand/identity.md §05 "Pencil marks"). No DOM, no drawing —
// MarksLayer reads the result and paints it against the real layout.

export interface SessionSnapshot {
  turn: { goalId: string; turnId: string; lines: { path: LinePath; text: string }[]; animated: boolean } | null;
  dropped: Map<string, Set<LinePath>>;
}

export interface DerivedMarks {
  byPath: Map<LinePath, Mark>;
  arrows: { from: LinePath; to: LinePath }[];
}

interface Named {
  path: LinePath;
  text: string;
}

const norm = (s: string) => s.trim().toLowerCase();

// Every next action / step / sub-item / criterion, with enough context to
// find "the line of operation containing X" and to flip status to a tick.
interface PlanLine extends Named {
  status?: 'proposed' | 'pending' | 'done' | 'dropped';
  loIndex: number; // index of the containing lineOfOperation
}

function collectPlanLines(goal: Goal): PlanLine[] {
  const out: PlanLine[] = [];
  (goal.plan?.linesOfOperation ?? []).forEach((line, li) => {
    line.criticalPath.forEach((step, si) => {
      out.push({ path: `plan.linesOfOperation.${li}.criticalPath.${si}`, text: step.label, status: step.status, loIndex: li });
      (step.items ?? []).forEach((it, ii) => {
        out.push({ path: `plan.linesOfOperation.${li}.criticalPath.${si}.items.${ii}`, text: it.label, status: it.status, loIndex: li });
      });
    });
    line.nextActions.forEach((a, ai) => {
      out.push({ path: `plan.linesOfOperation.${li}.nextActions.${ai}`, text: a.action, status: a.status, loIndex: li });
    });
  });
  return out;
}

function collectCriteria(goal: Goal): Named[] {
  return (goal.successCriteria ?? []).map((c, i) => ({ path: `successCriteria.${i}`, text: c.text }));
}

function collectPeopleAndStakeholders(goal: Goal): Named[] {
  const out: Named[] = [];
  (goal.people ?? []).forEach((p, i) => out.push({ path: `people.${i}`, text: p.name }));
  (goal.stakeholders ?? []).forEach((s, i) => out.push({ path: `stakeholders.${i}`, text: s.name }));
  return out;
}

/**
 * Derive every line's mark plus the arrow list, from the goal record and the
 * in-tab session snapshot. One mark per line; event marks (loop, cancel) win
 * over derived ones. At most one loop, one highlight and one star.
 */
export function deriveMarks(goal: Goal, goalId: string, sessionState: SessionSnapshot): DerivedMarks {
  const byPath = new Map<LinePath, Mark>();
  const arrows: { from: LinePath; to: LinePath }[] = [];

  const planLines = collectPlanLines(goal);
  const criteria = collectCriteria(goal);
  const names = collectPeopleAndStakeholders(goal);

  const set = (path: LinePath, mark: Mark) => {
    if (byPath.has(path)) return; // one mark per line; first writer wins per priority order below
    byPath.set(path, mark);
  };

  // --- tick: done next action/step/sub-item, or a criterion scored 'met' ---
  for (const pl of planLines) {
    if (pl.status === 'done') set(pl.path, { kind: 'tick', sr: 'done' });
  }
  const statusByCriterionText = new Map((goal.criteriaStatus ?? []).map((c) => [norm(c.text), c.status]));
  criteria.forEach((c) => {
    const status = statusByCriterionText.get(norm(c.text));
    if (status === 'met') set(c.path, { kind: 'tick', sr: 'done' });
  });

  // --- highlight: focusLine on the latest log entry that has one ---
  let focusPath: LinePath | undefined;
  const log = goal.log ?? [];
  for (let i = log.length - 1; i >= 0; i--) {
    const fl = log[i].focusLine;
    if (fl) {
      const target = norm(fl);
      const hit = [...planLines, ...criteria].find((n) => norm(n.text) === target);
      if (hit) {
        focusPath = hit.path;
        set(hit.path, { kind: 'highlight', sr: 'focus' });
      }
      break;
    }
  }

  // --- star: first pending step/next action in the LoO containing the focus
  // line; fallback to a line whose label equals systemsNotes' schwerpunkt.
  // When the highlighted focus is itself an open step or action, it already
  // says what to do next, and a star beside a second line only competes
  // with it. ---
  let starLoIndex: number | undefined;
  const focusOpen = planLines.some((pl) => pl.path === focusPath && (pl.status ?? 'pending') === 'pending');
  if (focusOpen) {
    // no star
  } else if (focusPath) {
    const containing = planLines.find((pl) => pl.path === focusPath);
    if (containing) starLoIndex = containing.loIndex;
  }
  if (!focusOpen && starLoIndex === undefined && goal.systemsNotes?.schwerpunkt) {
    const target = norm(goal.systemsNotes.schwerpunkt);
    const idx = (goal.plan?.linesOfOperation ?? []).findIndex((l) => norm(l.label) === target);
    if (idx >= 0) starLoIndex = idx;
  }
  if (starLoIndex !== undefined) {
    const candidate = planLines.find((pl) => pl.loIndex === starLoIndex && (pl.status ?? 'pending') === 'pending');
    if (candidate) set(candidate.path, { kind: 'star', sr: 'next up' });
  }

  // --- arrow: riskNotes[].dependsOn matched to a person/stakeholder name.
  // Per spec, only one arrow is ever drawn; every other dependsOn risk gets
  // just the pencilled "→ Name" text fallback (no `kind: 'arrow'`, so
  // MarksLayer draws nothing for it and Line's `mark.to` supplies the text).
  // All of them keep the same SR text via `arrowSr` below. ---
  let arrowDrawn = false;
  (goal.riskNotes ?? []).forEach((r, i) => {
    if (!r.dependsOn) return;
    const target = names.find((n) => norm(n.text) === norm(r.dependsOn!));
    if (!target) return;
    const from: LinePath = `riskNotes.${i}`;
    const sr = `depends on ${r.dependsOn}`;
    if (!arrowDrawn) {
      set(from, { kind: 'arrow', sr, to: target.path });
      arrows.push({ from, to: target.path });
      arrowDrawn = true;
    } else {
      // Fallback: text-only "→ Name", no drawn arrow, same SR text.
      set(from, { kind: 'arrow-text', sr, to: target.path, toName: r.dependsOn });
    }
  });

  // --- question: an open decision ---
  (goal.decisions ?? []).forEach((d, i) => {
    if (d.status === 'open') set(`decisions.${i}`, { kind: 'question', sr: 'open question' });
  });

  // --- event marks: cancel (dropped) and loop (last turn's writes) win ---
  const droppedForGoal = sessionState.dropped.get(goalId) ?? new Set<LinePath>();
  for (const path of droppedForGoal) {
    byPath.set(path, { kind: 'cancel', sr: 'cancelled', pencil: true });
  }

  const turn = sessionState.turn;
  if (turn && turn.goalId === goalId && turn.lines.length > 0) {
    const first = turn.lines[0];
    byPath.set(first.path, { kind: 'loop', sr: 'changed in your last chat', note: 'changed' });
  }

  return { byPath, arrows };
}

// Kept for potential reuse by MarksLayer (line rects need path->text lookup
// independent of derivation); currently unused directly by deriveMarks.
export function allLines(goal: Goal): Named[] {
  return [...collectPlanLines(goal), ...collectCriteria(goal), ...collectPeopleAndStakeholders(goal)];
}
