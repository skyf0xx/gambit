// Mermaid flowchart: the goal (or "you") as the center node, everyone else
// as a spoke labeled with stance/power. Capped at MAX_NODES — beyond that
// a hub-and-spoke diagram stops being readable, so it falls back to a
// plain table instead of drawing an unreadable web.

const MAX_NODES = 8;

function sanitizeLabel(s) {
  const cleaned = s.replace(/["`]/g, "'").replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 50) return cleaned;
  return `${cleaned.slice(0, 47).replace(/\s+\S*$/, '')}…`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Same tooltip mechanism as linesOfOperation.mjs — a bound `click ... call`
// directive survives securityLevel: 'strict' and Mermaid renders it as a
// title attr on the node's SVG group.
function sanitizeTooltip(s) {
  const cleaned = s.replace(/["`]/g, "'").replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 280) return cleaned;
  return `${cleaned.slice(0, 277).replace(/\s+\S*$/, '')}…`;
}

function fallbackTable(labels) {
  const rows = labels
    .slice(0, MAX_NODES)
    .map((l) => `<tr><td>${escapeHtml(l)}</td></tr>`)
    .join('\n');
  return {
    kind: 'table',
    html: `<table class="fallback-table"><tbody>${rows}</tbody></table><p class="empty">+${labels.length - MAX_NODES} more — too many to diagram legibly.</p>`,
  };
}

// nodes: [{ name, edgeLabel, detail? }]
function buildFlowchart(centerLabel, nodes) {
  const lines = ['flowchart LR', `  center(("${sanitizeLabel(centerLabel)}"))`];
  const tooltips = [];
  nodes.forEach(({ name, edgeLabel, detail }, i) => {
    const id = `s${i}`;
    lines.push(`  ${id}["${sanitizeLabel(name)}"]`);
    lines.push(edgeLabel ? `  center -- "${sanitizeLabel(edgeLabel)}" --> ${id}` : `  center --> ${id}`);
    if (detail) tooltips.push({ id, text: sanitizeTooltip(detail) });
  });
  for (const t of tooltips) {
    lines.push(`  click ${t.id} call ___gambitTooltip() "${t.text}"`);
  }
  return { kind: 'mermaid', text: lines.join('\n'), tooltips };
}

// stakeholders: [{ name, power, stanceCurrent, stanceTarget, via, detail? }]
export function renderStakeholderNetwork(stakeholders, { centerLabel = 'Goal' } = {}) {
  if (!stakeholders.length) return null;
  if (stakeholders.length > MAX_NODES) {
    return fallbackTable(stakeholders.map((s) => `${s.name} — ${s.stanceCurrent} → ${s.stanceTarget}`));
  }
  const nodes = stakeholders.map((s) => ({
    name: s.name,
    edgeLabel: `${s.stanceCurrent} → ${s.stanceTarget}`,
    detail: s.detail,
  }));
  return buildFlowchart(centerLabel, nodes);
}

// riskNotes: [{ item, detail?, source, accepted }] — detail already existed
// here and served as the edge label; it now also becomes the hover tooltip
// since it's the same "why this risk matters" elaboration.
export function renderRiskNetwork(riskNotes, { centerLabel = 'Goal' } = {}) {
  if (!riskNotes.length) return null;
  if (riskNotes.length > MAX_NODES) {
    return fallbackTable(riskNotes.map((r) => r.item));
  }
  const nodes = riskNotes.map((r) => ({
    name: r.item,
    edgeLabel: r.detail ?? '',
    detail: r.detail,
  }));
  return buildFlowchart(centerLabel, nodes);
}
