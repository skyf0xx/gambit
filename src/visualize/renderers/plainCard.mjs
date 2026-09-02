// No diagram — styled prose. The correct renderer for exposure, the one
// owned section that's list-shaped but not a checklist/network/fork.

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// exposure: [{ item, status, mustHandleBefore?, acceptedDate?, why? }]
export function renderPlainCard(exposure) {
  if (!exposure || !exposure.length) return '<p class="empty">No items yet.</p>';

  const rows = exposure.map((e) => {
    let line = `${escapeHtml(e.item)} — ${escapeHtml(e.status)}`;
    if (e.mustHandleBefore) line += ` (before ${escapeHtml(e.mustHandleBefore)})`;
    if (e.why) line += ` — ${escapeHtml(e.why)}`;
    return `<li>${line}</li>`;
  });

  return `<ul class="plain-list">${rows.join('\n')}</ul>`;
}
