import { escapeHtml, formatDate } from './render.mjs';

const POSTURE_ICON = {
  aggressive: '▲',
  steady: '●',
  defensive: '▼',
  at_risk: '△',
};

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

function deadlineStat(deadline, weeks) {
  if (!deadline) {
    return `<div class="stat"><span class="stat-label">Deadline</span><div class="stat-value">None set</div></div>`;
  }
  const soon = weeks != null && weeks <= 2;
  const overdue = weeks != null && weeks < 0;
  const weeksText =
    weeks == null ? '' : overdue ? `${Math.abs(weeks)} wk overdue` : weeks === 0 ? 'this week' : `${weeks} wk`;
  return `<div class="stat">
    <span class="stat-label">Deadline</span>
    <div class="stat-value tnum${soon || overdue ? ' deadline-soon' : ''}" title="${escapeHtml(formatDate(deadline))}">${escapeHtml(formatDate(deadline))}${weeksText ? ` · ${escapeHtml(weeksText)}` : ''}</div>
  </div>`;
}

function criteriaStat(criteria, progress, met) {
  if (!criteria.length) return '';
  const segs = progress
    .map((status) => {
      const cls = status === 'on_track' ? 'done' : status === 'at_risk' ? 'at-risk' : status === 'regressing' || status === 'stalled' ? 'bad' : '';
      return `<div class="progress-seg ${cls}" title="${escapeHtml(status.replace('_', ' '))}"></div>`;
    })
    .join('');
  return `<div class="stat">
    <span class="stat-label">Success criteria</span>
    <div class="stat-value tnum">${met} / ${criteria.length} met</div>
    <div class="progress-track">${segs}</div>
  </div>`;
}

function postureStat(posture) {
  if (!posture) {
    return `<div class="stat"><span class="stat-label">Posture</span><div class="stat-value">Not set</div></div>`;
  }
  return `<div class="stat">
    <span class="stat-label">Posture</span>
    <div class="stat-value">${escapeHtml(posture.current.label)}</div>
  </div>`;
}

function nextActionHtml(nextAction) {
  if (!nextAction) return '';
  return `<div class="next-action">
    <div class="next-action-icon">${ICON_ARROW}</div>
    <div>
      <span class="next-action-label">Next action</span>
      <div class="next-action-text"${nextAction.detail ? ` title="${escapeHtml(nextAction.detail)}"` : ''}>${escapeHtml(nextAction.action)}</div>
      <div class="next-action-who">${escapeHtml(nextAction.who)} → due ${escapeHtml(nextAction.when)}</div>
    </div>
  </div>`;
}

function bridgeHtml(goal) {
  const focus = goal.focus
    ? `<div class="focus-row">
        <div class="focus-mark">${ICON_TARGET}</div>
        <div class="focus-body">
          <span class="focus-eyebrow">Schwerpunkt · Focus right now</span>
          <div class="focus-text">${escapeHtml(goal.focus)}</div>
        </div>
      </div>`
    : `<div class="focus-row">
        <div class="focus-mark">${ICON_TARGET}</div>
        <div class="focus-body">
          <span class="focus-eyebrow">Schwerpunkt · Focus right now</span>
          <div class="focus-text focus-empty">No focus set yet — run strategy to set one.</div>
        </div>
      </div>`;

  return `<div class="bridge">
    ${focus}
    <div class="bridge-stats">
      ${deadlineStat(goal.deadline, goal.deadlineWeeks)}
      ${criteriaStat(goal.criteria, goal.criteriaProgress, goal.criteriaMet)}
      ${postureStat(goal.posture)}
    </div>
    ${nextActionHtml(goal.nextAction)}
  </div>`;
}

function criteriaHtml(criteria) {
  if (!criteria.length) return '';
  const rows = criteria
    .map(
      (c) => `<li class="criterion-row">
        <span class="kind-pill kind-${escapeHtml(c.kind)}">${escapeHtml(c.kind)}</span>
        <div class="criterion-body">
          <span class="step-label">${escapeHtml(c.text)}</span>
          ${c.lineOfOperation ? `<span class="loo-tag">${escapeHtml(c.lineOfOperation)}</span>` : ''}
          ${c.detail ? `<span class="step-detail">${escapeHtml(c.detail)}</span>` : ''}
        </div>
      </li>`
    )
    .join('\n');
  return `<details class="card"><summary><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"></path></svg><span class="summary-title">Success criteria</span></summary><div class="card-body"><ul class="criteria-list">${rows}</ul></div></details>`;
}

