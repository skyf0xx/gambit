import { escapeHtml } from './render.mjs';

const STATUS_LABEL = { on_track: 'On track', at_risk: 'At risk', stalled: 'Stalled', regressing: 'Regressing' };

// A goal's title is often a full multi-sentence description — fine as the
// source of truth, too long for a browser tab title or page heading. This
// is the only place in visualize that truncates for display; parse.mjs
// passes the title through untouched. Prefers the first sentence; falls
// back to a word-boundary cut.
function shorten(title, max = 80) {
  const firstSentence = title.match(/^(.+?[.!?])(\s|$)/)?.[1];
  if (firstSentence && firstSentence.length <= max) return firstSentence;
  const flat = title.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

function criteriaHtml(criteria) {
  if (!criteria.length) return '';
  const rows = criteria
    .map((c) => `<li><span class="kind-tag">${c.kind}</span>${escapeHtml(c.text)}</li>`)
    .join('\n');
  return `<div class="criteria"><h3>Success criteria</h3><ul>${rows}</ul></div>`;
}

function focusHtml(focus) {
  if (!focus) return '';
  return `<div class="focus"><span class="focus-label">🎯 Focus</span>${escapeHtml(focus)}</div>`;
}

function cardHtml(card, i) {
  const body =
    card.kind === 'mermaid'
      ? `<pre class="mermaid">${escapeHtml(card.body)}</pre>`
      : card.body;
  return `<section class="card" id="card-${i}">
  <h2>${escapeHtml(card.title)}</h2>
  ${body}
</section>`;
}

export function renderPage(goal) {
  const cardsHtml = goal.cards.length
    ? goal.cards.map(cardHtml).join('\n')
    : '<p class="empty">No sections yet — run a skill that writes to GOAL.json (plan, systems, strategy...) to see it appear here.</p>';
  const shortTitle = shorten(goal.title);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(shortTitle)} — Gambit</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<style>
  :root {
    --bg: #f7f6f3; --card-bg: #ffffff; --text: #1a1a1a; --muted: #6b6b6b;
    --border: #e3e1db; --ok: #1a7f37; --warn: #b8860b; --bad: #cc3333; --stalled: #6b6b6b;
    --accent: #2b5fad;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #16161a; --card-bg: #1f1f24; --text: #e8e6e1; --muted: #9a9890;
      --border: #333238; --ok: #4caf6a; --warn: #d4a72c; --bad: #e0605f; --stalled: #9a9890;
      --accent: #7ea6e0; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 1.5rem 1.75rem; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  header { margin-bottom: 1.25rem; }
  h1 { font-size: 1.25rem; margin: 0 0 0.25rem; }
  .meta { color: var(--muted); font-size: 0.85rem; white-space: nowrap; overflow: hidden;
    text-overflow: ellipsis; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 0.9rem; }
  .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px;
    padding: 0.9rem 1.1rem; }
  .card h2 { font-size: 0.85rem; margin: 0 0 0.6rem; color: var(--muted); text-transform: uppercase;
    letter-spacing: 0.03em; }
  .focus { background: var(--card-bg); border: 1px solid var(--accent); border-radius: 8px;
    padding: 0.7rem 1.1rem; margin-bottom: 0.9rem; font-size: 1rem; display: flex;
    align-items: baseline; gap: 0.7rem; }
  .focus-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em;
    color: var(--accent); font-weight: 600; white-space: nowrap; }
  .criteria { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px;
    padding: 0.9rem 1.1rem; margin-bottom: 0.9rem; }
  .criteria h3 { margin: 0 0 0.5rem; font-size: 0.85rem; color: var(--muted); }
  .criteria ul { margin: 0; padding-left: 1.1rem; font-size: 0.92rem; }
  .criteria li { padding: 0.15rem 0; }
  .kind-tag { font-size: 0.68rem; color: var(--muted); border: 1px solid var(--border);
    border-radius: 4px; padding: 0 0.3rem; margin-right: 0.4rem; }
  ul.checklist { list-style: none; margin: 0; padding: 0; }
  ul.checklist li { display: flex; align-items: center; gap: 0.6rem; padding: 0.35rem 0;
    border-bottom: 1px solid var(--border); }
  ul.checklist li:last-child { border-bottom: none; }
  ul.checklist .icon { width: 1.2rem; text-align: center; font-weight: bold; }
  ul.checklist .ok .icon { color: var(--ok); }
  ul.checklist .warn .icon { color: var(--warn); }
  ul.checklist .bad .icon { color: var(--bad); }
  ul.checklist .stalled .icon { color: var(--stalled); }
  ul.checklist .kind { margin-left: auto; font-size: 0.7rem; color: var(--muted); }
  .plain-list { margin: 0; padding-left: 1.2rem; }
  .empty { color: var(--muted); font-style: italic; }
  table.fallback-table { width: 100%; border-collapse: collapse; }
  table.fallback-table td { padding: 0.3rem 0; border-bottom: 1px solid var(--border); }
  .disconnected { position: fixed; top: 0; left: 0; right: 0; background: var(--bad); color: white;
    text-align: center; padding: 0.3rem; font-size: 0.85rem; display: none; }
</style>
</head>
<body>
<div class="disconnected" id="disconnected">Reconnecting…</div>
<header>
  <h1>${escapeHtml(shortTitle)}</h1>
  <div class="meta">${goal.deadline ? `Deadline: ${escapeHtml(goal.deadline)}` : 'No deadline set'}</div>
</header>
${focusHtml(goal.focus)}
${criteriaHtml(goal.criteria)}
<div class="grid">
${cardsHtml}
</div>
<script>
  mermaid.initialize({
    startOnLoad: true,
    theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default',
    securityLevel: 'strict',
  });

  const es = new EventSource('/events');
  const banner = document.getElementById('disconnected');
  es.onmessage = (e) => {
    if (e.data === 'reload') location.reload();
  };
  es.onerror = () => { banner.style.display = 'block'; };
  es.onopen = () => { banner.style.display = 'none'; };
</script>
</body>
</html>`;
}
