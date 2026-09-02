// Plain HTML table, not Mermaid — a hub-and-spoke graph of at most a
// handful of nodes carried less information than a table row, at a much
// bigger footprint and worse legibility (see registry.mjs). Power renders
// as a three-dot meter so it's scannable without reading the word; stance
// as a "current → target" pair; `detail`, when present, becomes a native
// title-attr tooltip on the row rather than a line that always takes space,
// since it's supporting color, not something the reader always needs.

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const POWER_LIT = { high: 3, med: 2, low: 1 };

function powerDots(power) {
  const lit = POWER_LIT[power] ?? 0;
  const dots = [0, 1, 2].map((i) => `<span class="${i < lit ? 'lit' : ''}"></span>`).join('');
  return `<span class="power-dot" title="Power: ${escapeHtml(power)}">${dots}</span>`;
}

// stakeholders: [{ name, power, stanceCurrent, stanceTarget, via, detail? }]
export function renderStakeholderTable(stakeholders) {
  if (!stakeholders || !stakeholders.length) return '<p class="empty">No items yet.</p>';

  const rows = stakeholders
    .map((s) => {
      const tooltip = s.detail ? ` title="${escapeHtml(s.detail)}"` : '';
      return `<tr${tooltip}>
        <td>${escapeHtml(s.name)}</td>
        <td>${powerDots(s.power)}</td>
        <td class="stance-arrow">${escapeHtml(s.stanceCurrent)} → <span class="stance-target">${escapeHtml(s.stanceTarget)}</span></td>
        <td>${escapeHtml(s.via)}</td>
      </tr>`;
    })
    .join('\n');

  return `<table class="stake-table"><thead><tr><th>Who</th><th>Power</th><th>Stance</th><th>Via</th></tr></thead><tbody>${rows}</tbody></table>`;
}
