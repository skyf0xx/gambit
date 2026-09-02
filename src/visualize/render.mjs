import { parseGoalMd } from './parse.mjs';
import { rendererForSection } from './registry.mjs';
import { renderChecklist } from './renderers/checklist.mjs';
import { renderLinesOfOperation } from './renderers/linesOfOperation.mjs';
import { renderNetwork } from './renderers/network.mjs';
import { renderTimeline } from './renderers/timeline.mjs';
import { renderDecisionFork } from './renderers/decisionFork.mjs';
import { renderPlainCard } from './renderers/plainCard.mjs';

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Renders one section to a { kind: 'mermaid'|'html', title, body } card.
// Falls through to plain-card whenever the specialised renderer finds
// nothing it can draw (e.g. a Plan section with no Critical path line and
// no bullets yet) rather than showing an empty diagram.
function renderSection(section, ctx) {
  const type = rendererForSection(section.heading);

  switch (type) {
    case 'checklist':
      return { kind: 'html', title: section.heading, body: renderChecklist(section.body) };

    case 'lines-of-operation': {
      const mermaid = renderLinesOfOperation(section.body, ctx);
      if (!mermaid) return { kind: 'html', title: section.heading, body: renderPlainCard(section.body) };
      return { kind: 'mermaid', title: section.heading, body: mermaid };
    }

    case 'network': {
      const result = renderNetwork(section.body, ctx);
      if (!result) return { kind: 'html', title: section.heading, body: renderPlainCard(section.body) };
      if (result.kind === 'table') return { kind: 'html', title: section.heading, body: result.html };
      return { kind: 'mermaid', title: section.heading, body: result.text };
    }

    case 'timeline': {
      const mermaid = renderTimeline(section.body);
      if (!mermaid) return { kind: 'html', title: section.heading, body: renderPlainCard(section.body) };
      return { kind: 'mermaid', title: section.heading, body: mermaid };
    }

    case 'decision-fork': {
      const mermaid = renderDecisionFork(section.body);
      if (!mermaid) return { kind: 'html', title: section.heading, body: renderPlainCard(section.body) };
      return { kind: 'mermaid', title: section.heading, body: mermaid };
    }

    default:
      return { kind: 'html', title: section.heading, body: renderPlainCard(section.body) };
  }
}

export function renderGoal(rawBody) {
  const parsed = parseGoalMd(rawBody);
  const cards = parsed.sections.map((s) => renderSection(s, { goalTitle: parsed.title }));

  return {
    title: parsed.title,
    shortTitle: parsed.shortTitle,
    deadline: parsed.deadline,
    criteria: parsed.criteria,
    focus: parsed.focus,
    cards,
  };
}

export { escapeHtml };
