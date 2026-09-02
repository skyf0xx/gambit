// Mermaid flowchart LR: one row per line of effort/critical-path step,
// converging on a single goal node. Deliberately flat — no nesting, no
// subgraphs, hard-capped node count — so it stays a diagram a non-dev can
// read in one glance rather than something a draftsman would produce.

const MAX_STEPS = 6;

function sanitizeLabel(s) {
  const cleaned = s.replace(/["`]/g, "'").replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 60) return cleaned;
  return `${cleaned.slice(0, 57).replace(/\s+\S*$/, '')}…`;
}

// steps: a plain string array — plan.criticalPath or systemsNotes.topFindings.
export function renderLinesOfOperation(steps) {
  if (!steps || !steps.length) return null;

  const capped = steps.slice(0, MAX_STEPS);
  const lines = ['flowchart LR'];

  capped.forEach((step, i) => {
    lines.push(`  n${i}["${sanitizeLabel(step)}"]`);
    if (i > 0) lines.push(`  n${i - 1} --> n${i}`);
  });

  // No terminal "goal" node — the goal is already the page header above
  // every card; repeating its full title inside the diagram as a shape
  // both duplicates it and, being long free text, breaks Mermaid's
  // auto-sizing (a giant circle dwarfing the actual steps).
  lines.push(`  n${capped.length - 1} --> done(( ))`);

  return lines.join('\n');
}
