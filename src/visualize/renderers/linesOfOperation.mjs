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

// Mermaid's `click nodeId call callback() "tooltip"` directive is the
// documented way to attach a hover tooltip (rendered as a title attr on the
// node's SVG group) without breaking securityLevel: 'strict' in page.mjs —
// unlike an href click target, a bound callback name plus a quoted tooltip
// string is allowed under strict mode. The callback itself is a harmless
// no-op defined once in page.mjs; only the tooltip text is meaningful here.
function sanitizeTooltip(s) {
  const cleaned = s.replace(/["`]/g, "'").replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 280) return cleaned;
  return `${cleaned.slice(0, 277).replace(/\s+\S*$/, '')}…`;
}

// steps: an array of { label, detail? } — plan.criticalPath or
// systemsNotes.topFindings. Returns { mermaid, tooltips: [{id, text}] } or
// null when there's nothing to draw.
export function renderLinesOfOperation(steps) {
  if (!steps || !steps.length) return null;

  const capped = steps.slice(0, MAX_STEPS);
  const lines = ['flowchart LR'];
  const tooltips = [];

  capped.forEach((step, i) => {
    const id = `n${i}`;
    lines.push(`  ${id}["${sanitizeLabel(step.label)}"]`);
    if (i > 0) lines.push(`  n${i - 1} --> ${id}`);
    if (step.detail) tooltips.push({ id, text: sanitizeTooltip(step.detail) });
  });

  // No terminal "goal" node — the goal is already the page header above
  // every card; repeating its full title inside the diagram as a shape
  // both duplicates it and, being long free text, breaks Mermaid's
  // auto-sizing (a giant circle dwarfing the actual steps).
  lines.push(`  n${capped.length - 1} --> done(( ))`);

  for (const t of tooltips) {
    lines.push(`  click ${t.id} call ___gambitTooltip() "${t.text}"`);
  }

  return { mermaid: lines.join('\n'), tooltips };
}
