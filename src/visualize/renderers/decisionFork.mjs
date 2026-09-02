// Mermaid flowchart TD: one decision node, up to 4 option branches, no
// further nesting. Used for `decide` (a recorded choice + reverse-if) and
// `negotiate` (BATNA/ZOPA framed as a choice point).

const MAX_OPTIONS = 4;

function sanitizeLabel(s) {
  const cleaned = s.replace(/["`]/g, "'").replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 60) return cleaned;
  return `${cleaned.slice(0, 57).replace(/\s+\S*$/, '')}…`;
}

// Matches "- [YYYY-MM-DD] what was chosen — reverse if: signal"
function parseDecisions(body) {
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^-\s+/.test(l))
    .map((l) => l.replace(/^-\s+/, ''));
}

export function renderDecisionFork(sectionBody) {
  const decisions = parseDecisions(sectionBody);
  if (!decisions.length) return null;

  // Most recent decision only — a diagram per decision would sprawl, and
  // only the latest one is live; earlier ones are just history.
  const latest = decisions[0];
  const reverseSplit = latest.split(/reverse if:\s*/i);
  const chosen = reverseSplit[0].replace(/^\[\d{4}-\d{2}-\d{2}\]\s*/, '').replace(/—\s*$/, '').trim();
  const reverseIf = reverseSplit[1]?.trim();

  const lines = [
    'flowchart TD',
    `  d{"Decision"}`,
    `  d --> chosen["${sanitizeLabel(chosen)}"]`,
  ];

  if (reverseIf) {
    lines.push(`  chosen -.->|"reverses if: ${sanitizeLabel(reverseIf)}"| reversed["revisit"]`);
  }

  return lines.join('\n');
}