function cardHtml(card, open) {
  return `<details class="card" id="card-${card.key}"${open ? ' open' : ''}>
  <summary>
    <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"></path></svg>
    <span class="summary-title">${escapeHtml(card.title)}</span>
    ${card.hint ? `<span class="summary-hint">${escapeHtml(card.hint)}</span>` : ''}
  </summary>
  <div class="card-body">${card.body}</div>
</details>`;
}

// Only the 'plan' group's cards open by default — it's what changes session
// to session; everything else (people/risk, forecasts, exposure) is checked
// less often and starts collapsed so it doesn't compete with the Bridge for
// attention (see registry.mjs's SECTION_GROUPS comment).
function groupHtml(group) {
  const cardsHtml = group.cards.map((c) => cardHtml(c, group.key === 'plan')).join('\n');
  return `<div class="section-group">
    <div class="group-heading">${escapeHtml(group.label)}</div>
    ${cardsHtml}
  </div>`;
}

const ICON_TARGET = `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`;
const ICON_ARROW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"></path></svg>`;

export function renderPage(goal) {
  const shortTitle = shorten(goal.title);
  const groupsHtml = goal.groups.length
    ? goal.groups.map(groupHtml).join('\n')
    : '<p class="empty">No sections yet — run a skill that writes to GOAL.json (plan, systems, strategy...) to see it appear here.</p>';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(shortTitle)} — Gambit</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
  :root {
    --bg: #faf9f6; --paper: #ffffff; --ink: #1c1b19; --muted: #6f6a5f; --faint: #9c9686;
    --border: #ddd9d0; --border-strong: #c9c3b6;
    --accent: #2f4a7a; --accent-soft: #eef1f7; --accent-ink: #1f335a;
    --ok: #3d7a4f; --ok-soft: #e8f1e9;
    --warn: #a8721f; --warn-soft: #f7eedd;
    --bad: #a8432f; --bad-soft: #f6e8e3;
    --stalled: #6f6a5f; --stalled-soft: #efede7;
    --shadow: 0 1px 2px rgba(28,27,25,0.04), 0 6px 20px -8px rgba(28,27,25,0.08);
    --radius: 10px;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #171613; --paper: #201f1b; --ink: #ece8e0; --muted: #a9a294; --faint: #7b7669;
      --border: #34322b; --border-strong: #45423a;
      --accent: #7f9ad6; --accent-soft: #232a3b; --accent-ink: #b7c6ea;
      --ok: #79b98a; --ok-soft: #1e2b21;
      --warn: #d3a35a; --warn-soft: #322a1a;
      --bad: #d98269; --bad-soft: #362320;
      --stalled: #a9a294; --stalled-soft: #2a2822;
      --shadow: 0 1px 2px rgba(0,0,0,0.2), 0 6px 24px -8px rgba(0,0,0,0.5);
    }
  }
  :root[data-theme="dark"] {
    --bg: #171613; --paper: #201f1b; --ink: #ece8e0; --muted: #a9a294; --faint: #7b7669;
    --border: #34322b; --border-strong: #45423a;
    --accent: #7f9ad6; --accent-soft: #232a3b; --accent-ink: #b7c6ea;
    --ok: #79b98a; --ok-soft: #1e2b21;
    --warn: #d3a35a; --warn-soft: #322a1a;
    --bad: #d98269; --bad-soft: #362320;
    --stalled: #a9a294; --stalled-soft: #2a2822;
    --shadow: 0 1px 2px rgba(0,0,0,0.2), 0 6px 24px -8px rgba(0,0,0,0.5);
  }
  * { box-sizing: border-box; }
  html { font-size: 18px; }
  body { margin: 0; background: var(--bg); color: var(--ink);
    font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; }
  .wrap { max-width: 780px; margin: 0 auto; padding: 2.75rem 1.5rem 6rem; }
  .mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
  .tnum { font-variant-numeric: tabular-nums; }

  h1.goal-title { font-family: 'Source Serif 4', Georgia, serif; font-weight: 600; font-size: 1.7rem;
    line-height: 1.3; margin: 0 0 1.4rem; text-wrap: balance; color: var(--ink); }

  /* ---------- The Bridge: always-visible summary, no disclosure ---------- */
  .bridge { background: var(--paper); border: 1px solid var(--border); border-radius: var(--radius);
    box-shadow: var(--shadow); overflow: hidden; margin-bottom: 1.75rem; }
  .focus-row { display: flex; gap: 1.1rem; align-items: flex-start; padding: 1.35rem 1.5rem 1.2rem;
    background: linear-gradient(180deg, var(--accent-soft), transparent); }
  .focus-mark { flex: 0 0 auto; width: 2.1rem; height: 2.1rem; border-radius: 50%; background: var(--accent);
    display: flex; align-items: center; justify-content: center; margin-top: 0.1rem; }
  .focus-mark svg { width: 1.1rem; height: 1.1rem; }
  .focus-body { flex: 1; min-width: 0; }
  .focus-eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--accent-ink); font-weight: 500; margin-bottom: 0.3rem; display: block; }
  .focus-text { font-size: 1.12rem; font-weight: 600; color: var(--ink); line-height: 1.4; }
  .focus-text.focus-empty { font-weight: 400; color: var(--muted); font-style: italic; }
  .bridge-stats { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--border); }
  .stat { padding: 0.95rem 1.5rem; border-right: 1px solid var(--border); }
  .stat:last-child { border-right: none; }
  .stat-label { font-family: 'IBM Plex Mono', monospace; font-size: 0.66rem; letter-spacing: 0.07em;
    text-transform: uppercase; color: var(--faint); display: block; margin-bottom: 0.3rem; }
  .stat-value { font-size: 1.05rem; font-weight: 600; color: var(--ink); }
  .stat-value.deadline-soon { color: var(--warn); }
  .progress-track { display: flex; gap: 3px; margin-top: 0.5rem; }
  .progress-seg { flex: 1; height: 6px; border-radius: 3px; background: var(--border); }
  .progress-seg.done { background: var(--ok); }
  .progress-seg.at-risk { background: var(--warn); }
  .progress-seg.bad { background: var(--bad); }
  .next-action { display: flex; gap: 0.9rem; align-items: flex-start; padding: 1.05rem 1.5rem 1.2rem;
    border-top: 1px solid var(--border); }
  .next-action-icon { flex: 0 0 auto; color: var(--faint); margin-top: 0.2rem; }
  .next-action-icon svg { width: 1rem; height: 1rem; display: block; }
  .next-action-label { font-family: 'IBM Plex Mono', monospace; font-size: 0.66rem; letter-spacing: 0.07em;
    text-transform: uppercase; color: var(--faint); display: block; margin-bottom: 0.25rem; }
  .next-action-text { font-size: 0.98rem; font-weight: 500; }
  .next-action-who { font-size: 0.82rem; color: var(--muted); margin-top: 0.15rem; }

  /* ---------- Section groups (progressive disclosure) ---------- */
  .group-heading { font-family: 'IBM Plex Mono', monospace; font-size: 0.72rem; letter-spacing: 0.09em;
    text-transform: uppercase; color: var(--faint); margin: 2.1rem 0 0.7rem; padding-bottom: 0.4rem;
    border-bottom: 1px solid var(--border); }
  details.card { background: var(--paper); border: 1px solid var(--border); border-radius: var(--radius);
    margin-bottom: 0.65rem; overflow: hidden; }
  details.card[open] { box-shadow: var(--shadow); }
  details.card summary { list-style: none; cursor: pointer; padding: 0.95rem 1.3rem; display: flex;
    align-items: center; gap: 0.7rem; font-weight: 600; font-size: 0.98rem; user-select: none; }
  details.card summary::-webkit-details-marker { display: none; }
  details.card summary .chev { flex: 0 0 auto; width: 0.85rem; height: 0.85rem; color: var(--faint);
    transition: transform 0.15s ease; }
  details.card[open] summary .chev { transform: rotate(90deg); }
  details.card summary .summary-title { flex: 1; }
  details.card summary .summary-hint { font-size: 0.78rem; font-weight: 400; color: var(--faint);
    font-family: 'IBM Plex Mono', monospace; }
  details.card summary:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  details.card .card-body { padding: 0.2rem 1.3rem 1.15rem; border-top: 1px solid var(--border); padding-top: 0.95rem; }

  /* Plan: lines of operation as sub-blocks within one card */
  .loo { padding: 0.9rem 0; border-bottom: 1px solid var(--border); }
  .loo:last-child { border-bottom: none; }
  .loo-head { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.55rem; }
  .loo-name { font-weight: 600; font-size: 0.94rem; }
  .status-pill { font-family: 'IBM Plex Mono', monospace; font-size: 0.66rem; letter-spacing: 0.03em;
    text-transform: uppercase; padding: 0.15rem 0.5rem; border-radius: 999px; font-weight: 500; }
  .status-pill.on_schedule { background: var(--ok-soft); color: var(--ok); }
  .status-pill.at_risk { background: var(--warn-soft); color: var(--warn); }
  .status-pill.blocked { background: var(--bad-soft); color: var(--bad); }

  ol.ordered-list { list-style: none; margin: 0 0 0.6rem; padding: 0; counter-reset: step; }
  ol.ordered-list li { counter-increment: step; position: relative; padding: 0.32rem 0 0.32rem 1.9rem; font-size: 0.9rem; }
  ol.ordered-list li::before { content: counter(step); position: absolute; left: 0; top: 0.28rem;
    width: 1.3rem; height: 1.3rem; border-radius: 50%; background: var(--bg); border: 1px solid var(--border-strong);
    color: var(--muted); font-family: 'IBM Plex Mono', monospace; font-size: 0.66rem; display: flex;
    align-items: center; justify-content: center; }

  ul.next-actions { list-style: none; margin: 0.4rem 0 0; padding: 0.7rem 0 0 1.9rem; border-top: 1px dashed var(--border); }
  ul.next-actions li { display: flex; justify-content: space-between; gap: 0.8rem; padding: 0.3rem 0; font-size: 0.86rem; }
  ul.next-actions .who { color: var(--muted); white-space: nowrap; font-family: 'IBM Plex Mono', monospace; font-size: 0.78rem; }

  /* checklist (criteria status, experiments, forecasts, capacity) */
  ul.checklist { list-style: none; margin: 0; padding: 0; font-size: 0.92rem; }
  ul.checklist li { display: flex; align-items: flex-start; gap: 0.7rem; padding: 0.6rem 0;
    border-bottom: 1px solid var(--border); }
  ul.checklist li:last-child { border-bottom: none; }
  ul.checklist .icon { flex: 0 0 auto; width: 1.1rem; text-align: center; font-weight: bold; margin-top: 0.1rem; }
  ul.checklist .text-wrap { flex: 1; }
  ul.checklist .text { display: inline; }
  ul.checklist .ok .icon { color: var(--ok); }
  ul.checklist .warn .icon { color: var(--warn); }
  ul.checklist .bad .icon { color: var(--bad); }
  ul.checklist .stalled .icon { color: var(--stalled); }
  ul.checklist .kind { margin-left: auto; font-size: 0.72rem; color: var(--faint); padding-top: 0.15rem;
    font-family: 'IBM Plex Mono', monospace; }
  .kind-tag { font-family: 'IBM Plex Mono', monospace; font-size: 0.66rem; color: var(--faint);
    border: 1px solid var(--border); border-radius: 4px; padding: 0.05rem 0.35rem; margin-right: 0.5rem; }
  .pill, .risk-tag { display: inline-block; font-size: 0.72rem; border-radius: 999px; padding: 0.12rem 0.6rem;
    margin-left: 0.5rem; font-weight: 600; white-space: nowrap; }
  .pill-neutral { color: var(--muted); border: 1px solid var(--border); }
  .pill-open, .risk-tag.open { color: var(--bad); background: var(--bad-soft); }
  .pill-accepted, .risk-tag.accepted { color: var(--stalled); background: var(--stalled-soft); }

  .step-label { display: block; }
  .step-detail { display: block; font-size: 0.82rem; color: var(--muted); margin-top: 0.2rem; line-height: 1.4; }
  .fact-list { margin-top: 0.35rem; display: flex; flex-direction: column; gap: 0.15rem; }
  .fact-row { display: flex; gap: 0.6rem; font-size: 0.82rem; line-height: 1.4; }
  .fact-label { flex: 0 0 6.2rem; color: var(--faint); text-transform: uppercase; letter-spacing: 0.03em;
    font-size: 0.68rem; font-weight: 600; padding-top: 0.1rem; font-family: 'IBM Plex Mono', monospace; }
  .fact-value { flex: 1; color: var(--ink); }
  .empty { color: var(--muted); font-style: italic; }

  /* risk-list / plain-list (risk notes, exposure) — numbered + indented to
     match ol.ordered-list (systems notes) for visual consistency across
     the three label/detail list types. */
  ul.risk-list, .plain-list { list-style: none; margin: 0; padding: 0; font-size: 0.9rem; counter-reset: step; }
  ul.risk-list li, .plain-list li { counter-increment: step; position: relative; padding: 0.6rem 0 0.6rem 1.9rem;
    border-bottom: 1px solid var(--border); }
  ul.risk-list li:last-child, .plain-list li:last-child { border-bottom: none; }
  ul.risk-list li::before, .plain-list li::before { content: counter(step); position: absolute; left: 0; top: 0.6rem;
    width: 1.3rem; height: 1.3rem; border-radius: 50%; background: var(--bg); border: 1px solid var(--border-strong);
    color: var(--muted); font-family: 'IBM Plex Mono', monospace; font-size: 0.66rem; display: flex;
    align-items: center; justify-content: center; }
  .risk-source { font-size: 0.72rem; color: var(--faint); font-family: 'IBM Plex Mono', monospace; margin-left: 0.4rem; }

  /* success criteria */
  ul.criteria-list { list-style: none; margin: 0; padding: 0; font-size: 0.9rem; }
  ul.criteria-list .criterion-row { display: flex; align-items: flex-start; gap: 0.7rem; padding: 0.7rem 0;
    border-bottom: 1px solid var(--border); }
  ul.criteria-list .criterion-row:last-child { border-bottom: none; }
  .criterion-body { flex: 1; min-width: 0; }
  .kind-pill { flex: 0 0 auto; font-family: 'IBM Plex Mono', monospace; font-size: 0.64rem; letter-spacing: 0.03em;
    text-transform: uppercase; padding: 0.18rem 0.55rem; border-radius: 999px; font-weight: 600; margin-top: 0.1rem; }
  .kind-pill.kind-control { color: var(--ok); background: var(--ok-soft); }
  .kind-pill.kind-influence { color: var(--accent); background: var(--accent-soft); }
  .loo-tag { display: inline-block; font-family: 'IBM Plex Mono', monospace; font-size: 0.66rem; color: var(--faint);
    border: 1px solid var(--border); border-radius: 4px; padding: 0.05rem 0.35rem; margin: 0.35rem 0.4rem 0 0; }

  /* stakeholder table */
  table.stake-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
  table.stake-table th { text-align: left; font-family: 'IBM Plex Mono', monospace; font-size: 0.66rem;
    letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint); font-weight: 500; padding: 0 0 0.5rem;
    border-bottom: 1px solid var(--border-strong); }
  table.stake-table td { padding: 0.6rem 0.6rem 0.6rem 0; border-bottom: 1px solid var(--border); vertical-align: top; }
  table.stake-table tr:last-child td { border-bottom: none; }
  table.stake-table td:first-child { padding-left: 0; font-weight: 600; }
  .power-dot { display: inline-flex; gap: 2px; vertical-align: middle; }
  .power-dot span { width: 6px; height: 6px; border-radius: 50%; background: var(--border-strong); }
  .power-dot span.lit { background: var(--accent); }
  .stance-arrow { color: var(--muted); white-space: nowrap; }
  .stance-target { color: var(--ink); font-weight: 500; }

  /* decision callout */
  .decision-callout { border-left: 3px solid var(--accent); padding: 0.2rem 0 0.2rem 1rem; }
  .decision-callout .dc-label { font-family: 'IBM Plex Mono', monospace; font-size: 0.66rem; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--accent-ink); display: block; margin-bottom: 0.3rem; }
  .decision-callout .dc-choice { font-size: 0.96rem; font-weight: 600; margin-bottom: 0.5rem; }
  .decision-callout .dc-reverse { font-size: 0.85rem; color: var(--muted); }
  .decision-callout .dc-reverse b { color: var(--ink); font-weight: 500; }

  /* Any element carrying a title-attr gets a quiet visual cue (dotted
     underline) so hoverable context doesn't look identical to plain text —
     the reader needs some signal something's there to find. The native
     browser tooltip itself is unreliable (slow OS delay, unstyled, easy to
     miss) so the script below swaps title -> data-tip and renders a real
     tooltip on hover/focus instead; this selector still matches [title]
     during the instant before that swap runs, and as a harmless no-op
     fallback if JS is disabled. */
  [title], [data-tip] { text-decoration: underline dotted var(--border-strong); text-underline-offset: 3px;
    text-decoration-thickness: 1px; cursor: help; }
  h1[title], h1[data-tip] { cursor: inherit; }

  /* Custom tooltip: title/data-tip attrs are read by gambitTooltip below and
     rendered into this single shared element instead of relying on the
     browser's own (slow, unstyled) title tooltip. */
  #gambit-tooltip { position: fixed; z-index: 100; max-width: 22rem; background: var(--ink); color: var(--bg);
    font-size: 0.8rem; line-height: 1.4; padding: 0.5rem 0.7rem; border-radius: 6px;
    box-shadow: 0 4px 16px -4px rgba(0,0,0,0.35); pointer-events: none; opacity: 0; transform: translateY(2px);
    transition: opacity 0.1s ease, transform 0.1s ease; text-decoration: none; }
  #gambit-tooltip.visible { opacity: 1; transform: translateY(0); }

  footer.meta-foot { text-align: center; font-family: 'IBM Plex Mono', monospace; font-size: 0.72rem;
    color: var(--faint); margin-top: 2.5rem; }
  .disconnected { position: fixed; top: 0; left: 0; right: 0; background: var(--bad); color: white;
    text-align: center; padding: 0.3rem; font-size: 0.85rem; display: none; z-index: 10; }
