// Maps each GOAL.json owned key to the renderer that draws it. This is the
// single source of truth for the mapping — each skill's SKILL.md carries a
// matching `display:` frontmatter field for humans reading the skill file,
// but the server reads this table, not the frontmatter, at render time.
//
// Renderer types (kept to six deliberately — see AGENTS.md's formatting
// philosophy: dense and scannable, not overdrawn). A section not listed
// here falls back to 'plain-card'.

export const SECTION_RENDERERS = {
  plan: 'lines-of-operation',
  systemsNotes: 'lines-of-operation',
  criteriaStatus: 'checklist',
  capacity: 'checklist',
  experiments: 'checklist',
  forecasts: 'checklist',
  stakeholders: 'network',
  riskNotes: 'network',
  decisions: 'decision-fork',
};

// Skills whose primary output isn't a GOAL.json section at all (read-only
// reads, or prose the user reads in the session) — never diagrammed,
// always the plain-card fallback if they ever do write something ad hoc.
export const PLAIN_CARD_SKILLS = [
  'onboard', 'brief', 'status', 'research', 'intel', 'comms', 'exposure', 'premortem',
];

export function rendererForSection(key) {
  return SECTION_RENDERERS[key] ?? 'plain-card';
}
