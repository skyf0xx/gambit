// Mermaid `timeline` — strictly chronological, no branching. Used for
// review (expected vs actual, dated) and any dated, resolvable list.

function parseEntries(body) {
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^-\s+/.test(l))
    .map((l) => l.replace(/^-\s+/, ''));
}

function sanitizeLabel(s) {
  return s.replace(/:/g, ' -').slice(0, 60);
}

export function renderTimeline(sectionBody) {
  const entries = parseEntries(sectionBody);
  if (!entries.length) return null;

  const lines = ['timeline'];
  for (const entry of entries) {
    const dateMatch = entry.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : 'undated';
    const rest = entry.replace(dateMatch?.[0] ?? '', '').replace(/^\s*[-—:]\s*/, '');
    lines.push(`  ${date} : ${sanitizeLabel(rest)}`);
  }

  return lines.join('\n');
}
