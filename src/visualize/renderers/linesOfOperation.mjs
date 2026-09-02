// Mermaid flowchart LR: one row per line of effort/critical-path step,
// converging on a single goal node. Deliberately flat — no nesting, no
// subgraphs, hard-capped node count — so it stays a diagram a non-dev can
// read in one glance rather than something a draftsman would produce.

const MAX_STEPS = 6;

function sanitizeId(s, i) {
  return `n${i}`;
}

function sanitizeLabel(s) {
  const cleaned = s.replace(/["`]/g, "'").replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 60) return cleaned;
  return `${cleaned.slice(0, 57).replace(/\s+\S*$/, '')}…`;
}

// Parses a "Critical path: [A] → [B] → [D]" statement, joining any wrapped
// continuation lines (soft-wrapped prose, not a new bullet/heading) so a
// long critical path split across physical lines still parses as one.
function parseCriticalPath(body) {
  const lines = body.split('\n');
  const startIdx = lines.findIndex((l) => /critical path/i.test(l));
  if (startIdx === -1) return null;

  const block = [lines[startIdx]];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*$/.test(l) || /^\s*(-|\d+\.|##)/.test(l)) break;
    block.push(l);
  }

  const steps = [...block.join(' ').matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  return steps.length > 1 ? steps : null;
}

// Falls back to one node per top-level bullet if there's no explicit
// "Critical path: A → B" line (e.g. Systems notes' lines of effort).
function parseBullets(body) {
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^-\s+/.test(l))
    .map((l) => l.replace(/^-\s+/, ''))
    .slice(0, MAX_STEPS);
}

export function renderLinesOfOperation(sectionBody) {
  const steps = parseCriticalPath(sectionBody) ?? parseBullets(sectionBody);

  if (!steps.length) return null;

  const capped = steps.slice(0, MAX_STEPS);
  const lines = ['flowchart LR'];

  capped.forEach((step, i) => {
    const id = sanitizeId(step, i);
    lines.push(`  ${id}["${sanitizeLabel(step)}"]`);
    if (i > 0) lines.push(`  n${i - 1} --> ${id}`);
  });

  // No terminal "goal" node — the goal is already the page header above
  // every card; repeating its full title inside the diagram as a shape
  // both duplicates it and, being long free text, breaks Mermaid's
  // auto-sizing (a giant circle dwarfing the actual steps).
  lines.push(`  n${capped.length - 1} --> done(( ))`);

  return lines.join('\n');
}
