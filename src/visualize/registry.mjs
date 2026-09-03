// Maps each GOAL.json owned key to the renderer that draws it, and to the
// disclosure group it appears under on the visualize page. This is the
// single source of truth for both mappings — each skill's SKILL.md carries
// a matching `display:` frontmatter field for humans reading the skill
// file, but the server reads this table, not the frontmatter, at render
// time.
//
// No section renders as a diagram — 'network' and 'decision-fork' (Mermaid)
// were replaced by 'stakeholder-table' and 'decision-callout' (plain HTML):
// a hub-and-spoke graph of at most 8 nodes and a two-fact decision fork
// both carried less information than a table row or a callout, at a much
// bigger footprint and worse legibility. Sequences like Plan and flat lists
// like Risk Notes were already text ('ordered-list' / 'risk-list') for the
// same reason. A section not listed here falls back to 'plain-card'.

export const SECTION_RENDERERS = {
  plan: 'ordered-list',
  systemsNotes: 'ordered-list',
  criteriaStatus: 'checklist',
  capacity: 'checklist',
  experiments: 'checklist',
  forecasts: 'checklist',
  people: 'stakeholder-table',
  stakeholders: 'stakeholder-table',
  riskNotes: 'risk-list',
  decisions: 'decision-callout',
};

// Which collapsible group each section renders under on the visualize page
// (see page.mjs). 'plan' and 'criteriaStatus' render inside the always-open
// Bridge/Plan group since they're what changes session to session; the rest
// group by subject into collapsed-by-default sections so reference material
// (checked rarely) doesn't compete for attention with what to do next.
export const SECTION_GROUPS = {
  plan: 'plan',
  criteriaStatus: 'plan',
  people: 'people',
  stakeholders: 'people',
  riskNotes: 'people',
  decisions: 'people',
  forecasts: 'forecasts',
  experiments: 'forecasts',
  exposure: 'exposure',
  capacity: 'exposure',
  systemsNotes: 'reference',
};

export const GROUP_LABELS = {
  plan: 'Plan & progress',
  people: 'People & risk',
  forecasts: 'Forecasts & experiments',
  exposure: 'Exposure & capacity',
  reference: 'Reference',
};

// Display order of groups on the page, and of sections within a group.
// 'reference' (systemsNotes) sits last — it's background analysis that
// fed the plan rather than something to act on, so it belongs below
// everything the user might actually need to check or do.
export const GROUP_ORDER = ['plan', 'people', 'forecasts', 'exposure', 'reference'];

// Skills whose primary output isn't a GOAL.json section at all (read-only
// reads, or prose the user reads in the session) — never diagrammed,
// always the plain-card fallback if they ever do write something ad hoc.
export const PLAIN_CARD_SKILLS = [
  'onboard', 'brief', 'status', 'research', 'intel', 'comms', 'exposure', 'premortem',
];

export function rendererForSection(key) {
  return SECTION_RENDERERS[key] ?? 'plain-card';
}

export function groupForSection(key) {
  return SECTION_GROUPS[key] ?? 'people';
}
