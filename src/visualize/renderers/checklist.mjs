// Plain styled HTML, not Mermaid — a diagram would be strictly worse than
// a list here. Each shape routed to 'checklist' by registry.mjs gets its
// own small typed formatter rather than one regex covering all of them.

const STATUS_ICON = {
  on_track: '✓',
  at_risk: '△',
  stalled: '■',
  regressing: '✕',
};

const STATUS_CLASS = {
  on_track: 'ok',
  at_risk: 'warn',
  stalled: 'stalled',
  regressing: 'bad',
};

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function listHtml(rows) {
  if (!rows.length) return '<p class="empty">No items yet.</p>';
  return `<ul class="checklist">\n${rows.join('\n')}\n</ul>`;
}

// `detail`, when present, becomes a native browser tooltip via title= — no
// JS needed for a plain HTML list item, unlike the Mermaid renderers.
function row({ icon, cls, text, badge = '', detail }) {
  const titleAttr = detail ? ` title="${escapeHtml(detail)}"` : '';
  return `<li class="${cls}"${titleAttr}><span class="icon">${icon}</span><span class="text">${escapeHtml(text)}</span>${badge}</li>`;
}

export function renderCriteriaStatus(items) {
  const rows = items.map((c) =>
    row({
      icon: STATUS_ICON[c.status] ?? '·',
      cls: STATUS_CLASS[c.status] ?? 'unknown',
      text: c.text,
      badge: `<span class="kind">${escapeHtml(c.kind)}</span>`,
      detail: c.detail,
    })
  );
  return listHtml(rows);
}

export function renderExperiments(items) {
  const rows = items.map((e) =>
    row({
      icon: e.done ? '✓' : '·',
      cls: e.done ? 'ok' : 'unknown',
      text: e.done && e.result ? `${e.assumption} — ${e.result}` : e.assumption,
      detail: e.detail,
    })
  );
  return listHtml(rows);
}

export function renderForecasts(items) {
  const rows = items.map((f) =>
    row({
      icon: f.resolved ? '✓' : '·',
      cls: f.resolved ? 'ok' : 'unknown',
      text: f.resolved && f.outcome ? `${f.statement} — ${f.outcome}` : `${f.statement} (${f.probability}%)`,
      detail: f.detail,
    })
  );
  return listHtml(rows);
}

export function renderCapacity(capacity) {
  const hrs =
    capacity.availableHrsPerWeek == null
      ? 'hours/week not set'
      : `${capacity.availableHrsPerWeek} hrs/week available`;
  const rows = [
    row({ icon: '·', cls: 'unknown', text: `${hrs} — runway: ${capacity.runway}`, detail: capacity.detail }),
  ];
  if (capacity.watch) {
    rows.push(row({ icon: '△', cls: 'warn', text: capacity.watch }));
  }
  return listHtml(rows);
}
