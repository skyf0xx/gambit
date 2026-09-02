// Mermaid flowchart TD: one decision node, the chosen option, and a
// reverse-if branch. Used for `decide` (a recorded choice + reverse-if).

function sanitizeLabel(s) {
  const cleaned = s.replace(/["`]/g, "'").replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 60) return cleaned;
  return `${cleaned.slice(0, 57).replace(/\s+\S*$/, '')}…`;
}

// decisions: [{ date, choice, because?, reverseIf, reviewBy? }], append-only
// (oldest first, matching `decide`'s append-to-array behavior and `log`'s
// convention). Most recent decision only (last element) — a diagram per
// decision would sprawl, and only the latest one is live; earlier ones are
// just history.
export function renderDecisionFork(decisions) {
  if (!decisions || !decisions.length) return null;

  const latest = decisions[decisions.length - 1];

  const lines = [
    'flowchart TD',
    `  d{"Decision"}`,
    `  d --> chosen["${sanitizeLabel(latest.choice)}"]`,
  ];

  if (latest.reverseIf) {
    lines.push(`  chosen -.->|"reverses if: ${sanitizeLabel(latest.reverseIf)}"| reversed["revisit"]`);
  }

  return lines.join('\n');
}