</style>
</head>
<body>
<div class="disconnected" id="disconnected">Reconnecting…</div>
<div class="wrap">
  <h1 class="goal-title">${escapeHtml(shortTitle)}</h1>

  ${bridgeHtml(goal)}
  ${criteriaHtml(goal.criteria)}

  ${groupsHtml}

  <footer class="meta-foot">GOAL.json · gambit visualize</footer>
</div>
<div id="gambit-tooltip" role="tooltip"></div>
<script>
  const es = new EventSource('/events');
  const banner = document.getElementById('disconnected');
  es.onmessage = (e) => {
    if (e.data === 'reload') location.reload();
  };
  es.onerror = () => { banner.style.display = 'block'; };
  es.onopen = () => { banner.style.display = 'none'; };

  // Replaces the native title-attr tooltip (slow OS delay, unstyled, easy
  // to miss on a dashboard meant to be scanned) with a fast styled one.
  // title -> data-tip so the browser never also shows its own tooltip on
  // top of this one.
  (function () {
    const tip = document.getElementById('gambit-tooltip');
    document.querySelectorAll('[title]').forEach((el) => {
      const text = el.getAttribute('title');
      el.removeAttribute('title');
      el.setAttribute('data-tip', text);
      el.setAttribute('tabindex', el.tabIndex >= 0 ? el.tabIndex : '0');
    });

    function place(x, y) {
      const pad = 10;
      const rect = tip.getBoundingClientRect();
      let left = x + pad;
      let top = y + pad;
      if (left + rect.width > window.innerWidth - pad) left = x - rect.width - pad;
      if (top + rect.height > window.innerHeight - pad) top = y - rect.height - pad;
      tip.style.left = Math.max(pad, left) + 'px';
      tip.style.top = Math.max(pad, top) + 'px';
    }

    let pinned = null;

    function show(el, x, y) {
      const text = el.getAttribute('data-tip');
      if (!text) return;
      tip.textContent = text;
      tip.classList.add('visible');
      place(x, y);
    }
    function hide() {
      tip.classList.remove('visible');
      pinned = null;
    }

    document.addEventListener('mousemove', (e) => {
      if (pinned) return;
      const el = e.target.closest('[data-tip]');
      if (el) show(el, e.clientX, e.clientY);
      else hide();
    });
    document.addEventListener('mouseleave', () => { if (!pinned) hide(); });

    document.addEventListener('focusin', (e) => {
      const el = e.target.closest('[data-tip]');
      if (!el) return;
      const rect = el.getBoundingClientRect();
      show(el, rect.left, rect.bottom);
    });
    document.addEventListener('focusout', (e) => {
      if (!pinned && e.target.closest('[data-tip]')) hide();
    });

    // Tap/click support: hover-only leaves touch devices with no way to
    // trigger a tooltip at all, since there's no hover state to fire
    // mousemove. A click on a tooltip target pins it open (so tapping a
    // <summary> or a next-action row for its tooltip doesn't also toggle
    // the details it sits inside); a click anywhere else dismisses it.
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-tip]');
      if (el) {
        e.preventDefault();
        e.stopPropagation();
        if (pinned === el) { hide(); return; }
        pinned = el;
        const rect = el.getBoundingClientRect();
        show(el, rect.left, rect.bottom);
      } else if (pinned) {
        hide();
      }
    }, true);
  })();
</script>
</body>
</html>`;
}
