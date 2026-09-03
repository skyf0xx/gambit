// Plain HTML table, matching stakeholderTable.mjs's shape — the goal's
// named-contacts list (who's involved, distinct from the power/interest
// stakeholder map). Status renders as a pill rather than a dot-meter since
// it's a three-value enum, not a scale; `detail`, when present, becomes a
// native title-attr tooltip on the row rather than a line that always takes
// space, matching the stakeholder table's convention.

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const STATUS_PILL_CLASS = { confirmed: 'pill-accepted', tentative: 'pill-neutral', lead: 'pill-open' };

function statusPill(status) {
  const cls = STATUS_PILL_CLASS[status] ?? 'pill-neutral';
  return `<span class="pill ${cls}">${escapeHtml(status)}</span>`;
}

// people: [{ name, status, doing, detail }]
export function renderPeopleTable(people) {
  if (!people || !people.length) return '<p class="empty">No items yet.</p>';

  const rows = people
    .map((p) => {
      const tooltip = p.detail ? ` title="${escapeHtml(p.detail)}"` : '';
      return `<tr${tooltip}>
        <td>${escapeHtml(p.name)}</td>
        <td>${statusPill(p.status)}</td>
        <td>${escapeHtml(p.doing)}</td>
      </tr>`;
    })
    .join('\n');

  return `<table class="stake-table people-table"><thead><tr><th>Who</th><th>Status</th><th>Doing</th></tr></thead><tbody>${rows}</tbody></table>`;
}
