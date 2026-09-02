// Mermaid flowchart: the goal (or "you") as the center node, everyone else
// as a spoke labeled with stance/power. Capped at MAX_NODES — beyond that
// a hub-and-spoke diagram stops being readable, so it falls back to a
// plain table instead of drawing an unreadable web.

const MAX_NODES = 8;

// Matches "- name — power: high — stance: opposed → neutral — via ask"
// (stakeholders) or a plain "- name — description" (threat's risk notes).
function parseEntries(body) {
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^-\s+/.test(l))
    .map((l) => l.replace(/^-\s+/, ''));
}

function sanitizeLabel(s) {
  const cleaned = s.replace(/["`]/g, "'").replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 50) return cleaned;
  return `${cleaned.slice(0, 47).replace(/\s+\S*$/, '')}…`;
}

export function renderNetwork(sectionBody, { centerLabel = 'Goal' } = {}) {
  const entries = parseEntries(sectionBody);
  if (!entries.length) return null;

  if (entries.length > MAX_NODES) {
    const rows = entries
      .slice(0, MAX_NODES)
      .map((e) => `<tr><td>${escapeHtml(e)}</td></tr>`)
      .join('\n');
    return {
      kind: 'table',
      html: `<table class="fallback-table"><tbody>${rows}</tbody></table><p class="empty">+${entries.length - MAX_NODES} more — too many to diagram legibly.</p>`,
    };
  }

  const lines = ['flowchart LR', `  center(("${sanitizeLabel(centerLabel)}"))`];
  entries.forEach((entry, i) => {
    const [namePart, ...rest] = entry.split(/\s*—\s*/);
    // Prefer a single, most-legible descriptor over concatenating every
    // field — "stance: opposed → neutral" says more at a glance than the
    // full "power: high / stance: opposed → neutral / via public comment".
    const stance = rest.find((r) => /^stance:/i.test(r));
    const edgeLabel = stance ?? rest[0] ?? '';
    lines.push(`  s${i}["${sanitizeLabel(namePart)}"]`);
    lines.push(edgeLabel ? `  center -- "${sanitizeLabel(edgeLabel)}" --> s${i}` : `  center --> s${i}`);
  });

  return { kind: 'mermaid', text: lines.join('\n') };
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
