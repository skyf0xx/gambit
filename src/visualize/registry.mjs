// Maps each GOAL.md section to the renderer that draws it. This is the
// single source of truth for the mapping — each skill's SKILL.md carries a
// matching `display:` frontmatter field for humans reading the skill file,
// but the server reads this table, not the frontmatter, at render time.
//
// Renderer types (kept to six deliberately — see AGENTS.md's formatting
// philosophy: dense and scannable, not overdrawn). A section not listed
// here falls back to 'plain-card'.

export const SECTION_RENDERERS = {
  'Plan': 'lines-of-operation',
  'Systems notes': 'lines-of-operation',
  'Criteria status': 'checklist',
  'Capacity': 'checklist',
  'Experiments': 'checklist',
  'Forecasts': 'checklist',
  'Stakeholders': 'network',
  'Risk notes': 'network',
  'Decisions': 'decision-fork',
};

// Skills whose primary output isn't a GOAL.md section at all (read-only
// reads, or prose the user reads in the session) — never diagrammed,
// always the plain-card fallback if they ever do write something ad hoc.
export const PLAIN_CARD_SKILLS = [
  'onboard', 'brief', 'status', 'research', 'intel', 'comms', 'exposure', 'premortem',
];

export function rendererForSection(heading) {
  return SECTION_RENDERERS[heading] ?? 'plain-card';
}
