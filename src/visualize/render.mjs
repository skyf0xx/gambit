import { parseGoalMd } from './parse.mjs';
import { rendererForSection, groupForSection, GROUP_LABELS, GROUP_ORDER } from './registry.mjs';
import {
  renderCriteriaStatus,
  renderExperiments,
  renderForecasts,
  renderCapacity,
} from './renderers/checklist.mjs';
import { renderOrderedList, renderRiskList } from './renderers/orderedList.mjs';
import { renderStakeholderTable } from './renderers/stakeholderTable.mjs';
import { renderDecisionCallout } from './renderers/decisionCallout.mjs';
import { renderPlainCard } from './renderers/plainCard.mjs';

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// "2026-10-15" -> "Oct 15, 2026". Every dateString schema field (deadline
// here; resolvesBy/by/mustHandleBefore in their own renderer files — see
// formatDate in checklist.mjs and plainCard.mjs) is stored as YYYY-MM-DD for
// sorting and validation, but read as a human date everywhere it's
// displayed. Parsed as UTC noon rather than midnight local so no timezone
// can roll it to the adjacent calendar day. Falls back to the raw string if
// it doesn't match — callers should never hide a value just because it's
// malformed.
function formatDate(dateStr) {
  if (!dateStr) return dateStr;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return dateStr;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// Whole weeks between today and a YYYY-MM-DD deadline, for the Bridge's
// countdown stat. Negative once the deadline has passed. UTC noon for the
// same reason as formatDate — no timezone can roll either side to the
// adjacent calendar day.
function weeksUntil(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  const target = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
  return Math.round((target - today) / (7 * 24 * 60 * 60 * 1000));
}

// camelCase schema key -> "Title Case" heading, matching the old Markdown
// headings ("Systems notes", "Risk notes", "Criteria status") — only the
// first word is capitalized, not every word.
function titleForKey(key) {
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Short summary shown on a collapsed card's summary line — the one thing
// worth knowing before the reader opens it. Falls back to an item count so
// every card has *some* hint rather than a bare title.
function hintForSection(key, data) {
  switch (key) {
    case 'criteriaStatus': {
      const counts = data.reduce((acc, c) => ({ ...acc, [c.status]: (acc[c.status] ?? 0) + 1 }), {});
      return Object.entries(counts)
        .map(([status, n]) => `${n} ${status.replace('_', ' ')}`)
        .join(' · ');
    }
    case 'stakeholders':
      return `${data.length} tracked`;
    case 'riskNotes': {
      const open = data.filter((r) => !r.accepted).length;
      const accepted = data.length - open;
      return [open && `${open} open`, accepted && `${accepted} accepted`].filter(Boolean).join(' · ');
    }
    case 'decisions':
      return formatDate(data[data.length - 1].date);
    case 'forecasts': {
      const resolved = data.filter((f) => f.resolved).length;
      return `${data.length - resolved} open · ${resolved} scored`;
    }
    case 'experiments': {
      const done = data.filter((e) => e.done).length;
      return `${done} done · ${data.length - done} running`;
    }
    case 'exposure': {
      const open = data.filter((e) => e.status === 'open').length;
      const accepted = data.length - open;
      return [open && `${open} open`, accepted && `${accepted} accepted`].filter(Boolean).join(' · ');
    }
    case 'capacity':
      return [
        data.availableHrsPerWeek != null && `${data.availableHrsPerWeek} hrs/wk`,
        data.runway && `${data.runway} runway`,
      ]
        .filter(Boolean)
        .join(' · ');
    default:
      return Array.isArray(data) ? `${data.length} item${data.length === 1 ? '' : 's'}` : '';
  }
}

// Renders one { key, data } section to a { title, hint, group, body } card.
// plan.linesOfOperation fans out into one summary line per line of
// operation inside a single 'Plan' card (rather than one card per line, or
// one flat 'Plan' card) so the Bridge's plan group reads as one scannable
// unit with each line's own status pill and steps, matching the demo.
function renderPlanSection(section) {
  const lines = section.data.linesOfOperation;
  const statusCounts = lines.reduce((acc, l) => {
    const s = l.status ?? 'on_schedule';
    return { ...acc, [s]: (acc[s] ?? 0) + 1 };
  }, {});
  const hint =
    lines.length === 1
      ? (lines[0].status ?? 'on_schedule').replace('_', ' ')
      : Object.entries(statusCounts)
          .filter(([s]) => s !== 'on_schedule')
          .map(([s, n]) => `${n} ${s.replace('_', ' ')}`)
          .join(' · ') || 'on schedule';

  const body = lines
    .map((line) => {
      const status = line.status ?? 'on_schedule';
      const stepsHtml = renderOrderedList(line.criticalPath);
      const actionsHtml = line.nextActions?.length
        ? `<ul class="next-actions">${line.nextActions
            .map(
              (a) =>
                `<li><span${a.detail ? ` title="${escapeHtml(a.detail)}"` : ''}>${escapeHtml(a.action)}</span><span class="who">${escapeHtml(a.who)} · ${escapeHtml(a.when)}</span></li>`
            )
            .join('\n')}</ul>`
        : '';
      const blockerHtml = line.blocker
        ? `<div class="step-detail" style="margin-top:0.5rem">${escapeHtml(line.blocker)}</div>`
        : '';
      return `<div class="loo">
        <div class="loo-head">
          <span class="loo-name">${escapeHtml(line.label)}</span>
          <span class="status-pill ${status}">${escapeHtml(status.replace('_', ' '))}</span>
        </div>
        ${stepsHtml}
        ${blockerHtml}
        ${actionsHtml}
      </div>`;
    })
    .join('\n');

  return {
    title: `Plan — ${lines.length} line${lines.length === 1 ? '' : 's'} of operation`,
    hint,
    group: 'plan',
    key: 'plan',
    body,
  };
}

function renderSection(section) {
  if (section.key === 'plan') return renderPlanSection(section);

  const type = rendererForSection(section.key);
  const title = titleForKey(section.key);
  const group = groupForSection(section.key);
  const key = section.key;
  const hint = hintForSection(section.key, section.data);

  switch (type) {
    case 'checklist': {
      const body =
        section.key === 'criteriaStatus'
          ? renderCriteriaStatus(section.data)
          : section.key === 'experiments'
            ? renderExperiments(section.data)
            : section.key === 'forecasts'
              ? renderForecasts(section.data)
              : renderCapacity(section.data);
      return { title, hint, group, key, body };
    }

    case 'ordered-list': {
      const steps = section.data.topFindings;
      return { title, hint, group, key, body: renderOrderedList(steps) };
    }

    case 'risk-list':
      return { title, hint, group, key, body: renderRiskList(section.data) };

    case 'stakeholder-table':
      return { title, hint, group, key, body: renderStakeholderTable(section.data) };

    case 'decision-callout':
      return { title: 'Latest decision', hint, group, key, body: renderDecisionCallout(section.data) };

    default:
      return { title, hint, group, key, body: renderPlainCard(section.data) };
  }
}

// Progress segments for the Bridge's criteria bar: one segment per success
// criterion, colored by its latest criteriaStatus (falling back to
// 'unknown' — an empty grey segment — when a criterion has no status entry
// yet, e.g. right after `onboard` before `eval` has ever run).
function criteriaProgress(criteria, criteriaStatus) {
  const statusByText = new Map(criteriaStatus.map((c) => [c.text, c.status]));
  return criteria.map((c) => statusByText.get(c.text) ?? 'unknown');
}

export function renderGoal(rawBody) {
  const parsed = parseGoalMd(rawBody);
  const cards = parsed.sections.flatMap((s) => renderSection(s));

  const groups = GROUP_ORDER.map((group) => ({
    key: group,
    label: GROUP_LABELS[group],
    cards: cards.filter((c) => c.group === group),
  })).filter((g) => g.cards.length > 0);

  const criteriaStatusSection = parsed.sections.find((s) => s.key === 'criteriaStatus');
  const criteriaStatus = criteriaStatusSection?.data ?? [];
  const metCount = criteriaStatus.filter((c) => c.status === 'on_track').length;

  return {
    title: parsed.title,
    deadline: parsed.deadline,
    deadlineWeeks: parsed.deadline ? weeksUntil(parsed.deadline) : null,
    criteria: parsed.criteria,
    criteriaProgress: criteriaProgress(parsed.criteria, criteriaStatus),
    criteriaMet: metCount,
    focus: parsed.focus,
    posture: parsed.posture,
    nextAction: parsed.nextAction,
    groups,
  };
}

export { escapeHtml, titleForKey, formatDate };
