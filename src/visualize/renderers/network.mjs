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

function buildFlowchart(centerLabel, nodes) {
  const lines = ['flowchart LR', `  center(("${sanitizeLabel(centerLabel)}"))`];
  nodes.forEach(({ name, edgeLabel }, i) => {
    lines.push(`  s${i}["${sanitizeLabel(name)}"]`);
    lines.push(edgeLabel ? `  center -- "${sanitizeLabel(edgeLabel)}" --> s${i}` : `  center --> s${i}`);
  });
  return { kind: 'mermaid', text: lines.join('\n') };
}

// stakeholders: [{ name, power, stanceCurrent, stanceTarget, via }]
export function renderStakeholderNetwork(stakeholders, { centerLabel = 'Goal' } = {}) {
  if (!stakeholders.length) return null;
  if (stakeholders.length > MAX_NODES) {
    return fallbackTable(stakeholders.map((s) => `${s.name} — ${s.stanceCurrent} → ${s.stanceTarget}`));
  }
  const nodes = stakeholders.map((s) => ({
    name: s.name,
    edgeLabel: `${s.stanceCurrent} → ${s.stanceTarget}`,
  }));
  return buildFlowchart(centerLabel, nodes);
}

// riskNotes: [{ item, detail?, source, accepted }]
export function renderRiskNetwork(riskNotes, { centerLabel = 'Goal' } = {}) {
  if (!riskNotes.length) return null;
  if (riskNotes.length > MAX_NODES) {
    return fallbackTable(riskNotes.map((r) => r.item));
  }
  const nodes = riskNotes.map((r) => ({
    name: r.item,
    edgeLabel: r.detail ?? '',
  }));
  return buildFlowchart(centerLabel, nodes);
}
