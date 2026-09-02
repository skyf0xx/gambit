// No diagram — styled prose. The correct renderer for exposure, the one
// owned section that's list-shaped but not a checklist/network/fork.

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// "2026-10-15" -> "Oct 15, 2026". See render.mjs's formatDate for why:
// duplicated here rather than imported to avoid a circular import back into
// render.mjs, which imports this file.
function formatDate(dateStr) {
  if (!dateStr) return dateStr;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return dateStr;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// exposure: [{ item, status, mustHandleBefore?, acceptedDate?, why? }]
// status/timing render as pills rather than em-dash-joined into the
// sentence; `why` is the elaboration, so it drops to a lower-hierarchy line.
export function renderPlainCard(exposure) {
  if (!exposure || !exposure.length) return '<p class="empty">No items yet.</p>';

  const rows = exposure.map((e) => {
    const statusPill = `<span class="pill pill-${e.status}">${escapeHtml(e.status)}</span>`;
    const beforePill = e.mustHandleBefore
      ? `<span class="pill pill-neutral">before ${escapeHtml(formatDate(e.mustHandleBefore))}</span>`
      : '';
    const why = e.why ? `<span class="step-detail">${escapeHtml(e.why)}</span>` : '';
    return `<li><span class="step-label">${escapeHtml(e.item)}</span>${statusPill}${beforePill}${why}</li>`;
  });

  return `<ul class="plain-list">${rows.join('\n')}</ul>`;
}
