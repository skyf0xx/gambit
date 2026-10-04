---
name: options
description: Use when there is more than one real way to reach the goal and the user has not picked one — before committing to a plan, or when the current approach has stalled. Builds up to three distinct courses of action, each with why it could win, what could sink it and how others would react, then compares them so one can be chosen. Writes to the goal's courses key.
display: ordered-list
writes: courses, log
reads: systemsNotes, stakeholders
requires: goal
phase: develop
next: decide, plan, threat
---

# Skill: options

**Trigger**: There is more than one real way to reach the goal or the focus and none
is picked. Before a plan is built, or when the current approach has stalled and the
user is trying more of the same.

**Purpose**: Develop up to three genuinely different courses of action, test each
against how the other side would react, compare them and recommend one. This is
course-of-action development and wargaming from military planning.

`decide` takes one open choice to a recorded call. `options` comes before that: it
builds the choices so there is something real to pick between.

---

## Voice & Tone

A planner with a view. Confident, specific and honest about each course's weak side.
Recommend one and say why. Three variations on one idea is a failure, so say plainly
when only two real courses exist.

---

## Execution Sequence

### 1. Load Context

Read the goal, the focus, `systemsNotes`, `stakeholders`, `capacity`, `riskNotes`,
`memory` and any `courses` already there. `rejected` memory entries are off the table.

### 2. Generate Distinct Courses

Up to three. Distinct means a different line of attack, a different bet about where
the leverage is, or a different party moved first. Not the same idea at another speed
or budget. Test: if the first course failed completely, would the second still be
open? The same ask at three volumes (ask, complain, go public) is one course with an
escalation ladder, which `plan` builds, not three courses.

For each:

```
NAME: [short label]
IDEA: [what you do, in a sentence]
WINS IF: [why it could succeed, and what must be true]
RISKS: [what could sink it]
COUNTER: [their likely reaction, then our answer]
```

### 3. Wargame Each One

Play action, reaction, counteraction. We move; the people with a say respond (use
`stakeholders` for their interests and power); we answer. Follow the first reaction
that hurts, not the whole tree. If our answer to it is weak, that is a risk and goes
in `risks`.

### 4. Compare and Recommend

Set the courses side by side against the success criteria, the deadline and the
user's real capacity. Recommend one. Say what it gives up. If one course dominates,
say so and don't pad.

```
RECOMMEND: [name], because [one reason]
GIVES UP: [what the others offered]
CHANGE MY MIND: [an observable fact]
```

### 5. Confirm Before Writing

Show the courses and the recommendation as one `confirm` reply, recommended course
first in `options`. Ask what the user knows that changes it. Feed their answer back
and re-reason; don't hand the choice back. Write after they reply, never in the turn
this skill was loaded.

If the user is truly torn between two live courses and cannot resolve it, hand those
two to `decide`.

### 6. Write the Courses

Call `write_section` on `courses` with the full list, at most 3:

```json
{
  "courses": [
    { "name": "...", "idea": "...", "wins": "...", "risks": "...", "counter": "...", "chosen": true },
    { "name": "...", "idea": "...", "wins": "...", "risks": "...", "counter": "..." }
  ]
}
```

`name` is 40 characters or less. `idea`, `wins`, `risks` and `counter` are 120 or less.
Set `chosen: true` only on the course the user picks, and on no other. Until they
pick, write all courses without it. When they pick later, replace the list in place
with the choice marked.

### 7. Log and Name the Next Step

Call `append_log` with `source: "options"` only when a course is chosen: one note,
the course and the reason in a few words.

If a write returns `{ ok: false, errors }`, fix the reported fields and retry before
ending the turn.

```
Next: [chosen course] -> plan builds it

Or:
  - Torn between two -> decide
  - Stress-test the chosen course -> threat
  - A course rests on an unknown -> recon
```
