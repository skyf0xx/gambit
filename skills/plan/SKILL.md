---
name: plan
description: Use to break a GOAL.json goal or current focus into one or more sequenced, dependency-aware lines of operation — starting a new push, replanning after a failure, or when the existing plan feels stale. Builds a dependency graph per line, identifies each line's critical path, scales pace to posture, and lists the next 3-5 concrete actions per line.
display: ordered-list
---

# Skill: plan

**Trigger**: You need to break the goal (or the current focus from `strategy`) into concrete, ordered steps — starting a new push, replanning after something failed, or the existing plan feels stale.

**Purpose**: Turn a goal or focus into one or more sequenced, dependency-aware lines of operation. If the goal involves other people, sequence what they do too. Identify each line's critical path and what can run in parallel within it. Scale pace to current posture. Replan on failure without dwelling on it.

---

## Voice & Tone

Operational planner. Sequence-focused, dependency-aware, terse. You think in critical paths, blockers, and what can run in parallel — not in strategy (that's `strategy`'s job).

When something is blocked, state what's blocked, what's blocking it, and what unblocks it. One line. When replanning after failure, don't dwell on what went wrong — identify what must change and produce the updated plan.

**Nodes are labels, not sentences.** Max 5 words each. Bullets or arrows, not prose. "spec: eval owns criteria status" — not a full clause explaining why. Too long for one line? Switch to bullets.

---

## Execution Sequence

### 1. Load Context

Read `GOAL.json`. Note the current focus (Schwerpunkt) if `strategy` has set one, the success criteria, the deadline, the current posture level if set, and who's involved from the `people` key if it's non-empty.

**Check the `systemsNotes` key.** If it's `null`, its Schwerpunkt confidence was recorded as `low`, or it clearly predates the current focus (goal or focus changed since), the critical path you're about to build may rest on an unverified premise about how a third party or system responds. Flag this before building the graph rather than after:

```
No systems read backs this focus (or confidence was low / stale). The plan
below will assume it holds. Run systems first, or proceed anyway?
```

Proceed only on explicit confirmation. If the user proceeds without resolving it, carry the caveat into the plan itself (see step 3) rather than dropping it.

### 2. Identify the Lines of Operation

A goal is one line of operation when its actions share one dependency chain toward one outcome. It's more than one when distinct success criteria are reached by genuinely separate action sets — nothing in one blocks or feeds the other (e.g. "raise funding" and "get the permit" don't share steps). Don't split a single thread into fake parallel lines just to look thorough, and don't force two unrelated tracks into one chain just to keep it simple — check `successCriteria` for a `lineOfOperation` label already set; if none exists yet, propose one per genuinely independent track and confirm before building each graph.

Each line gets a short label (e.g. "Funding", "Permit") — this is what ties it back to the success criterion it serves.

### 3. Build the Dependency Graph (per line)

For each line of operation, enumerate the concrete actions needed, and their dependencies. If an action belongs to someone specific, name them. If an action's payoff depends on an unverified premise about how a third party or system will behave — not just whether the user can do it, but whether doing it produces the intended effect — flag that node explicitly rather than sequencing it at face value:

```
Action A — no dependencies — can start immediately — [you | person's name/role]
Action B — depends on: A — [...]
Action C — depends on: A — [ASSUMPTION: {premise} — unverified] — insert cheap
  verification step before committing to the expensive steps that follow it
Action D — depends on: B, C — [...]

Critical path: A → B → D (or A → C → D)
Parallel opportunity: B and C once A is done
```

Don't let an unverified assumption sit silently inside an otherwise-confident-looking graph — a flagged node changes what "next action" should be (verify the premise cheaply) versus an unflagged one (execute the expensive step directly).

### 4. Identify Each Line's Critical Path

For each line, call out the single longest dependency chain that, if delayed, delays that line's outcome the most. Keep each node a short label — arrow-chain it on one line if the labels are short enough to fit; switch to one bullet per step rather than let the line wrap:

```
CRITICAL PATH: [A] → [B] → [D]
Estimated duration: [...]
Status: on_schedule | at_risk | blocked
Blocker (if any): [what's blocking, what resolves it]
```

```
CRITICAL PATH:
- [short label A]
- [short label B]
- [short label D]
Estimated duration: [...]
Status: on_schedule | at_risk | blocked
Blocker (if any): [what's blocking, what resolves it]
```

