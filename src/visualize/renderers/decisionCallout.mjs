// Plain HTML callout, not Mermaid — a decision, its chosen option, and a
// reverse-if condition are two facts, not a graph (see registry.mjs).

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// decisions: [{ date, choice, because?, reverseIf, reviewBy? }], append-only.
// Most recent decision only (last element) — earlier ones are history, not
// a live call to surface here. `because`, when present, becomes a native
// title-attr tooltip on the choice line rather than always-visible text.
export function renderDecisionCallout(decisions) {
  if (!decisions || !decisions.length) return '<p class="empty">No items yet.</p>';

  const latest = decisions[decisions.length - 1];
  const tooltip = latest.because ? ` title="${escapeHtml(latest.because)}"` : '';

  return `<div class="decision-callout">
    <span class="dc-label">Decided</span>
    <div class="dc-choice"${tooltip}>${escapeHtml(latest.choice)}</div>
    <div class="dc-reverse">Reverses if: <b>${escapeHtml(latest.reverseIf)}</b></div>
  </div>`;
}
