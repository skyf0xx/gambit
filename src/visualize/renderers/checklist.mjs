// Plain styled HTML, not Mermaid — a diagram would be strictly worse than
// a list here. Parses lines shaped like:
//   - text — [control|influence] — [on_track|at_risk|stalled|regressing]
//   - [ ] text — ...
// and falls back to a plain bullet for anything that doesn't match, so an
// unscored criterion or a hand-written line still renders instead of
// vanishing.

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

function parseLine(line) {
  const stripped = line.replace(/^-\s*(\[[ xX]\]\s*)?/, '').trim();
  const parts = stripped.split(/\s*—\s*/);
  const statusWord = parts[parts.length - 1]?.toLowerCase().replace(/[^a-z_]/g, '');
  const status = STATUS_ICON[statusWord] ? statusWord : null;
  const text = status ? parts.slice(0, -1).join(' — ') : stripped;
  const kindWord = parts.length > 2 ? parts[parts.length - 2]?.toLowerCase() : null;
  const kind = kindWord === 'control' || kindWord === 'influence' ? kindWord : null;
  const label = kind ? text.replace(new RegExp(`\\s*—\\s*${kind}$`, 'i'), '') : text;
  return { text: label || stripped, status, kind };
}

export function renderChecklist(sectionBody) {
  const items = sectionBody
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('-'))
    .map(parseLine);

  if (items.length === 0) return '<p class="empty">No items yet.</p>';

  const rows = items
    .map((item) => {
      const icon = item.status ? STATUS_ICON[item.status] : '·';
      const cls = item.status ? STATUS_CLASS[item.status] : 'unknown';
      const badge = item.kind ? `<span class="kind">${item.kind}</span>` : '';
      return `<li class="${cls}"><span class="icon">${icon}</span><span class="text">${escapeHtml(item.text)}</span>${badge}</li>`;
    })
    .join('\n');

  return `<ul class="checklist">\n${rows}\n</ul>`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
