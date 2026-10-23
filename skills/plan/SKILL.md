---
name: plan
description: Use to break a goal or focus into sequenced, dependency-aware lines of operation — a new push, a replan after failure, or a stale plan. Builds each line's critical path and next actions, with escalations and forks linked in. Also the skill for any next action the user reports done, blocked or dropped in passing (its quick status mode).
display: ordered-list
writes: plan, successCriteria, log
reads: posture, systemsNotes, decisions
requires: goal
phase: plan
next: strategy, systems, threat, decide, comms, stakeholders, exposure
---

# Skill: plan

**Trigger**: You need to break the goal (or the current focus from `strategy`) into concrete, ordered steps — starting a new push, replanning after something failed, or the existing plan feels stale. Also triggers, in its lightweight mode, whenever the user reports progress on a `nextActions` item in passing — "I finished X," "Y is done," "we're blocked on Z" — even though nothing about the message sounds like a planning request.

**Purpose**: Turn a goal or focus into sequenced, dependency-aware lines of operation, sequencing what other people do too. Find each line's critical path and what can run in parallel. Link the moves (what waits on what, what escalates if a message gets no reply, what happens only if something occurs), so the plan says in advance what happens if a line stalls. Scale pace to posture. Replan on failure without dwelling on it. Any `nextActions[].status` change, however small, is this skill's job.

---

## Mode 0: Quick Status Update

The fast path for a casually reported completion. Use it instead of the full sequence whenever the user reports a `nextActions` item done, blocked, or dropped and isn't asking for a replan. A milestone (`criticalPath`) has no status of its own: it is reached once the tasks in its `after` are done, so when the user says they reached one, flip those tasks; `set_status` on a milestone is refused.

1. **Load** the goal and scan every line's `nextActions` for the entry the user described (for a reached milestone, the tasks it lists). Match on meaning, not exact string: "finished the ATS audit" matches "run ATS keyword/format audit". If nothing plausible matches, say so and stop rather than guessing; the update belongs under a different line, or the plan is stale enough for Mode 1.
2. **Confirm in one line**, not a full checkpoint, since this is a status flip and not a decision:
   ```
   Marking "[label/action]" done in [line label]. Right?
   ```
   On a correction, use the corrected target.
3. **Call `set_status`** with the dotted path to that one entry (e.g. `plan.linesOfOperation.0.nextActions.2`) and the new status: `done`, `dropped`, or back to `pending`. A `proposed` action the user keeps goes to `pending`; one they toss goes to `dropped`. It touches only that field and never rebuilds the graph. The code stamps `doneOn` itself.
4. **Check whether the line just closed**: every `nextActions` entry is `done` or `dropped`, so every milestone is reached. If so, call `set_status` again to set the line's own `status` to `"done"`; it doesn't follow task completion by itself. Say the closure plainly and flag `strategy` as the next step. A closed line is a reason to reassess, not a focus. Don't run `strategy` yourself.
5. If any `set_status` returns `{ ok: false, errors }`, fix and retry before ending the turn.
6. **Name the next step**: the next `pending` item in that line, or `strategy` if the line closed (status.md says what to do when that empties the top-move card).

A routine flip needs no log entry; `nextActions[].status` carries the state. A reason worth keeping (why it's blocked) can go in a short entry.

**Overdue moves, messages, escalations and forks.** The same quick path covers them:
ask about each overdue move in one line (done, a new date, or drop it); a sent message
is a `done` task whose `doneOn` starts any escalation's wait; a reply is written as
`replied` and `reply`; an escalation come due goes to `comms` to draft; a fork to check
is settled by asking whether its event happened. Read with read_skill_file('plan',
'status.md') before handling any of these.

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

One line of operation when the actions share one dependency chain toward one outcome; more than one only when distinct success criteria are reached by separate action sets that never block or feed each other ("raise funding" and "get the permit"). No fake parallel lines, and no forcing unrelated tracks into one chain. Use a `lineOfOperation` label already on `successCriteria`; if none exists, propose one per independent track and confirm before building each graph.

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
not things to do ("Clean-up date set", not "Get a clean-up date"). A milestone has an
`id`, lists in `after` the tasks that reach it (at least one, or the write is refused),
and has no status: it's reached once those tasks are done or dropped, at least one done.
Read with read_skill_file('plan', 'milestones.md') before writing `criticalPath`.

Give the duration estimate, the line's status (`on_schedule`, `at_risk`, `blocked`,
`done`) and any blocker. Read with read_skill_file('plan', 'graph.md') for the graph and
critical-path templates when building a graph from scratch.

### 5. Apply Posture

If the goal's `posture` key is set, scale the plan to the current level: how many things run in parallel — within a line, and across lines — how much you ask of any one person, how tight the timeline is. Higher posture means more concurrent asks and less margin — say so if the plan is pushing people harder than the posture level implies, or if it's under-using the posture the situation actually calls for.

### 6. Sequence Next Actions (per line)

For each line, list its next 3-5 actions in priority order — Schwerpunkt alignment first, then critical-path position. Each one should be concrete enough to start today, and clear about who does it.

**Only the Schwerpunkt line gets live next actions.** Set `focus: true` on that line
alone and put it first; other lines stay in the plan with no `pending` actions, and this
step never reopens two lines running at once (that's `strategy`'s call).

**Carry status forward.** The write replaces the whole `nextActions` array, so keep done
and dropped moves in it rather than deleting them. New moves are `pending`; a move the
user hasn't agreed to is `proposed`, and stays so until they keep it.

Read with read_skill_file('plan', 'focus.md') for the full rules before writing
`nextActions`.

```
[Line label] NEXT
1. [action] — [you | who] — unblocks: [...] — by [YYYY-MM-DD]
2. ...
```

If an action depends on someone who hasn't confirmed, flag that explicitly — don't plan around a person as if their involvement is settled when `people` marks them `tentative`.

### 6a. Link the Moves

Moves wait on each other, some only happen if a message goes unanswered, and some only
if something occurs. Say that with links, never in the wording of a move: each move
stays a plain todo, and the page draws the links.

- **After**: `after: [ids]` holds a move until the tasks it waits on are done.
- **Escalations**, when someone else can ignore the user: a message is a task with `to`
  (a `people` or `stakeholders` name, verbatim, never the user); an escalation is a
  message with `if: {noReply: <id>, days}` and a `level` that climbs `interests` →
  `rights` → `power` and never back down. `exposure` runs before a `power` step.
- **Forks**, for any goal: `if: {event, by?}`, a move the user wouldn't make unless the
  event happens. The event is one short phrase; the move never restates it.

The focus line needs at least one conditional task, or the write is refused. When
nothing forks, use the fork every plan has: no measurable progress by a date, then
rethink the approach. Read with read_skill_file('plan', 'links.md') before writing any
link, escalation or fork; it holds the tests a write is refused on.

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

Call `write_section` on `plan` with `linesOfOperation`: the current lines, each with its
own critical path and next actions, replacing old ones. At least one line; up to 6
milestones and 10 next actions a line; every live move has a `when` date; keep each
task's `id` the same across rewrites; never write `doneOn` by hand. Read with
read_skill_file('plan', 'write.md') for the full field rules and an example before the
write, and with read_skill_file('plan', 'fields.md') before writing a proposed move's
`detail`.

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
