import { parseGoalMd } from './parse.mjs';
import { rendererForSection } from './registry.mjs';
import {
  renderCriteriaStatus,
  renderExperiments,
  renderForecasts,
  renderCapacity,
} from './renderers/checklist.mjs';
import { renderLinesOfOperation } from './renderers/linesOfOperation.mjs';
import { renderStakeholderNetwork, renderRiskNetwork } from './renderers/network.mjs';
import { renderDecisionFork } from './renderers/decisionFork.mjs';
import { renderPlainCard } from './renderers/plainCard.mjs';

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

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
      return { kind: 'html', title, body };
    }

    case 'lines-of-operation': {
      const steps = section.key === 'plan' ? section.data.criticalPath : section.data.topFindings;
      const result = renderLinesOfOperation(steps);
      if (!result) return { kind: 'html', title, body: '<p class="empty">No items yet.</p>' };
      return { kind: 'mermaid', title, body: result.mermaid, tooltips: result.tooltips };
    }

    case 'network': {
      const result =
        section.key === 'stakeholders'
          ? renderStakeholderNetwork(section.data, ctx)
          : renderRiskNetwork(section.data, ctx);
      if (!result) return { kind: 'html', title, body: '<p class="empty">No items yet.</p>' };
      if (result.kind === 'table') return { kind: 'html', title, body: result.html };
      return { kind: 'mermaid', title, body: result.text, tooltips: result.tooltips };
    }

    case 'decision-fork': {
      const mermaid = renderDecisionFork(section.data);
      if (!mermaid) return { kind: 'html', title, body: '<p class="empty">No items yet.</p>' };
      return { kind: 'mermaid', title, body: mermaid };
    }

    default:
      return { kind: 'html', title, body: renderPlainCard(section.data) };
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

export { escapeHtml, titleForKey };
