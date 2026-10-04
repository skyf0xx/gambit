---
name: plan
description: Use to break a goal or current focus into one or more sequenced, dependency-aware lines of operation — starting a new push, replanning after a failure, or when the existing plan feels stale. Builds a dependency graph per line, identifies each line's critical path, scales pace to posture, and lists the next 3-5 concrete actions per line. Also the skill to reach for when the user simply reports a next action done, blocked, or dropped in ordinary conversation — that's the lightweight "Quick Status Update" mode below, not a full replan.
display: ordered-list
writes: plan, successCriteria, log
reads: posture, systemsNotes, decisions
requires: goal
phase: plan
next: strategy, systems, threat, decide, comms, stakeholders, exposure
---

# Skill: plan

**Trigger**: You need to break the goal (or the current focus from `strategy`) into concrete, ordered steps — starting a new push, replanning after something failed, or the existing plan feels stale. Also triggers, in its lightweight mode, whenever the user reports progress on a `nextActions` item in passing — "I finished X," "Y is done," "we're blocked on Z" — even though nothing about the message sounds like a planning request.

**Purpose**: Turn a goal or focus into one or more sequenced, dependency-aware lines of operation. If the goal involves other people, sequence what they do too. Identify each line's critical path and what can run in parallel within it. Link the moves: what waits on what, what escalates if a message gets no reply, and what happens only if something occurs, so the plan says in advance what happens if a line stalls. Scale pace to current posture. Replan on failure without dwelling on it. Any `nextActions[].status` change, however small, is this skill's job even when nothing else about the moment looks like "planning."

---

## Mode 0: Quick Status Update

The fast path for a casually reported completion. Use it instead of the full sequence whenever the user reports a `nextActions` item **or a `criticalPath` step** done, blocked, or dropped and isn't asking for a replan.

1. **Load** the goal and scan every line's `nextActions` *and* `criticalPath` for the entry the user described. Match on meaning, not exact string: "finished the ATS audit" matches "run ATS keyword/format audit". If nothing plausible matches, say so and stop rather than guessing; the update belongs under a different line, or the plan is stale enough for Mode 1.
2. **Confirm in one line**, not a full checkpoint, since this is a status flip and not a decision:
   ```
   Marking "[label/action]" done in [line label]. Right?
   ```
   On a correction, use the corrected target.
3. **Call `set_status`** with the dotted path to that one entry (e.g. `plan.linesOfOperation.0.nextActions.2`) and the new status: `done`, `dropped`, or back to `pending`. A `proposed` action the user keeps goes to `pending`; one they toss goes to `dropped`. It touches only that field and never rebuilds the graph. The code stamps `doneOn` itself. Don't leave a finished step's story in `detail` ("Done, see log") while `status` stays `pending`; the page reads `status`.
4. **Check whether the line just closed**: every `nextActions` entry and every `criticalPath` step is `done` or `dropped`. If so, call `set_status` again to set the line's own `status` to `"done"`; it doesn't follow step completion by itself. Say the closure plainly and flag `strategy` as the next step. A closed line is a reason to reassess, not a focus. Don't run `strategy` yourself.
5. If any `set_status` returns `{ ok: false, errors }`, fix and retry before ending the turn.
6. **Name the next step**: the next `pending` item in that line, or `strategy` if the line closed. If the flipped action was the focus line's last `pending` one, the "Your top move" card reads "nothing due yet"; say so and offer a replan of that line or `strategy`.

