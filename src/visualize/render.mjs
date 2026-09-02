import { parseGoalMd } from './parse.mjs';
import { rendererForSection } from './registry.mjs';
import {
  renderCriteriaStatus,
  renderExperiments,
  renderForecasts,
  renderCapacity,
} from './renderers/checklist.mjs';
import { renderOrderedList, renderRiskList } from './renderers/orderedList.mjs';
import { renderStakeholderNetwork } from './renderers/network.mjs';
import { renderDecisionFork } from './renderers/decisionFork.mjs';
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

// Visual weight, not just reading order — mirrors AGENTS.md's own emphasis:
// what to do and whether it's working outrank why, who outranks what could
// go wrong, and material that's checked rarely (capacity, forecasts,
// experiments, exposure) reads quieter than the active-decision sections.
const SECTION_TIER = {
  plan: 'primary',
  criteriaStatus: 'primary',
  stakeholders: 'secondary',
  systemsNotes: 'secondary',
  riskNotes: 'secondary',
  decisions: 'secondary',
  exposure: 'reference',
  capacity: 'reference',
  forecasts: 'reference',
  experiments: 'reference',
};

// camelCase schema key -> "Title Case" heading, matching the old Markdown
// headings ("Systems notes", "Risk notes", "Criteria status") — only the
// first word is capitalized, not every word.
function titleForKey(key) {
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Renders one { key, data } section to a { kind: 'mermaid'|'html', title, body }
// card. Falls through to plain-card whenever the specialised renderer finds
// nothing it can draw (e.g. an empty array slipping through) rather than
// showing an empty diagram.
function renderSection(section, ctx) {
  const type = rendererForSection(section.key);
  const title = titleForKey(section.key);
  const tier = SECTION_TIER[section.key] ?? 'secondary';
  const key = section.key;

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
      return { kind: 'html', title, tier, key, body };
    }

    case 'ordered-list': {
      const steps = section.key === 'plan' ? section.data.criticalPath : section.data.topFindings;
      return { kind: 'html', title, tier, key, body: renderOrderedList(steps) };
    }

    case 'risk-list':
      return { kind: 'html', title, tier, key, body: renderRiskList(section.data) };

    case 'network': {
      const result = renderStakeholderNetwork(section.data, ctx);
      if (!result) return { kind: 'html', title, tier, key, body: '<p class="empty">No items yet.</p>' };
      if (result.kind === 'table') return { kind: 'html', title, tier, key, body: result.html };
      return { kind: 'mermaid', title, tier, key, body: result.text, tooltips: result.tooltips };
    }

    case 'decision-fork': {
      const mermaid = renderDecisionFork(section.data);
      if (!mermaid) return { kind: 'html', title, tier, key, body: '<p class="empty">No items yet.</p>' };
      return { kind: 'mermaid', title, tier, key, body: mermaid };
    }

    default:
      return { kind: 'html', title, tier, key, body: renderPlainCard(section.data) };
  }
}

export function renderGoal(rawBody) {
  const parsed = parseGoalMd(rawBody);
  const cards = parsed.sections.map((s) => renderSection(s, { centerLabel: parsed.title }));

  return {
    title: parsed.title,
    deadline: parsed.deadline,
    criteria: parsed.criteria,
    focus: parsed.focus,
    cards,
  };
}

export { escapeHtml, titleForKey, formatDate };
