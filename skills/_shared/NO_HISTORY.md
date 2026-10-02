# No history in output

Applies whenever a skill writes to the goal via `write_section`,
`append_log`, `remember`, or `set_status` — not a skill in its own right, referenced
from AGENTS.md's voice rules. Adapted from the `no-history-in-output`
skill.

A written key should describe the current state of the thing, not the
process that produced it.

## The two layers this governs separately

- **Every owned key except `log`** (`goal`, `successCriteria`, `people`,
  `posture`, `plan`, `systemsNotes`, `riskNotes`, `decisions`,
  `stakeholders`, `exposure`, `capacity`, `forecasts`, `experiments`,
  `criteriaStatus`) is replaced wholesale on each `write_section` call, per
  AGENTS.md's "The goal contract." These read as current state, full
  stop — no trace of what they said before.
- **`log`** is the one deliberately append-only array, written through
  `append_log` — the sequence of entries over time *is* the goal's
  history, and that's correct. An entry records what happened or was
  decided in this exchange, in at most 3 notes. It never restates the
  situation: where things stand lives in the owning keys, and a note that
  repeats a recent entry is refused. Nor does it re-narrate the
  discussion that produced it.
- **`memory`** holds what the user said that no other key holds. It
  changes one entry at a time through `remember` and `forget`, and a
  correction replaces the entry it corrects (`replaces`), so it reads as
  current state like every other key.

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
  into the goal itself.
- A direct quote or the user's own wording being recorded verbatim — this
  rule shapes a skill's own narration, not what it's quoting.