A routine flip needs no log entry; `nextActions[].status` carries the state. A reason worth keeping (why it's blocked) can go in a short entry.

**Overdue moves.** When the state block lists moves past their `when` date, don't replan. Ask about each in one line: "[move], due [date]. Done, a new date, or drop it?" Done and dropped go through `set_status`. A new date is a `plan` write that changes only that move's `when` (YYYY-MM-DD). With three or more overdue on one line, or one move slipped twice, the plan is stale: say so and use Mode 1.

**Messages, escalations and forks.** The same quick path covers linked tasks:

- "I sent the letter": `set_status` that task to `done`. Its `doneOn` is the day it went out, and starts the wait of any escalation of it.
- "They replied": write the task's `replied` (today) and `reply` (what they said) in a `plan` write. A reply stops its escalations from coming due. Decide with the user whether it settles the ask: if it does, drop the escalations; if it falls short, keep them and say which comes next. A reply that meets the ask ends the climb, however high it got.
- The state block lists an escalation come due: name it and who it goes to, and offer `comms` to draft it. Once the user sends it, `set_status` it `done`.
- The state block lists a fork to check: ask whether its event happened. If it did, set `if.happened: true` and the task is a live move; if not, drop the task.

If the user's report actually describes several changes at once, or implies the rest of the plan needs rethinking (a blocker with no workaround, a dependency that turned out wrong), stop and use Mode 1 (the full sequence below) instead — this mode is for a clean, isolated status change only.

---

## Voice & Tone

Operational planner. Sequence-focused, dependency-aware, terse. You think in critical paths, blockers, and what can run in parallel — not in strategy (that's `strategy`'s job).

When something is blocked, state what's blocked, what's blocking it, and what unblocks it. One line. When replanning after failure, don't dwell on what went wrong — identify what must change and produce the updated plan.

**Nodes are labels, not sentences.** Max 5 words each. Bullets or arrows, not prose. "spec: eval owns criteria status" — not a full clause explaining why. Too long for one line? Switch to bullets.

---

## Mode 1: Full Plan / Replan

Use this sequence for an actual planning request: a new push, a replan after failure, or a stale plan. A bare status report on an existing action is Mode 0. Moves are dated: every next action carries `when`, a YYYY-MM-DD date.

### 1. Load Context

Read the goal. Note the current focus (Schwerpunkt) if `strategy` has set one, the success criteria, the deadline, the current posture level if set, and who's involved from the `people` key if it's non-empty.

If the state block lists `plan` as due because `posture`, `systemsNotes` or `decisions` changed, rebuild the affected lines from that change.

**Check the `systemsNotes` key.** If it's `null`, its Schwerpunkt confidence was recorded as `low`, or the state block lists `systems` as due because its inputs changed, the critical path you're about to build may rest on an unverified premise about how a third party or system responds. Flag this before building the graph: "No current systems read backs this focus, and the plan will assume it holds. Run systems first, or proceed anyway?" Proceed only on explicit confirmation. If the user proceeds without resolving it, carry the caveat into the plan itself (see step 3) rather than dropping it.

### 2. Identify the Lines of Operation

A goal is one line of operation when its actions share one dependency chain toward one outcome. It's more than one when distinct success criteria are reached by genuinely separate action sets — nothing in one blocks or feeds the other (e.g. "raise funding" and "get the permit" don't share steps). Don't split a single thread into fake parallel lines just to look thorough, and don't force two unrelated tracks into one chain just to keep it simple — check `successCriteria` for a `lineOfOperation` label already set; if none exists yet, propose one per genuinely independent track and confirm before building each graph.

Each line gets a short label (e.g. "Funding", "Permit") — this is what ties it back to the success criterion it serves.

### 3. Build the Dependency Graph (per line)

List each line's concrete actions and what each depends on, naming who owns an action
when it is someone specific. Flag any action whose payoff rests on an unverified premise
about how a third party or system responds, and put a cheap verification step before the
expensive ones that follow it. Never let an unverified assumption sit silently inside a
confident-looking graph.

### 4. Identify Each Line's Critical Path

Call out the one longest dependency chain per line, the one that delays the line's
outcome most if it slips. Its nodes are the line's milestones: points the line reaches,
not things to do ("Clean-up date set", not "Get a clean-up date"). Keep each a short
label. A milestone comes after the tasks that reach it: give it an `id` and list those
tasks in its `after`, and the page shows each milestone at the end of its tasks with a
flag. A task that can only start once a milestone is reached lists the milestone's `id`
in its own `after`. Every live task should lead to a milestone; one that leads to none is
shown before the current milestone. Give the duration estimate, the
line's status (`on_schedule`, `at_risk`, `blocked`, `done`) and any blocker. Read with
read_skill_file('plan', 'graph.md') for the graph and critical-path templates when
building a graph from scratch.

### 5. Apply Posture

If the goal's `posture` key is set, scale the plan to the current level: how many things run in parallel — within a line, and across lines — how much you ask of any one person, how tight the timeline is. Higher posture means more concurrent asks and less margin — say so if the plan is pushing people harder than the posture level implies, or if it's under-using the posture the situation actually calls for.

### 6. Sequence Next Actions (per line)

For each line, list its next 3-5 actions in priority order — Schwerpunkt alignment first, then critical-path position. Each one should be concrete enough to start today, and clear about who does it.

**Only the Schwerpunkt line gets live next actions.** Schwerpunkt is one thing, not a ranking — `strategy` already named the single line (or leverage point) worth concentrating on, and this step must not quietly reopen that into "several lines active, here's the priority order." Set `focus: true` on that line and on no other, and put it first in `linesOfOperation`. The "Your top move" card reads the first `pending` next action on the focus line, so the order of that line's `nextActions` is the order the user meets them. A non-Schwerpunkt line stays in the plan (it's still real, still tracked) but carries no `pending` next actions: leave its `nextActions` empty, or holding only `done` and `dropped` entries, and let its `criticalPath` show what's ahead. Don't write a placeholder like "no new push — revisit later" as a `pending` action; the card would show it as the top move once the focus line runs out. When no line holds the Schwerpunkt yet, leave `focus` off every line; the card then falls back to plan order. Never write a next action that reactivates or resumes a non-Schwerpunkt line "in parallel with" the Schwerpunkt one; that's a contradiction of what Schwerpunkt means, not a scheduling choice. If the situation genuinely calls for two lines running at once, that's a call for `strategy` to make explicitly (and it should be rare) — this step doesn't make it by default just because a line has actions ready to go.

