# Plan reference: the plan write

Read from `plan` step 8 before calling `write_section` on `plan`. These are the full
field rules and an example.

Call `write_section` on `plan` with `linesOfOperation` — the current lines, each with its own critical path and next actions — rather than accumulating old ones. `plan.linesOfOperation` is min 1 (a single-thread goal still writes one line, not a bare flat shape). Each line is `{label, criticalPath, nextActions, status?, blocker?}`: `label` is `shortLabel` (40-char hard cap) matching the `lineOfOperation` value used on the `successCriteria` entries it serves; `criticalPath` entries are milestones, `{id, label, detail?, after}` objects (max 6 entries, `label` is `shortLabel`, 40-char hard cap, `after` lists at least one task id; no `status`, since reaching a milestone follows from its tasks); `nextActions` is capped at 10 entries, waiting ones included, each `{id?, action, who, when, status, doneOn?, detail?, after?, if?, to?, level?, replied?, reply?}` (the links as step 6a sets them) where `action` is `mediumLabel` (120-char hard cap — a short label, not a full sentence; put elaboration in `detail` instead of lengthening `action`) and `when` is a date (YYYY-MM-DD) on every live next action (an escalation or fork still waiting may leave it out); `doneOn` is stamped by code when a move is done, so never write it by hand, and keep it as it is when you carry a done move forward. `status` is one of `pending` (default), `proposed`, `done`, `dropped`. Keep each task's `id` the same across rewrites, so the links and the waits keep pointing at the right task. Set that line's own `status` to `on_schedule`, `at_risk`, `blocked`, or `done` — `done` means every `nextActions` entry on that line is itself `done` or `dropped`, so every milestone is reached; don't set the line to `done` while any action is still `pending`. Set `blocker` only when `status` is `blocked`.

`detail` (280 characters or less) is one plain sentence on why this move, why now; a
`proposed` action must carry it. A list of things to do toward a milestone is that
many tasks, never a comma-spliced `detail`. Read with read_skill_file('plan',
'fields.md') for the full rules before writing a proposed move.

```json
{
  "plan": {
    "linesOfOperation": [
      {
        "label": "Main",
        "criticalPath": [
          { "id": "a", "label": "A", "detail": "...", "after": ["found"] },
          { "id": "b", "label": "B", "after": ["photos", "letter"] },
          { "id": "c", "label": "C", "after": ["pitch"] }
        ],
        "nextActions": [
          { "id": "found", "action": "...", "who": "you", "status": "done", "doneOn": "YYYY-MM-DD" },
          { "id": "photos", "action": "...", "who": "you | name", "when": "YYYY-MM-DD", "status": "pending" },
          { "id": "letter", "action": "...", "who": "you", "to": "a stakeholders name", "level": "interests", "after": ["photos"], "when": "YYYY-MM-DD", "status": "pending" },
          { "action": "...", "who": "you", "to": "...", "level": "rights", "if": { "noReply": "letter", "days": 21 }, "detail": "brings the reference number", "status": "pending" },
          { "id": "pitch", "action": "...", "who": "you", "after": ["b"], "status": "pending" },
          { "action": "...", "who": "you", "if": { "event": "...", "by": "YYYY-MM-DD" }, "status": "pending" }
        ],
        "status": "on_schedule",
        "blocker": "..."
      }
    ]
  }
}
```
