# Strategy reference: goal format

The schema (`packages/core/src/schema.mjs`) wins if this ever disagrees with it.


The authoritative shape is the Zod schema in `packages/core/src/schema.mjs`
(`goalSchema`) — every reader validates through it, including every `write_section`
call. This section is a human-readable summary of that schema, not a second spec — if
the two ever disagree, the schema wins.

```json
{
  "schemaVersion": 5,
  "goal": "[plain sentence, 10 words max — one idea, no dash-joined clauses]",
  "subGoals": ["[optional — a part or condition of the aim itself, e.g. \"without burning out\"; not a success criterion]"],
  "successCriteria": [
    { "text": "[specific, measurable condition]", "kind": "control" },
    { "text": "[specific, measurable condition]", "kind": "influence", "lineOfOperation": "[optional — matches a plan.linesOfOperation[].label]", "detail": "[optional — why this matters, hover-only]" }
  ],
  "deadline": "YYYY-MM-DD or null",
  "people": [
    { "name": "[name/role]", "status": "confirmed", "doing": "[what they're doing]", "detail": "[optional — why they matter, hover-only]" }
  ],
  "posture": {
    "current": { "level": 1, "label": "Normal" },
    "levels": [
      { "level": 1, "label": "Normal", "meaning": "[pace/risk/ask of people]" },
      { "level": 2, "label": "Heightened" }
    ],
    "triggers": ["[conditions that would force a change, if known]"],
    "lastReviewed": "YYYY-MM-DD"
  },
  "plan": {
    "linesOfOperation": [
      {
        "label": "[short name, matches a successCriteria[].lineOfOperation]",
        "criticalPath": [
          { "id": "a", "label": "[a milestone: a point the line passes]", "detail": "[optional, hover-only]", "after": ["first"] }
        ],
        "nextActions": [{ "id": "first", "action": "...", "who": "...", "when": "YYYY-MM-DD", "status": "pending | done | dropped", "detail": "[optional, hover-only]" }],
        "status": "on_schedule",
        "blocker": "[optional, only when status is blocked]"
      }
    ]
  },
  "systemsNotes": {
    "schwerpunkt": "...",
    "confidence": "high",
    "topFindings": [{ "label": "...", "detail": "[optional, hover-only]" }],
    "lastReviewed": "YYYY-MM-DD"
  },
  "riskNotes": [{ "item": "...", "source": "threat", "accepted": false }],
  "criteriaStatus": [
    { "text": "[verbatim from successCriteria]", "kind": "control", "lineOfOperation": "[optional, echoes the matching successCriteria entry]", "status": "on_track", "detail": "[optional — why this status, hover-only]" }
  ],
  "stakeholders": [
    { "name": "...", "power": "high", "stanceCurrent": "...", "stanceTarget": "...", "via": "...", "detail": "[optional, hover-only]" }
  ],
  "exposure": [{ "item": "...", "status": "open", "mustHandleBefore": "..." }],
  "capacity": { "availableHrsPerWeek": 10, "runway": "[until date/condition]", "detail": "[optional — elaborates on runway, hover-only]", "lastReviewed": "YYYY-MM-DD" },
  "forecasts": [
    { "statement": "...", "probability": 70, "resolvesBy": "YYYY-MM-DD", "resolvesVia": "...", "resolved": false, "detail": "[optional, hover-only]" }
  ],
  "experiments": [
    { "assumption": "...", "test": "...", "passIf": "...", "by": "YYYY-MM-DD", "done": false, "detail": "[optional, hover-only]" }
  ],
  "decisions": [
    { "date": "YYYY-MM-DD", "choice": "[what was chosen]", "reverseIf": "[observable signal]" }
  ],
  "log": [
    { "date": "YYYY-MM-DD", "assessment": "on_track", "focus": "...", "notes": ["..."] }
  ]
}
```

`systemsNotes`, `posture`, and `capacity` each carry a required `lastReviewed`
(`YYYY-MM-DD`) — set every time `systems`, `strategy` or `capacity` writes that section, whether or not the content
changed. Unlike `log`, which records history, these are environmental *reads*
that go stale even without user action — `lastReviewed` is what lets a later
session tell a current read from a three-week-old one without scanning `log`.

Several array fields carry an optional `detail` (max 280 chars) — a hover-only tooltip
in the visual layer, shown alongside the short scannable label rather than replacing it.
It exists so a user returning later can see *why* a terse label was written without the
label itself getting longer. Fill it in only when there's a genuinely non-obvious reason
worth preserving, not mechanically on every entry. `plan.linesOfOperation[].criticalPath` and
`systemsNotes.topFindings` are the two fields reshaped from bare label strings to
`{label, detail?}` objects to carry this; every other touched field just gains `detail`
alongside its existing keys. `postureLevel.meaning`, `riskNote.detail`,
`exposureItem.why`, and `decision.because` already serve this same elaboration role
under their own names and don't get a second `detail` field.

Mark each success criterion `control` (you can cause it directly) or `influence`
(it depends on a decision someone else makes). Influence criteria are legitimate, but
progress against them is measured differently — see `eval`.

`log` is the only append-only array. Only include `people` entries and a non-null
`posture` if they're actually relevant to this goal.

A milestone has no status of its own: it is reached once every task in its `after` is
done or dropped, with at least one done. Write validation also runs a soft
reconciliation lint after the schema check: it warns (doesn't fail the write) when every
milestone on a `lineOfOperation` is reached but the line's own `status` isn't `done`.
Treat that warning as a prompt to update the line's status, not something to silently
accept. It's a hint, not proof, since a line can still be genuinely blocked on something
in `nextActions` that leads to no milestone.