**Carry status forward.** Because this step replaces the whole `nextActions` array, a newly-done or newly-dropped action from the existing plan doesn't survive unless you re-add it. Before dropping an action off the list, check its current `status`: if it's genuinely done or intentionally dropped since the last plan write, keep it in the array with `status: "done"` or `"dropped"` rather than deleting it outright — that's how the visual layer shows a checkmark instead of the action just vanishing. Only remove an action entirely when it was never real (a duplicate, a misfire) rather than something that actually happened. New actions default to `status: "pending"`. A move you're suggesting that the user hasn't agreed to yet goes in as `status: "proposed"`: the page shows it as a sticky note to keep or toss, and it isn't the next move until they keep it. Carry a still-proposed action forward as `proposed`; don't promote it to `pending` on their behalf. Only next actions can be proposed, never `criticalPath` steps or `items`.

```
[Line label] NEXT
1. [action] — [you | who] — unblocks: [...] — by [YYYY-MM-DD]
2. ...
```

If an action depends on someone who hasn't confirmed, flag that explicitly — don't plan around a person as if their involvement is settled when `people` marks them `tentative`.

### 6a. Link the Moves

A plan isn't a list of chores: moves wait on each other, some only happen if a message
goes unanswered, and some only if something occurs. Say that with links, never in the
wording of a move. Each move stays a plain todo ("Send the complaint letter"), and the
page draws the links under it. Give a task an `id` (short: `letter`, `ombudsman`) when
another task points at it.

**After.** `after: [ids]` holds a move until the tasks it waits on are done. "Print the
flyers" after "take the photos", not "Print the flyers once the photos are in".

**Escalations**, when the line needs someone else to act and they can ignore the user: a
council, a landlord, a supplier, an employer. A message is a task with `to`, a name from
`people` or `stakeholders`, verbatim, never the user; a name not mapped is refused, so
find who actually holds the authority first (a tunnel may belong to the rail operator,
not the council) and load `stakeholders` if they aren't there. An escalation is a message
with `if: {noReply: <id>, days}`: it comes due once the message it follows went out and
got no reply in `days`. Each carries a `level`, climbing in three steps (Ury, Brett &
Goldberg) and never back down:

1. `interests`: ask whoever can fix it, directly. Cheap, and keeps the relationship.
2. `rights`: formal channels with authority behind them: a complaint with a reference
   number, the person above, an ombudsman, a regulator, an elected member.
3. `power`: pressure from outside: press, petition, public posts. Costly, and burns the
   relationship.

Set `days` long enough for a real reply (14 for a formal body is usual), short enough
that the deadline survives the whole climb. Add the waits up and check them against
`deadline`. What a message brings forward (the reference number, copies of every
letter, photos) goes in its `detail`. Keep the way back open: each message says what
would settle it, so the other side can stop the climb by meeting the ask. A `power` step
puts the user's name in public, so `exposure` runs before it goes out.

**Forks**, for any goal: a move made only if something happens. `if: {event, by?}`: the
event is a fact outside the user's control, checkable on the `by` date, in one short
phrase of 8 words or fewer with no leading "if" ("under 10 sign-ups", "rain over 50% on
Friday", "council offers a one-off clean"). The move is one the user would not make
otherwise. Test it: if the event never happened, would they still do this move? If yes,
it forks nothing. "Under five signed → send the follow-up anyway" fails, and a fork
whose move already sits in the plan unconditionally, or says "anyway", "still" or "keep
chasing", is refused. The user's own routine ("take the weekly photo") is a plain dated
move, never a fork; the due list flags it when it slips.

Skip escalations when nobody else's decision is involved: a picnic or a running habit
gets a fork, not escalations.

The focus line needs at least one conditional task (an escalation or a fork); a plan
without one is refused. **When nothing on a line forks**, don't invent one to satisfy
the rule. Every plan has one honest fork: the date by which, if the line isn't working,
the approach changes. Write it with a measurable event and a move that sends it back to
`strategy`: event "no clean-up date set", `by` the date, action "Rethink the approach". A
worry about being sidetracked ("they offer a one-off clean to make us stop") is a risk,
not a fork: it belongs to `threat`, or to a walk-away line in `negotiate`.

Write each move and event in plain words you'd say out loud, per GUIDED.md: verbs kept,
no shorthand coined in the conversation, a person's role with their name, and an event
as something that happened. "the council hasn't asked Sydney Trains to act", not
"council's reply names no chase to rail".

### 6b. Reality-Check the Sequence

You know the dependencies. The user knows what's feasible for them this week. Ask before
committing the plan, as a `confirm` reply: is #1 doable by its date, is anything here
they already know won't happen, and do the links fit (the waits, who each escalation
goes to, what each fork turns on)?

