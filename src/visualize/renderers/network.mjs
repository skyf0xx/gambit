// Mermaid flowchart: the goal (or "you") as the center node, everyone else
// as a spoke labeled with stance/power. Capped at MAX_NODES — beyond that
// a hub-and-spoke diagram stops being readable, so it falls back to a
// plain table instead of drawing an unreadable web.

const MAX_NODES = 8;

// TD layout (see buildFlowchart below) gives each spoke's edge label its
// own row rather than cramming it into a short horizontal band, so a
// longer cap stays legible — raised from the old LR-era 50.
function sanitizeLabel(s, max = 70) {
  const cleaned = s.replace(/["`]/g, "'").replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 3).replace(/\s+\S*$/, '')}…`;
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
// Plain TD still puts every spoke on the same rank under center, so Mermaid
// lays them out left-to-right — wide and short, cramping labels exactly
// like the old LR version did. Chaining spoke -> spoke with an invisible
// link (~~~) forces each one onto its own rank below the last, so the
// diagram grows a real row per stakeholder instead of a wide single band;
// the real "center -- label --> spoke" edges still carry the actual
// relationship, the invisible link only controls vertical placement.
function buildFlowchart(centerLabel, nodes) {
  const lines = ['flowchart TD', `  center(("${sanitizeLabel(centerLabel, 24)}"))`];
  const tooltips = [];
  nodes.forEach(({ name, edgeLabel, detail }, i) => {
    const id = `s${i}`;
    lines.push(`  ${id}["${sanitizeLabel(name)}"]`);
    lines.push(edgeLabel ? `  center -- "${sanitizeLabel(edgeLabel)}" --> ${id}` : `  center --> ${id}`);
    if (i > 0) lines.push(`  s${i - 1} ~~~ ${id}`);
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
