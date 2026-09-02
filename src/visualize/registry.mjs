// Maps each GOAL.json owned key to the renderer that draws it. This is the
// single source of truth for the mapping — each skill's SKILL.md carries a
// matching `display:` frontmatter field for humans reading the skill file,
// but the server reads this table, not the frontmatter, at render time.
//
// A diagram (network / decision-fork) is reserved for sections where the
// relationships between items are themselves the point. Everything else —
// including sequences like Plan and flat lists like Risk Notes — reads
// faster as text than as a sparse Mermaid flowchart, so it's routed to
// 'ordered-list' or 'risk-list'. A section not listed here falls back to
// 'plain-card'.

export const SECTION_RENDERERS = {
  plan: 'ordered-list',
  systemsNotes: 'ordered-list',
  criteriaStatus: 'checklist',
  capacity: 'checklist',
  experiments: 'checklist',
  forecasts: 'checklist',
  stakeholders: 'network',
  riskNotes: 'risk-list',
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
