// No diagram — styled prose. The correct renderer for anything that's
// already list- or paragraph-shaped (research, intel, comms, exposure,
// premortem, or any section that doesn't match a more specific type).

export function renderPlainCard(sectionBody) {
  const escaped = escapeHtml(sectionBody);
  const withBreaks = escaped
    .split('\n')
    .map((l) => (l.trim().startsWith('-') ? `<li>${l.trim().slice(1).trim()}</li>` : l))
    .join('\n');

  if (withBreaks.includes('<li>')) {
    return `<ul class="plain-list">${withBreaks}</ul>`;
  }
  return `<p>${withBreaks.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
