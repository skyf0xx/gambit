# No history in output

Applies whenever a skill writes to `GOAL.json` — not a skill in its own
right, referenced from AGENTS.md's voice rules the way `RESOLVING.md` is
referenced rather than invoked. Adapted from the `no-history-in-output`
skill.

A written key should describe the current state of the thing, not the
process that produced it.

## The two layers this governs separately

- **Every owned key except `log`** (`goal`, `successCriteria`, `people`,
  `posture`, `plan`, `systemsNotes`, `riskNotes`, `decisions`,
  `stakeholders`, `exposure`, `capacity`, `forecasts`, `experiments`,
  `criteriaStatus`) is replaced in place on each write, per AGENTS.md's
  "GOAL.json contract." These read as current state, full stop — no trace
  of what they said before.
- **`log`** is the one deliberately append-only array — the sequence of
  entries over time *is* the goal's history, and that's correct. What
  this rule adds is narrower: **a single entry doesn't re-narrate the
  discussion that produced it.** Each entry states what's true or what
  happened as of that entry, plainly — not a diff against the entry
  before it.

## Rules

- Never write string values like `"(unchanged)"`, `"(updated)"`, `"(new)"`,
  `"(revised)"` into any field of an owned key.
- Never narrate the discussion that led to a decision inside a key's
  value or a single log entry — "we considered X but decided against it,"
  "originally this was Y, now it's Z," "per your feedback..." A log entry
  may state that a decision was made and what it was; it doesn't replay
  the back-and-forth that produced it.
- No changelogs, version-history arrays, or meta-commentary about the
  conversation inside any key, unless the user explicitly asks for a
  changelog as a deliverable in its own right.
- Write every non-`log` key as a plain statement of fact about the
  current design/plan/content, as if writing it fresh with full knowledge
  of the final state — not as a diff against a prior version.
- A resolved tradeoff or intentional choice is stated as the choice and
  its rationale ("the deadline is 2026-09-05, to do eval persistence
  properly rather than rush it"), not as a record of the deliberation
  ("originally same-day, but after discussion the user chose to move it").
- Applies equally to first generation and every later revision — a
  "please update this" request re-derives a clean current-state value for
  the key, it doesn't layer edit notes onto what was there.

## When NOT to apply

- The user explicitly asks for a changelog, revision history, or "show me
  what changed" — a one-off request, answered directly, not written back
  into `GOAL.json` itself.
- A direct quote or the user's own wording being recorded verbatim — this
  rule shapes a skill's own narration, not what it's quoting.
