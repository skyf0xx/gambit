// Plain styled HTML for label/detail-shaped sequences that were previously
// forced into sparse Mermaid flowcharts (Plan, Systems Notes, Risk Notes).
// These are linear or flat lists, not real relational data — a diagram
// only earns its space when the relationships themselves are the point
// (Stakeholders, Decisions). Text reads faster and scales with content
// instead of leaving mostly-empty node boxes.

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// steps: [{ label, detail?, status? }] — a plan line's criticalPath (status:
// pending/done/dropped), or systemsNotes.topFindings (no status field — a
// findings list, not a sequence of steps to complete, so it always falls
// through to the plain numbered-circle rendering below).
// Rendered as a numbered sequence so the "critical path" reading order is
// still visually obvious without a flowchart. A step carrying status gets
// the same done/dropped treatment as a nextAction (icon + dimmed label)
// instead of relying on prose in `detail` to signal it's finished.
export function renderOrderedList(steps) {
  if (!steps || !steps.length) return '<p class="empty">No items yet.</p>';
  const rows = steps.map((s) => {
    const status = s.status;
    const cls = status && status !== 'pending' ? ` class="${status}"` : '';
    const icon =
      status === 'done' ? '<span class="icon">✓</span>' : status === 'dropped' ? '<span class="icon">✕</span>' : '';
    return `<li${cls}>${icon}<span class="step-label">${escapeHtml(s.label)}</span>${
      s.detail ? `<span class="step-detail">${escapeHtml(s.detail)}</span>` : ''
    }</li>`;
  });
  return `<ol class="ordered-list">\n${rows.join('\n')}\n</ol>`;
}

// riskNotes: [{ item, detail?, source, accepted }] — flat, not sequenced,
// so plain bullets rather than a numbered chain.
export function renderRiskList(riskNotes) {
  if (!riskNotes || !riskNotes.length) return '<p class="empty">No items yet.</p>';
  const rows = riskNotes.map((r) => {
    const acceptedTag = r.accepted
      ? '<span class="risk-tag accepted">accepted</span>'
      : '<span class="risk-tag open">open</span>';
    const sourceTag = `<span class="risk-source">${escapeHtml(r.source)}</span>`;
    return `<li><span class="step-label">${escapeHtml(r.item)}</span>${acceptedTag}${sourceTag}${
      r.detail ? `<span class="step-detail">${escapeHtml(r.detail)}</span>` : ''
    }</li>`;
  });
  return `<ul class="risk-list">\n${rows.join('\n')}\n</ul>`;
}
