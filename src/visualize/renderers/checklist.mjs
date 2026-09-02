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

// "2026-10-15" -> "Oct 15, 2026". See render.mjs's formatDate for why: the
// schema stores dateString fields as YYYY-MM-DD, humans read a real date.
// Duplicated here rather than imported to avoid a circular import back into
// render.mjs, which imports this file.
function formatDate(dateStr) {
  if (!dateStr) return dateStr;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return dateStr;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function listHtml(rows) {
  if (!rows.length) return '<p class="empty">No items yet.</p>';
  return `<ul class="checklist">\n${rows.join('\n')}\n</ul>`;
}

// `detail`, when present, renders as a lower-hierarchy line under the main
// text rather than a hover-only tooltip, matching the ordered-list/risk-list
// treatment — the reader shouldn't need to mouse over to see it.
function row({ icon, cls, text, badge = '', pill = '', detail, facts }) {
  const detailLine = detail ? `<span class="step-detail">${escapeHtml(detail)}</span>` : '';
  const factsBlock = facts && facts.length ? factList(facts) : '';
  return `<li class="${cls}"><span class="icon">${icon}</span><span class="text-wrap"><span class="text">${escapeHtml(text)}</span>${pill}${factsBlock}${detailLine}</span>${badge}</li>`;
}

// facts: [{ label, value }] — a label:value fact row per structured field
// (test/pass-if/by, resolves-by/via) instead of one · -joined run-on line,
// so each fact keeps its own scan position under the main statement.
function factList(facts) {
  const rows = facts
    .filter((f) => f.value)
    .map(
      (f) =>
        `<div class="fact-row"><span class="fact-label">${escapeHtml(f.label)}</span><span class="fact-value">${escapeHtml(f.value)}</span></div>`
    );
  if (!rows.length) return '';
  return `<div class="fact-list">${rows.join('\n')}</div>`;
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
  const rows = items.map((e) => {
    const facts = e.done
      ? [{ label: 'changed', value: e.changedAsResult }]
      : [
          { label: 'test', value: e.test },
          { label: 'pass if', value: e.passIf },
          { label: 'by', value: formatDate(e.by) },
        ];
    return row({
      icon: e.done ? '✓' : '·',
      cls: e.done ? 'ok' : 'unknown',
      text: e.assumption,
      pill: e.done && e.result ? `<span class="pill pill-neutral">${escapeHtml(e.result)}</span>` : '',
      facts,
      detail: e.detail,
    });
  });
  return listHtml(rows);
}

export function renderForecasts(items) {
  const rows = items.map((f) => {
    const facts = f.resolved
      ? [{ label: 'verdict', value: f.verdict }]
      : [
          { label: 'likelihood', value: `${f.probability}%` },
          { label: 'resolves by', value: formatDate(f.resolvesBy) },
          { label: 'via', value: f.resolvesVia },
        ];
    return row({
      icon: f.resolved ? '✓' : '·',
      cls: f.resolved ? 'ok' : 'unknown',
      text: f.statement,
      pill: f.resolved && f.outcome ? `<span class="pill pill-neutral">${escapeHtml(f.outcome)}</span>` : '',
      facts,
      detail: f.detail,
    });
  });
  return listHtml(rows);
}

export function renderCapacity(capacity) {
  const hrs =
    capacity.availableHrsPerWeek == null
      ? 'hours/week not set'
      : `${capacity.availableHrsPerWeek} hrs/week available`;
  const rows = [
    row({
      icon: '·',
      cls: 'unknown',
      text: hrs,
      pill: `<span class="pill pill-neutral">runway: ${escapeHtml(capacity.runway)}</span>`,
      detail: capacity.detail,
    }),
  ];
  if (capacity.watch) {
    rows.push(row({ icon: '△', cls: 'warn', text: capacity.watch }));
  }
  return listHtml(rows);
}