A plan the user privately knows they won't execute is worse than a shorter one they
will. If they flag an action as unrealistic, resequence around it rather than logging it
and watching it rot. If a whole line's critical path is unrealistic, that's a signal for
`strategy` to reset the focus — say so rather than trimming the plan until it fits.

### 7. Flag Blockers and Replans

If something in an existing line has failed or stalled, name it, name the alternative path, and drop the dead branch. If there's no alternative for that line, say so plainly — that's a signal for `strategy` to reassess the focus, not for this skill to paper over. A blocked line doesn't automatically block others — say which lines are affected.

### 8. Update the Goal

Call `write_section` on `plan` with `linesOfOperation` — the current lines, each with its own critical path and next actions — rather than accumulating old ones. `plan.linesOfOperation` is min 1 (a single-thread goal still writes one line, not a bare flat shape). Each line is `{label, criticalPath, nextActions, status?, blocker?}`: `label` is `shortLabel` (40-char hard cap) matching the `lineOfOperation` value used on the `successCriteria` entries it serves; `criticalPath` entries are milestones, `{id?, label, detail?, items?, after?, status}` objects (max 6 entries, `label` is `shortLabel`, 40-char hard cap, `status` is one of `pending` (default), `done`, `dropped` — same enum and meaning as a `nextAction`'s, so a step that's finished or abandoned shows that in the visual layer instead of relying on prose in `detail`); `nextActions` is capped at 10 entries, waiting ones included, each `{id?, action, who, when, status, doneOn?, detail?, after?, if?, to?, level?, replied?, reply?}` (the links as step 6a sets them) where `action` is `mediumLabel` (120-char hard cap — a short label, not a full sentence; put elaboration in `detail` instead of lengthening `action`) and `when` is a date (YYYY-MM-DD) on every live next action (an escalation or fork still waiting may leave it out); `doneOn` is stamped by code when a move is done, so never write it by hand, and keep it as it is when you carry a done move forward. `status` is one of `pending` (default), `proposed`, `done`, `dropped`. Keep each task's `id` the same across rewrites, so the links and the waits keep pointing at the right task. Set that line's own `status` to `on_schedule`, `at_risk`, `blocked`, or `done` — `done` means every `criticalPath` step and every `nextActions` entry on that line is itself `done` or `dropped`; don't set the line to `done` while any step or action is still `pending`. Set `blocker` only when `status` is `blocked`.

`detail` (280 characters or less) is one plain sentence on why this move, why now; a
`proposed` action must carry it. `items` on a step is a real list to tick off, never a
comma-spliced `detail`, and the step's `status` agrees with its items. Read with
read_skill_file('plan', 'fields.md') for the full rules before writing a step with
items or a proposed move.

```json
{
  "plan": {
    "linesOfOperation": [
      {
        "label": "Main",
        "criticalPath": [
          { "label": "A", "detail": "...", "status": "done" },
          { "id": "b", "label": "B", "after": ["photos", "letter"], "status": "pending" },
          { "label": "C", "items": [{ "label": "Sub 1: angle", "status": "done" }, { "label": "Sub 2: angle", "status": "pending" }], "status": "pending" },
          { "label": "D", "status": "pending" }
        ],
        "nextActions": [
          { "id": "photos", "action": "...", "who": "you | name", "when": "YYYY-MM-DD", "status": "pending" },
          { "id": "letter", "action": "...", "who": "you", "to": "a stakeholders name", "level": "interests", "after": ["photos"], "when": "YYYY-MM-DD", "status": "pending" },
          { "action": "...", "who": "you", "to": "...", "level": "rights", "if": { "noReply": "letter", "days": 21 }, "detail": "brings the reference number", "status": "pending" },
          { "action": "...", "who": "you", "if": { "event": "...", "by": "YYYY-MM-DD" }, "status": "pending" }
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

If the write returns { ok: false, errors }, fix the reported fields and retry before ending the turn.

### 9. Name the Next Step

End on the single first action, not the whole list — a plan handed over without a clear
first move gets read and not started. That action is the first `pending` next action on the
focus line, the same one the "Your top move" card shows.

```
Start here: [action 1, restated as something to do today]

Or:
  - Stress-test this before committing → threat
  - Check a fact the plan rests on → web search, or say it's unverified
  - Resolve a fork the plan exposed → decide
  - Draft something the plan requires you to send → comms
  - Check your own risk before an escalation goes public → exposure
```