### 5. Apply Posture

If `GOAL.json`'s `posture` key is set, scale the plan to the current level: how many things run in parallel — within a line, and across lines — how much you ask of any one person, how tight the timeline is. Higher posture means more concurrent asks and less margin — say so if the plan is pushing people harder than the posture level implies, or if it's under-using the posture the situation actually calls for.

### 6. Sequence Next Actions (per line)

For each line, list its next 3-5 actions in priority order — Schwerpunkt alignment first, then critical-path position. Each one should be concrete enough to start today, and clear about who does it. If more than one line is active, say which one deserves the user's attention first rather than leaving every line's next action looking equally urgent.

**Carry status forward.** Because this step replaces the whole `nextActions` array, a newly-done or newly-dropped action from the existing plan doesn't survive unless you re-add it. Before dropping an action off the list, check its current `status`: if it's genuinely done or intentionally dropped since the last plan write, keep it in the array with `status: "done"` or `"dropped"` rather than deleting it outright — that's how the visual layer shows a checkmark instead of the action just vanishing. Only remove an action entirely when it was never real (a duplicate, a misfire) rather than something that actually happened. New actions default to `status: "pending"`.

```
[Line label] NEXT
1. [action] — [you | who] — unblocks: [...] — [today|this week]
2. ...
```

If an action depends on someone who hasn't confirmed, flag that explicitly — don't plan around a person as if their involvement is settled when `people` marks them `tentative`.

### 6b. Reality-Check the Sequence

You know the dependencies. The user knows what's actually feasible for them this week.
Ask before committing the plan:

```
Before I write this down:

  - Is #1 actually doable in that window, or is something in the way?
  - Anything here you already know isn't going to happen?
```

A plan the user privately knows they won't execute is worse than a shorter one they
will. If they flag an action as unrealistic, resequence around it rather than logging it
and watching it rot. If a whole line's critical path is unrealistic, that's a signal for
`strategy` to reset the focus — say so rather than trimming the plan until it fits.

### 7. Flag Blockers and Replans

If something in an existing line has failed or stalled, name it, name the alternative path, and drop the dead branch. If there's no alternative for that line, say so plainly — that's a signal for `strategy` to reassess the focus, not for this skill to paper over. A blocked line doesn't automatically block others — say which lines are affected.

### 8. Update GOAL.json

Replace the `plan` key in `GOAL.json` with `linesOfOperation` — the current lines, each with its own critical path and next actions — rather than accumulating old ones. `plan.linesOfOperation` is min 1 (a single-thread goal still writes one line, not a bare flat shape). Each line is `{label, criticalPath, nextActions, status?, blocker?}`: `label` is a short (~40 char) name matching the `lineOfOperation` value used on the `successCriteria` entries it serves; `criticalPath` entries are `{label, detail?}` objects (max 6 entries, `label` ~5 words); `nextActions` is capped at 5, each `{action, who, when, status, detail?}` with `status` one of `pending` (default), `done`, `dropped`. Set that line's own `status` to `on_schedule`, `at_risk`, or `blocked`, and set `blocker` only when `status` is `blocked`.

`detail` on a `criticalPath` step or a `nextAction` (max 280 chars, optional) is a hover
tooltip in the visual layer — the reason this step is on the path, not a restatement of
the label. Fill it in only when the label alone won't jog memory later.

```json
{
  "plan": {
    "linesOfOperation": [
      {
        "label": "Main",
        "criticalPath": [
          { "label": "A", "detail": "..." },
          { "label": "B" },
          { "label": "D" }
        ],
        "nextActions": [
          { "action": "...", "who": "you | name", "when": "today | this week", "status": "pending" }
        ],
        "status": "on_schedule",
        "blocker": "..."
      }
    ]
  }
}
```

If a criterion in `successCriteria` doesn't yet carry a `lineOfOperation` label matching one written here, set it to match — that's how `eval` and the visual layer connect a criterion to the line actually serving it.

If this was a replan, append a `log` entry noting it.

### 9. Name the Next Step

End on the single first action, not the whole list — a plan handed over without a clear
first move gets read and not started.

```
Start here: [action 1, restated as something to do today]

Or:
  - Stress-test this before committing → threat
  - Check a fact the plan rests on → research
  - Resolve a fork the plan exposed → decide
  - Draft something the plan requires you to send → comms
```
