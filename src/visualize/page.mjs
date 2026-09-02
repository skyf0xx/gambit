import { escapeHtml, formatDate } from './render.mjs';

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
  return `<section class="card tier-${card.tier} key-${card.key}" id="card-${i}">
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
    /* One type scale, reused by every card variant (checklist, ordered-list,
       risk-list, plain-list, criteria) so a label/detail/pill/tag looks and
       reads the same regardless of which section it's in. */
    --fs-card-title: 1.15rem;
    --fs-card-title-primary: 1.3rem;
    --fs-card-title-reference: 0.95rem;
    --fs-body: 1rem;
    --fs-detail: 0.85rem;
    --fs-pill: 0.75rem;
    --fw-title: 700;
    --fw-pill: 600;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #16161a; --card-bg: #1f1f24; --text: #e8e6e1; --muted: #9a9890;
      --border: #333238; --ok: #4caf6a; --warn: #d4a72c; --bad: #e0605f; --stalled: #9a9890;
      --accent: #7ea6e0; }
  }
  * { box-sizing: border-box; }
  html { font-size: 18px; }
  body { margin: 0; padding: 3rem 2rem 5rem; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.45; }
  .page { max-width: 860px; margin: 0 auto; }
  header { margin-bottom: 1.75rem; text-align: center; }
  h1 { font-size: 1.65rem; margin: 0 0 0.35rem; line-height: 1.3; }
  .meta { color: var(--muted); font-size: 0.9rem; }
  .stack { display: flex; flex-direction: column; gap: 1.35rem; }
  /* One border weight and color for every card, focus banner, and criteria
     box — tiers and the focus banner differentiate through title size/color
     and background tint, never through border thickness, so the page reads
     as one consistent system rather than mismatched box styles. */
  .card, .focus, .criteria { border: 1px solid var(--border); border-radius: 12px; }
  .card { background: var(--card-bg); padding: 1.4rem 1.6rem; font-size: var(--fs-body); }
  /* Card titles are a distinct hierarchy tier from body text, not a small
     caps label at body size — bigger and bolder than any text inside the
     card, so the eye lands on "what section is this" first. */
  .card h2 { font-size: var(--fs-card-title); margin: 0 0 0.9rem; color: var(--text);
    text-transform: none; letter-spacing: normal; font-weight: var(--fw-title); }
  /* Tiered visual weight: primary (what to do, are we winning) reads
     loudest; secondary (who/why/risk) is standard; reference (checked
     rarely — capacity, forecasts, experiments, exposure) recedes so the
     page doesn't present everything as equally urgent. Weight comes from
     title size/color and a tinted background, not a heavier border. */
  .card.tier-primary { padding: 1.6rem 1.8rem; background: color-mix(in srgb, var(--accent) 5%, var(--card-bg)); }
  .card.tier-primary h2 { font-size: var(--fs-card-title-primary); color: var(--accent); }
  .card.tier-reference { padding: 1.05rem 1.4rem; font-size: var(--fs-detail); }
  .card.tier-reference h2 { font-size: var(--fs-card-title-reference); color: var(--muted);
    font-weight: 600; }
  /* Stakeholders and Decisions are the two Mermaid diagrams left. Their
     real size comes from the diagram's own layout (network.mjs's TD
     direction + the nodeSpacing/rankSpacing set on mermaid.initialize
     below) — stretching the rendered SVG box with min-height here would
     just distort a small diagram into a blurry big one, not add room for
     labels. Stakeholders' TD hub-and-spoke layout with edge labels
     regularly renders wider than the 860px page cap, and capping the SVG
     to max-width: 100% there scaled its text down along with the box —
     same fontSize as Decisions in mermaid.initialize below, but visibly
     smaller once shrunk to fit. Breaking these two cards out to the full
     viewport width (minus the body's own side padding) gives the SVG all
     the room the viewport has to sit at its natural size instead, so the
     text renders at the size Mermaid actually drew it, matching Decisions. */
  .card.key-stakeholders, .card.key-decisions {
    width: calc(100vw - 4rem); margin-left: calc(50% - 50vw + 2rem);
    margin-right: calc(50% - 50vw + 2rem);
  }
  .card.key-stakeholders .mermaid, .card.key-decisions .mermaid {
    display: flex; justify-content: center;
  }
  .card.key-stakeholders .mermaid svg, .card.key-decisions .mermaid svg {
    width: auto; max-width: 100%;
  }
  .focus { background: color-mix(in srgb, var(--accent) 6%, var(--card-bg));
    padding: 1.1rem 1.6rem; margin-bottom: 1.35rem; font-size: 1.2rem; display: flex;
    align-items: baseline; gap: 0.8rem; }
  .focus-label { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.03em;
    color: var(--accent); font-weight: var(--fw-title); white-space: nowrap; }
  /* Same padding/title size/row spacing as .card.tier-primary (Plan) —
     success criteria is the other "are we winning" primary-tier section,
     so it should read at the same visual weight, not a smaller box. */
  .criteria { background: var(--card-bg); padding: 1.6rem 1.8rem; margin-bottom: 1.35rem; }
  .criteria h3 { margin: 0 0 0.9rem; font-size: var(--fs-card-title-primary); color: var(--accent);
    font-weight: var(--fw-title); }
  .criteria ul { margin: 0; padding-left: 1.2rem; font-size: var(--fs-body); }
  .criteria li { padding: 0.55rem 0; }
  .kind-tag { font-size: var(--fs-pill); color: var(--muted); border: 1px solid var(--border);
    border-radius: 4px; padding: 0.05rem 0.35rem; margin-right: 0.45rem; }
  /* Pills replace em-dash-joined status/outcome/timing text (e.g. "item —
     accepted — because...") — a scannable tag instead of a run-on sentence,
     with any elaboration held for a lower-hierarchy .step-detail line. */
  .pill, .risk-tag { display: inline-block; font-size: var(--fs-pill); border-radius: 999px;
    padding: 0.12rem 0.6rem; margin-left: 0.5rem; font-weight: var(--fw-pill); white-space: nowrap;
    text-transform: none; letter-spacing: normal; }
  .pill-neutral { color: var(--muted); border: 1px solid var(--border); }
  .pill-open, .risk-tag.open { color: var(--bad); border: 1px solid var(--bad); }
  .pill-accepted, .risk-tag.accepted { color: var(--muted); border: 1px solid var(--border); }
  .risk-source { font-size: var(--fs-pill); color: var(--muted); margin-left: 0.4rem; }
  /* Every list variant (checklist, ordered-list, risk-list, plain-list)
     shares one row rhythm and one label/detail size pair. */
  ul.checklist, .plain-list, ol.ordered-list, ul.risk-list {
    list-style: none; margin: 0; padding: 0; font-size: var(--fs-body);
  }
  ul.checklist li, .plain-list li, ol.ordered-list li, ul.risk-list li {
    padding: 0.55rem 0; border-bottom: 1px solid var(--border);
  }
  ul.checklist li:last-child, .plain-list li:last-child,
  ol.ordered-list li:last-child, ul.risk-list li:last-child { border-bottom: none; }
  ul.checklist li { display: flex; align-items: flex-start; gap: 0.7rem; }
  ul.checklist .icon { width: 1.2rem; text-align: center; font-weight: bold; flex-shrink: 0;
    margin-top: 0.15rem; }
  ul.checklist .text-wrap { flex: 1; }
  ul.checklist .text { display: inline; font-size: var(--fs-body); }
  ul.checklist .ok .icon { color: var(--ok); }
  ul.checklist .warn .icon { color: var(--warn); }
  ul.checklist .bad .icon { color: var(--bad); }
  ul.checklist .stalled .icon { color: var(--stalled); }
  ul.checklist .kind { margin-left: auto; font-size: var(--fs-pill); color: var(--muted);
    padding-top: 0.15rem; }
  /* Plan / Systems Notes sequences read as a numbered chain; flat Risk
     Notes / Exposure lists as plain bullets — both are text, not a diagram,
     since the items aren't a real relational network. */
  ol.ordered-list { counter-reset: step; }
  ol.ordered-list li { counter-increment: step; position: relative; padding-left: 2.4rem; }
  ol.ordered-list li::before { content: counter(step); position: absolute; left: 0; top: 0.55rem;
    width: 1.6rem; height: 1.6rem; border-radius: 50%; background: var(--bg); color: var(--muted);
    border: 1px solid var(--border); font-size: var(--fs-pill); font-weight: 600; display: flex;
    align-items: center; justify-content: center; }
  /* Detail is always a step below its label — same size/color/weight
     wherever it appears, so "lower hierarchy" means one visual pattern,
     not a different treatment per section. */
  .step-label { display: block; font-size: var(--fs-body); }
  .step-detail { display: block; font-size: var(--fs-detail); color: var(--muted);
    margin-top: 0.2rem; line-height: 1.4; font-weight: 400; }
  /* Structured fields (experiment test/pass-if/by, forecast resolves-by/via)
     as label:value rows instead of one · -joined run-on line — each fact
     keeps its own scan position under the main statement. Label is a fixed
     narrow column so values align, same detail size/color as .step-detail. */
  .fact-list { margin-top: 0.35rem; display: flex; flex-direction: column; gap: 0.15rem; }
  .fact-row { display: flex; gap: 0.6rem; font-size: var(--fs-detail); line-height: 1.4; }
  .fact-label { flex: 0 0 5.5rem; color: var(--muted); text-transform: uppercase;
    letter-spacing: 0.02em; font-size: 0.7rem; font-weight: 600; padding-top: 0.1rem; }
  .fact-value { flex: 1; color: var(--text); }
  .empty { color: var(--muted); font-style: italic; }
  table.fallback-table { width: 100%; border-collapse: collapse; }
  table.fallback-table td { padding: 0.3rem 0; border-bottom: 1px solid var(--border); }
  /* Mermaid diagrams (Stakeholders, Decisions) were being squeezed into
     normal card height, cramping node labels — give them real room. */
  .card .mermaid { min-height: 320px; display: flex; align-items: center; justify-content: center; }
  .card .mermaid svg { max-width: 100%; height: auto; min-height: 320px; }
  .disconnected { position: fixed; top: 0; left: 0; right: 0; background: var(--bad); color: white;
    text-align: center; padding: 0.3rem; font-size: 0.85rem; display: none; z-index: 10; }
</style>
</head>
<body>
<div class="disconnected" id="disconnected">Reconnecting…</div>
<div class="page">
<header>
  <h1>${escapeHtml(shortTitle)}</h1>
  <div class="meta">${goal.deadline ? `Deadline: ${escapeHtml(formatDate(goal.deadline))}` : 'No deadline set'}</div>
</header>
${focusHtml(goal.focus)}
${criteriaHtml(goal.criteria)}
<div class="stack">
${cardsHtml}
</div>
</div>
<script>
  // Mermaid's click-directive tooltip: "click nodeId call fn() 'tooltip text'"
  // is how a node in a rendered flowchart gets a hover tooltip — it attaches
  // a title child to the node's SVG group, shown by the browser natively on
  // hover, no extra JS needed for the hover itself. The callback name must
  // resolve to something (Mermaid calls it on click) even though a
  // hover-only tooltip doesn't need it to do anything.
  window.___gambitTooltip = function () {};

  mermaid.initialize({
    startOnLoad: true,
    theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default',
    securityLevel: 'strict',
    // Wider gaps between nodes/ranks (Mermaid defaults: 50/50) and a bigger
    // base font — the Stakeholders and Decisions diagrams read cramped at
    // default spacing, and this grows the diagram's real layout instead of
    // just stretching an unchanged SVG into a taller box via CSS.
    flowchart: { nodeSpacing: 90, rankSpacing: 110 },
    themeVariables: { fontSize: '16px' },
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
